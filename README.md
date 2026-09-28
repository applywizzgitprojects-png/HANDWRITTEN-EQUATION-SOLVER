# Handwritten Equation Solver using OCR + Deep Learning

An intelligent handwritten mathematical equation solving system that uses OpenCV for image preprocessing and deep-learning-based handwriting recognition to convert handwritten mathematical expressions into structured mathematical notation, automatically analyze and solve equations, and provide step-by-step solutions with verification.

Recognition answers “What was written?” Solving answers “What is the result?” Check the recognized equation before trusting the solution. The recognizer does not read every handwriting style correctly.

## What it does

Two ways to enter a handwritten equation:

1. **Upload Image** — one PNG, JPG, JPEG, or WEBP file.
2. **Write by Hand** — draw with a mouse, finger, or stylus.

Write by Hand is saved as a white-background PNG and sent to the same recognizer as an upload. It is not a separate online-stroke model.

```text
Upload or canvas
    → OpenCV preprocessing
    → Mini-CoMER recognition (LaTeX)
    → SymPy solver
    → solution, verification, and steps
```

There is no Solve button. A successful recognition is solved automatically. You can edit the recognized equation, and the edited text is solved again.

The Solver page shows the input, the recognized equation, the preview and solution, and the step-by-step solution.

Supported math includes linear, quadratic, and polynomial equations, linear systems, one-variable inequalities, expressions, fractions, square roots, and selected `exp`, `sin`, `cos`, `tan`, `ln`, and `log` forms. `log` is base 10. `ln` is the natural log. Calculus, matrices, integrals, and arbitrary LaTeX are not supported.

The model is Mini-CoMER: a DenseNet encoder, a Transformer decoder, and an Attention Refinement Module. On the CROHME benchmarks, exact expression match is 47.46% (2014), 46.12% (2016), and 47.87% (2019). Those figures are benchmark scores, not a general accuracy claim.

## Run locally

Requirements: Python 3.10 or newer, Node.js with npm, and `checkpoints/model_weights.pt`.

### Windows

```powershell
cd D:\Projects\MathSnap-AI
python -m venv venv
.\venv\Scripts\activate
pip install -r backend\requirements.txt
npm install
```

Create `.env` in the project root:

```text
VITE_API_URL=http://localhost:8000
```

Terminal 1:

```powershell
.\venv\Scripts\python.exe backend\main.py
```

Terminal 2:

```powershell
npm run dev
```

### macOS

```bash
cd ~/Projects/MathSnap-AI
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
npm install
```

Use the same `.env` file as on Windows.

Terminal 1:

```bash
source venv/bin/activate
python backend/main.py
```

Terminal 2:

```bash
npm run dev
```

Open http://localhost:5173. Check the backend at http://localhost:8000/health. Stop each terminal with `Ctrl+C`, frontend first.

CUDA is optional. Without it, recognition runs on CPU.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /predict` | Image file field `file` → LaTeX |
| `POST /solve` | JSON `{ "latex": "..." }` → solution |
| `GET /health` | Model and solver status |

## Tests

```powershell
venv\Scripts\python.exe -m unittest backend.tests.test_solver -v
npm run build
```

On macOS, use `python -m unittest backend.tests.test_solver -v`. `backend/tests/test_e2e.py` also loads the checkpoint and recognizes `test_demo.png`.

