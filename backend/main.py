"""
FastAPI backend for CoMER HMER model inference.
Receives an image, preprocesses it, runs greedy decode, returns LaTeX.
"""

import io
import logging
import os
import sys

import cv2
import numpy as np
import torch
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

# Add project root to path so we can import models/data
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, BACKEND_DIR)

from solver import solve_math_text
from solver.models import SolveRequest

from data.vocab import Vocab
from models.model import build_model
from config import Config

# ============================================================
# App setup
# ============================================================
app = FastAPI(title="MathSnap AI - HMER Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Model loading (once at startup)
# ============================================================
VOCAB_PATH = os.path.join(BACKEND_DIR, "vocab.json")
WEIGHTS_PATH = os.path.join(PROJECT_ROOT, "checkpoints", "model_weights.pt")

config = Config()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"Loading vocab from {VOCAB_PATH}")
vocab = Vocab.from_file(VOCAB_PATH)

print(f"Building model ({config.model.d_model}d, {config.model.num_decoder_layers}L)...")
model = build_model(config, len(vocab)).to(device)

print(f"Loading weights from {WEIGHTS_PATH}")
model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=device, weights_only=False))
model.eval()

num_params = sum(p.numel() for p in model.parameters())
print(f"Model ready: {num_params/1e6:.2f}M params on {device}")


# ============================================================
# Image preprocessing (must match training pipeline)
# ============================================================
def preprocess_image(pil_image: Image.Image) -> tuple:
    """Preprocess uploaded image to match CoMER training format.

    Training uses: black background, white foreground, grayscale,
    variable size within h_hi x w_hi bounds.

    Returns:
        img_tensor: [1, 1, H, W] float32
        mask_tensor: [1, H, W] bool (False = valid, True = padding)
    """
    # Convert to grayscale numpy
    img = np.array(pil_image.convert("L"))  # [H, W] uint8

    # Binarize with Otsu
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Detect background from border pixels
    h, w = binary.shape
    border = np.concatenate([
        binary[0, :], binary[-1, :],
        binary[:, 0], binary[:, -1]
    ])
    bg_is_white = np.mean(border) > 128

    # Ensure black background, white foreground (matching CoMER training data)
    if bg_is_white:
        binary = 255 - binary

    # Scale to fit within bounds (preserve aspect ratio)
    h_hi, w_hi = config.data.h_hi, config.data.w_hi
    scale = min(h_hi / h, w_hi / w, 1.0)
    if scale < 1.0:
        new_h = max(1, int(h * scale))
        new_w = max(1, int(w * scale))
        binary = cv2.resize(binary, (new_w, new_h), interpolation=cv2.INTER_AREA)

    h, w = binary.shape

    # To tensor
    img_tensor = torch.from_numpy(binary).float().unsqueeze(0).unsqueeze(0) / 255.0  # [1,1,H,W]
    mask_tensor = torch.zeros(1, h, w, dtype=torch.bool)  # no padding

    return img_tensor.to(device), mask_tensor.to(device)


# ============================================================
# API endpoints
# ============================================================
_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
logger = logging.getLogger(__name__)


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error_type": error_type, "message": message},
    )


def _recognized_expression(latex: str) -> str:
    """Pretty-print recognized LaTeX when it parses. Recognition still succeeds if it does not."""
    try:
        from solver.expression_parser import parse_normalized
        from solver.formatter import display_system
        from solver.latex_parser import latex_to_normalized

        return display_system(parse_normalized(latex_to_normalized(latex)))
    except Exception:
        return latex


@app.post("/predict")
async def predict_latex(file: UploadFile = File(...)):
    """Receive one image and return the recognized LaTeX string."""
    image_data = await file.read()
    if not image_data:
        return _error(400, "EMPTY_IMAGE", "The uploaded image is empty.")

    extension = os.path.splitext((file.filename or "").lower())[1]
    content_type = (file.content_type or "").lower()
    if extension not in _ALLOWED_EXTENSIONS and content_type not in _ALLOWED_CONTENT_TYPES:
        return _error(
            400,
            "UNSUPPORTED_IMAGE",
            "Unsupported image type. Use PNG, JPG, JPEG, or WEBP.",
        )

    try:
        pil_image = Image.open(io.BytesIO(image_data))
        pil_image.load()
    except Exception:
        return _error(400, "CORRUPTED_IMAGE", "Could not read the image. The file may be corrupted.")

    try:
        img_tensor, mask_tensor = preprocess_image(pil_image)

        with torch.no_grad():
            pred_indices = model.greedy_decode(
                img_tensor, mask_tensor,
                sos_idx=vocab.sos_idx,
                eos_idx=vocab.eos_idx,
                max_len=150,
            )

        latex_tokens = vocab.decode(pred_indices[0], remove_special=True)
    except Exception:
        logger.exception("Recognition failed")
        return _error(500, "RECOGNITION_FAILED", "Could not recognize mathematical content.")

    if not str(latex_tokens).strip():
        return _error(422, "RECOGNITION_FAILED", "Could not recognize mathematical content.")

    return {
        "latex": latex_tokens,
        "recognized_expression": _recognized_expression(latex_tokens),
        "confidence": None,
    }


@app.post("/solve")
async def solve_equation(body: SolveRequest):
    """Solve a recognized or edited equation. This does not run the vision model."""
    return solve_math_text(body.latex, allow_complex=body.allow_complex)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "device": str(device),
        "model_loaded": True,
        "solver_available": True,
        "vocab_size": len(vocab),
        "model_params": sum(p.numel() for p in model.parameters()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
