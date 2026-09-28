# Handwritten Equation Solver using OCR + Deep Learning

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?logo=opencv&logoColor=white)
![SymPy](https://img.shields.io/badge/SymPy-3B5526)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.12-06B6D4?logo=tailwindcss&logoColor=white)
![KaTeX](https://img.shields.io/badge/KaTeX-0.16.38-008080)

An intelligent handwritten mathematical equation solving system that uses OpenCV for image preprocessing and deep-learning-based handwriting recognition to convert handwritten mathematical expressions into structured mathematical notation, automatically analyze and solve equations, and provide step-by-step solutions with verification.

Handwriting recognition and mathematical solving are separate steps. Recognition answers “What did the user write?” Solving answers “What is the mathematical result?” A recognized expression should be checked before the result is trusted. The recognizer does not read every handwriting style correctly.

## Overview

The application accepts a handwritten mathematical expression in either of two ways:

1. **Upload Image** — one PNG, JPG, JPEG, or WEBP image.
2. **Write by Hand** — draw on a browser canvas with a mouse, finger, or stylus.

Both paths produce an image. That image is preprocessed and sent to the same handwritten mathematical expression recognition model. The model returns LaTeX. After a successful recognition, the application parses that expression and solves it automatically. The Solver page then shows the recognized equation, a mathematical preview, the solution, the equation type, the variables, verification, and the step-by-step solution when one is available.

```text
Upload Image / Write by Hand
        ↓
Image / canvas image preparation
        ↓
OpenCV preprocessing
        ↓
Deep-learning HMER model
        ↓
LaTeX recognition
        ↓
Recognized equation
        ↓
Mathematical parsing
        ↓
SymPy solving
        ↓
Step-by-step solution
        ↓
Verification
```

There is no separate Solve button. Recognition is followed by parsing, solving, verification, and display.

## Key Features

### Upload Image

- Accepts one handwritten image at a time.
- Supported types are PNG, JPG, JPEG, and WEBP.
- The uploaded image is sent to `POST /predict`.
- A successful recognition is solved automatically.

### Write by Hand

- A handwriting canvas is available from the Solver page.
- Pointer input supports mouse, touch, and stylus where the browser exposes them.
- Pen, eraser, undo, redo, and clear are included.
- Pen sizes are Small, Medium, and Large. Medium is the default.
- The drawing is kept on screen so it can be compared with the recognized equation.

The canvas does not use a separate online-stroke recognition model. Strokes are drawn in the browser, rasterized to a white-background PNG, cropped around the ink with padding, and sent to the existing `POST /predict` endpoint.

### Automatic Recognition

- OpenCV preprocessing matches the training image format: grayscale, Otsu binarization, and black background with white foreground.
- The recognizer is a Mini-CoMER handwritten mathematical expression recognition model: a DenseNet encoder, a Transformer decoder, and an Attention Refinement Module.
- Inference uses greedy decoding and returns LaTeX.
- KaTeX renders the recognized expression.
- The recognized equation remains editable.
- Status text reports recognition and solving progress.

### Automatic Mathematical Solving

After recognition succeeds, the LaTeX is sent to `POST /solve` without another button. Editing the recognized equation schedules another solve. An empty expression is not sent to the solver.

```text
Recognize → Parse → Solve → Verify → Display result
```

### Step-by-Step Solutions

When the solver can explain a result, the page lists the original expression and the following transformations. Detailed steps are generated for expressions, single-variable linear equations, single-variable quadratic and polynomial equations, single-variable inequalities, and two-equation linear systems in two variables. Other solved forms still return the symbolic result, with a note that detailed transformation steps are not available for that type.

### Verification

Where the implementation can check a result, the solution panel reports whether the solution satisfies the original equation or expression. Verification is not claimed when that check does not succeed. Some valid results, such as an underdetermined linear equation, are reported as infinitely many solutions and are not marked verified.

## How It Works

1. The user uploads an image or writes on the canvas.
2. Write by Hand exports a PNG named `handwritten-equation.png` with a white background and dark strokes.
3. The frontend sends that file to `POST /predict` as multipart field `file`.
4. The backend preprocesses the image and runs the HMER model.
5. The response LaTeX is shown in the recognized-equation panel and rendered with KaTeX.
6. The frontend calls `POST /solve` with that LaTeX.
7. The solver parses the expression, classifies it, solves it with SymPy, builds steps, and verifies the result when that check applies.
8. The same result panels are used for uploaded images and canvas drawings.

The recognizer often emits digits as separate tokens. The solver joins adjacent digits, so recognized text such as `1 5` is treated as the number 15.

## System Architecture

```text
Frontend
React + TypeScript + Vite
        ↓
Input
Upload Image / Write by Hand
        ↓
FastAPI backend
        ↓
OpenCV / PIL preprocessing
        ↓
Mini-CoMER HMER model
        ↓
LaTeX
        ↓
Solver parser
        ↓
SymPy
        ↓
Solution + verification
        ↓
Frontend
```

| Layer | Role |
| --- | --- |
| `src/` | Solver page, handwriting canvas, KaTeX preview, dashboard, home, about, and settings |
| `backend/main.py` | `POST /predict`, `POST /solve`, and `GET /health` |
| `backend/solver/` | Parsing, classification, SymPy solving, steps, and verification |
| `models/` | Mini-CoMER network used by the backend |
| `checkpoints/model_weights.pt` | Loaded recognition weights |
| `backend/vocab.json` | Recognition vocabulary |

The backend uses CUDA when it is available and CPU otherwise. Local development uses the frontend at `http://localhost:5173` and the backend at `http://localhost:8000`.

## Recognition Model

The loaded model is Mini-CoMER, based on CoMER (Coverage-based Mathematical Expression Recognition). It is not a generic CNN OCR model. The network is:

- a DenseNet encoder
- a Transformer decoder
- an Attention Refinement Module (ARM) with cross coverage and self coverage

The current configuration uses a 256-dimensional model, 3 decoder layers, 8 attention heads, and greedy decoding with a maximum length of 150 tokens. Images are scaled to fit within 128×512 pixels. The vocabulary file contains 114 tokens. The loaded checkpoint reports about 6.39 million parameters.

The model was trained for handwritten mathematical expressions in the CROHME setting. Published exact-match rates for this Mini-CoMER evaluation, called ExpRate, are:

| Benchmark | ExpRate |
| --- | --- |
| CROHME 2014 | 47.46% |
| CROHME 2016 | 46.12% |
| CROHME 2019 | 47.87% |

ExpRate is exact expression-sequence matching on those benchmark sets. It is not a general real-world accuracy percentage, and it does not describe every photo or canvas drawing.

Canvas drawings are raster images. They are not sent to the model as online pen trajectories.

## Mathematical Solver

Solving starts only after LaTeX is available. The solver does not look at the image.

The current implementation supports these categories, with the same limits shown in the application:

| Category | Current support |
| --- | --- |
| Linear equations | Supported |
| Quadratic equations | Supported |
| Polynomial equations | Supported |
| Systems of equations | Linear systems supported |
| Inequalities | Supported for one relation in one variable |
| Expressions | Supported |
| Fractions | Supported |
| Square roots | Supported |
| Exponential equations | Selected forms (`exp`) |
| Trigonometric equations | Selected forms (`sin`, `cos`, `tan`) |
| Logarithmic equations | Selected forms (`ln`, and `log` as base 10) |

Also implemented:

- `log(x)` is base 10. `ln(x)` is the natural logarithm. `log(x, base)` is accepted.
- `sqrt` and `abs` are accepted.
- Single-letter variables and names such as `x_1` are accepted.
- Real numbers are the default domain. `x^2 + 1 = 0` is reported as having no real solution.
- One linear equation with several variables can be reported as having infinitely many solutions.
- `POST /solve` accepts `allow_complex`. The Solver page does not send that flag, so the interface uses real solutions.

Results can include `equation_type`, `variables`, `solution`, `solution_latex`, `steps`, `verification`, `solution_status`, and `message`.

## User Interface

The header is **Handwritten Equation Solver**. Navigation is Home, Solver, Dashboard, and About. Settings and the theme control are header icons. **New Equation** clears the current image, canvas, recognized equation, preview, solution, steps, verification, and status.

### Solver page

On a wide screen the Solver page has three panels, then a full-width step section.

**1. Input Method**

- Upload Image and Write by Hand, with Upload Image selected by default.
- Upload area, or the handwriting canvas with Pen, Eraser, Small, Medium, Large, Undo, Redo, and Clear.
- **Recognize & Solve** for canvas input. It stays disabled until there is ink, and while recognition or solving is running.

**2. Recognized Equation**

- Editable expression and its LaTeX.
- KaTeX preview.
- Copy control.
- Status such as image or handwriting captured, recognizing, equation recognized, solving, and solution found.

**3. Mathematical Preview & Solution**

- Recognized equation.
- Solution.
- Equation type.
- Variable or variables.
- Verification, shown as verified only when `verification.verified` is true.

**Step-by-Step Solution**

Shown below the three panels when the solver returns steps. The solution summary is not repeated as a second card.

### Other pages

- **Home** introduces the system, the pipeline, and the supported problem labels.
- **Dashboard** shows session counts, the eight pipeline stages, short descriptions of recognition and solving, the supported-problem list, and system status from `GET /health`. The counts are stored in the browser for the current tab. They start at 0 and are not a historical server log. Dataset and training charts are not shown.
- **About** describes the pipeline in product language.
- **Settings** changes the theme among Light, Dark, and System.

## Supported Input

| Input | What is accepted |
| --- | --- |
| Upload Image | One PNG, JPG, JPEG, or WEBP file |
| Write by Hand | Pointer drawing on the canvas, exported as a PNG |
| Edited equation | LaTeX or plain math text in the recognized-equation field |

Write by Hand uses pointer events (`pointerdown`, `pointermove`, `pointerup`, and `pointercancel`). Touch scrolling is disabled on the canvas only. Undo and redo apply to strokes while the writing pad is focused. Clear asks for confirmation when the drawing has more than a few points.

## Supported Mathematical Problems

These examples are expected solver results **after the recognized equation is correct**. They are test cases, not a promise that handwriting will be read correctly.

Basic arithmetic:

| Recognized expression | Expected result |
| --- | --- |
| `1 + 2` | `3` |
| `4 - 2` | `2` |
| `4 + 2` | `6` |
| `5 - 3` | `2` |
| `7 + 8` | `15` |
| `8 / 2` | `4` |
| `3 * 4` | `12` |

Linear equations:

| Recognized expression | Expected result |
| --- | --- |
| `2x + 5 = 15` | `x = 5` |
| `x + 7 = 12` | `x = 5` |
| `2x - 4 = 10` | `x = 7` |

Quadratic equations:

| Recognized expression | Expected result |
| --- | --- |
| `x^2 + 2x + 1 = 0` | `x = -1` |
| `x^2 - 5x + 6 = 0` | `x = 2` and `x = 3` |

For `4 - 2`, a correct recognition is an expression whose preview is `4 - 2`, whose solution is `2`, whose type is Expression, and whose verification can report that the solution was checked against the original expression. For `x + 7 = 12`, the expected solution is `x = 5`.

Always compare the handwriting or uploaded image with the recognized equation. If the LaTeX is wrong, edit it. The edited text is solved automatically.

## Recognition Limitations

The HMER model is not reliable for every writer, photo, or canvas drawing. Handwriting style, symbol ambiguity, stroke thickness, spacing, image quality, and two-dimensional structure can change the LaTeX. A plus sign, a digit, and a fraction bar are easy for the model to confuse.

This task is harder than ordinary text OCR because the model must recover both symbols and mathematical layout. CoMER addresses attention and coverage behavior in Transformer-based handwritten mathematical expression recognition: [CoMER: Modeling Coverage for Transformer-based Handwritten Mathematical Expression Recognition](https://arxiv.org/abs/2207.04410).

The CROHME ExpRate figures above measure exact matches on benchmark sets. They should not be quoted as the accuracy of this application on new handwriting.

If recognition is wrong, correct the equation in the editor or clear the canvas and write again with more space between symbols.

## Solver Limitations

The solver returns an explicit error instead of inventing a result when the input is outside the implemented grammar.

Not supported or only partly supported by the current code:

- Calculus, including integrals, derivatives, limits, and sums.
- Matrices and arbitrary symbolic computer-algebra worksheets.
- Arbitrary LaTeX. Only the commands accepted by `backend/solver/latex_parser.py` are parsed.
- The plus-minus symbol. The solver asks for each case separately.
- A chain of equals signs, such as `a = b = c`.
- Inequalities with more than one variable or more than one relation.
- Nonlinear systems are not covered by the linear-system step path and can be rejected.
- Functions other than `sin`, `cos`, `tan`, `log`, `ln`, `exp`, `sqrt`, and `abs`.
- Division by zero.
- Python code, imports, `eval`, and `exec`. Those inputs are rejected before solving.

Unsupported or malformed input returns `success: false` with an `error_type` such as `UNSUPPORTED_EQUATION`, `MALFORMED_LATEX`, `INVALID_EQUATION`, `EMPTY_INPUT`, `DIVISION_BY_ZERO`, or `SOLVER_FAILURE`, plus a `message`.

## Installation

### Prerequisites

- Python 3.10 or newer.
- Node.js and npm. `package.json` does not pin a Node version.
- A PyTorch install that matches the machine. CUDA is optional. Without it, recognition runs on CPU.
- The checkpoint file `checkpoints/model_weights.pt`.

Frontend versions that are declared in `package.json`:

- React 18.3.1 and React DOM 18.3.1
- Vite 6.3.5
- Tailwind CSS 4.1.12
- KaTeX `^0.16.38`

`backend/requirements.txt` lists FastAPI, Uvicorn, PyTorch, Pillow, python-multipart, OpenCV (`opencv-python-headless`), NumPy, einops, and SymPy. Those backend packages are not pinned to exact versions in that file.

### Windows Setup

From the project root in PowerShell:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
npm install
```

If `python` is not Python 3.10 or newer, create the virtual environment with the interpreter you intend to use, then keep using `venv\Scripts\python.exe` for the backend.

Create a `.env` file in the project root if it is not already present:

```text
VITE_API_URL=http://localhost:8000
```

There is no `.env.example` in the repository. `.env` is the frontend configuration file used for this variable.

Terminal 1:

```powershell
venv\Scripts\python.exe backend\main.py
```

Terminal 2:

```powershell
npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Health check: http://localhost:8000/health

`npm run dev` starts Vite and opens the browser. The backend listens on `0.0.0.0:8000`.

### Backend

```bash
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r backend/requirements.txt
# Windows:
venv\Scripts\python.exe backend\main.py
# macOS/Linux:
python backend/main.py
```

Startup loads `backend/vocab.json` and `checkpoints/model_weights.pt`. The process prints the parameter count and whether the device is CPU or CUDA.

### Frontend

```bash
npm install
npm run dev
```

Production build, which also runs the TypeScript check configured in `package.json`:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `.env`, or the shell when building | Base URL of the FastAPI server. Local default in the frontend is `http://localhost:8000` when the variable is unset. |
| `API_URL` | Vercel build environment | `vercel.json` sets `VITE_API_URL=$API_URL` for the production frontend build. |

The Solver page and the dashboard both call `import.meta.env.VITE_API_URL` and fall back to `http://localhost:8000`.

Settings in the interface cover theme only. They do not change the model or the API URL.

## API Reference

### POST /predict

Recognizes one image and returns LaTeX. This does not solve the equation.

Request: `multipart/form-data` with one field, `file`. Allowed names end in `.png`, `.jpg`, `.jpeg`, or `.webp`. The matching content types are also accepted.

Success body:

```json
{
  "latex": "2 x + 5 = 1 5",
  "recognized_expression": "2x + 5 = 15",
  "confidence": null
}
```

`recognized_expression` is a parsed display form when parsing succeeds. Otherwise it repeats the raw LaTeX. `confidence` is always `null` in the current implementation. The success body does not include a `success` field.

Error body:

```json
{
  "success": false,
  "error_type": "UNSUPPORTED_IMAGE",
  "message": "Unsupported image type. Use PNG, JPG, JPEG, or WEBP."
}
```

Other recognition errors use `EMPTY_IMAGE` (400), `CORRUPTED_IMAGE` (400), or `RECOGNITION_FAILED` (500 or 422).

### POST /solve

Solves recognized or edited math text. This does not run the vision model.

Request:

```json
{
  "latex": "2 x + 5 = 1 5",
  "allow_complex": false
}
```

`allow_complex` is optional and defaults to `false`.

Success body for that input:

```json
{
  "success": true,
  "recognized_expression": "2x + 5 = 15",
  "normalized_expression": "2 * x + 5 = 15",
  "equation_type": "linear_equation",
  "variables": ["x"],
  "degree": 1,
  "equation_count": 1,
  "unknown_count": 1,
  "solution": ["5"],
  "solution_latex": "x = 5",
  "steps": [
    { "step": 1, "latex": "2 x + 5 = 15", "description": "Original equation" }
  ],
  "verification": {
    "verified": true,
    "solution_status": "verified",
    "message": "Solution satisfies the equation."
  },
  "message": null,
  "error_type": null,
  "complex_solutions": null,
  "solution_status": "verified"
}
```

The `steps` array continues through the remaining transformations. On failure, `success` is `false`, `error_type` and `message` are set, and the solution fields are empty.

### GET /health

Reports whether the process started with the model and solver available.

```json
{
  "status": "ok",
  "device": "cpu",
  "model_loaded": true,
  "solver_available": true,
  "vocab_size": 114,
  "model_params": 6393714
}
```

`device` is `cuda` when PyTorch can see a GPU. `model_params` is the parameter count of the loaded checkpoint.

## Testing

Automated tests, from the project root:

```powershell
venv\Scripts\python.exe -m unittest backend.tests.test_solver -v
venv\Scripts\python.exe -m unittest backend.tests.test_e2e -v
npm run build
```

`backend/tests/test_solver.py` checks the solver without loading the vision model. It covers linear, quadratic, and polynomial equations, systems, inequalities, expressions, split digits such as `1 5`, invalid input, division by zero, and unsupported functions.

`backend/tests/test_e2e.py` loads the checkpoint, recognizes `test_demo.png`, and checks solver behavior for recognized LaTeX. That image is the equation `x + y = z`, which the solver treats as one linear equation in three variables and reports as having infinitely many solutions.

`npm run build` runs `tsc` and then `vite build`.

Manual recognition checks, after you confirm the recognized text:

1. Write or upload `4 - 2` and confirm the preview before expecting `2`.
2. Write or upload `x + 7 = 12` and confirm the preview before expecting `x = 5`.
3. Repeat with the arithmetic, linear, and quadratic cases in [Supported Mathematical Problems](#supported-mathematical-problems).
4. Switch back to Upload Image and confirm that a file upload still recognizes and solves.
5. Use Undo, Redo, Eraser, and Clear on the canvas, then run Recognize & Solve only when ink is present.

A failed reading is a recognition result to correct. It is not a solver result for the symbols you intended.

## Project Structure

```text
backend/
  main.py                 API and OpenCV preprocessing
  requirements.txt
  vocab.json
  solver/                 Parser, classifier, SymPy solver, steps, verification
  tests/                  test_solver.py, test_e2e.py
checkpoints/
  model_weights.pt        Recognition weights
config.py                 Model and image-size configuration
models/                   Mini-CoMER encoder, decoder, and ARM
data/                     Vocabulary loader used by the model
src/
  app/App.tsx             Page routing
  app/session-stats.ts    Browser session counts for the dashboard
  app/components/
    convert-page.tsx      Solver page
    handwriting-canvas.tsx
    latex-preview.tsx
    dashboard-page.tsx
    home-page.tsx
    about-page.tsx
    settings-page.tsx
    header.tsx
    footer.tsx
deployment/huggingface/   Separate recognition-service layout
public/                   Static frontend assets
vercel.json               Frontend build and SPA rewrite
package.json
vite.config.ts
test_demo.png             Sample equation image used by the end-to-end test
```

The Solver screen is implemented in `src/app/components/convert-page.tsx`. Its route id in the app shell is `convert`. The visible name is Solver.

## Deployment

Frontend hosting is configured for Vite in `vercel.json`. The build command is `VITE_API_URL=$API_URL npx vite build`, with output directory `dist`. Set `API_URL` in the hosting project to the backend origin. No public frontend URL is documented here.

`deployment/huggingface/` contains a separate recognition app, its own README, and a Dockerfile. It is not the full Solver interface. Point the frontend at whatever backend you deploy:

```text
VITE_API_URL=https://YOUR_BACKEND_URL
```

Replace `YOUR_BACKEND_URL` with the origin that actually serves `/health`, `/predict`, and `/solve`.

## Troubleshooting

**Backend not running.** Open http://localhost:8000/health. A working process returns `"status": "ok"` and `"model_loaded": true`. Start it with `venv\Scripts\python.exe backend\main.py`.

**Frontend cannot reach the backend.** Check `VITE_API_URL` in `.env`. Restart `npm run dev` after changing it. The browser fallback is `http://localhost:8000`.

**Checkpoint missing.** Recognition cannot start without `checkpoints/model_weights.pt`. The backend prints the path it tries to load.

**The recognized equation is wrong.** Compare it with the image or the canvas. Edit the equation. Solving uses the text in that field, not a second guess from the image.

**Write by Hand is misread.** Clear the canvas and write again with separated symbols and one equals sign. The canvas PNG is what `POST /predict` sees. The same model limits apply as for uploaded images.

**The solver rejects the expression.** Check [Solver Limitations](#solver-limitations). A message such as “This equation type is currently not supported” or “could not be interpreted” means the LaTeX is outside the parser or the implemented equation types.

**Dashboard counts are 0.** Those numbers are for the current browser tab and increase only after a recognition or solve in that tab. They are not loaded from the server.

## Acknowledgments

These are third-party technologies, research, and datasets used by this application. They were not created as part of this project.

- **CoMER**: Zhao, W., Gao, L., Yan, Z., Peng, S., Du, L., and Zhang, Z. (2022). *CoMER: Modeling Coverage for Transformer-based Handwritten Mathematical Expression Recognition*. ECCV 2022. [Paper](https://arxiv.org/abs/2207.04410) | [Code](https://github.com/Green-Wood/CoMER)
- **ICAL**: [https://github.com/qingzhenduyu/ICAL](https://github.com/qingzhenduyu/ICAL) — DenseNet encoder implementation used by the model code
- **CROHME**: Mouchère, H., Viard-Gaudin, C., Zanibbi, R., and Garain, U. — Competition on Recognition of Online Handwritten Mathematical Expressions
- **KaTeX**: [https://katex.org](https://katex.org) — math rendering in the browser
- **shadcn/ui**: [https://ui.shadcn.com](https://ui.shadcn.com) — UI components, noted under the MIT license in `ATTRIBUTIONS.md`
- **SymPy, PyTorch, OpenCV, FastAPI, React, and Vite** — the solving, recognition, API, and frontend stack declared by this repository

## License

The repository root does not include a `LICENSE` file, so this README does not assign a project license. Third-party notices that are present are in `ATTRIBUTIONS.md`. Upstream projects listed above keep their own licenses.
