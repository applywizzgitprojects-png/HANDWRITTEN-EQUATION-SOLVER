"""End-to-end check: image recognition, then the symbolic solver.

The recognition model is loaded only for the image test. Solver checks compare
mathematical meaning, not exact LaTeX whitespace.
"""

import sys
import unittest
from pathlib import Path

import sympy as sp

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))

from solver import solve_math_text
from solver.expression_parser import parse_normalized
from solver.latex_parser import latex_to_normalized


def _same_equation(latex: str, expected: str) -> bool:
    left = parse_normalized(latex_to_normalized(latex))
    right = parse_normalized(latex_to_normalized(expected))
    if len(left) != 1 or len(right) != 1:
        return False
    if not (isinstance(left[0], sp.Equality) and isinstance(right[0], sp.Equality)):
        return False
    return sp.simplify((left[0].lhs - left[0].rhs) - (right[0].lhs - right[0].rhs)) == 0


class EndToEndTests(unittest.TestCase):
    def test_quadratic_workflow_from_recognized_latex(self):
        recognized = "x ^ { 2 } + 2 x + 1 = 0"
        self.assertTrue(_same_equation(recognized, "x**2 + 2*x + 1 = 0"))
        result = solve_math_text(recognized)
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "quadratic_equation")
        self.assertEqual(result["solution"], ["-1"])
        self.assertTrue(result["verification"]["verified"])
        self.assertGreaterEqual(len(result["steps"]), 2)

    def test_image_recognition_then_solve(self):
        image = ROOT / "test_demo.png"
        weights = ROOT / "checkpoints" / "model_weights.pt"
        if not image.exists() or not weights.exists():
            self.skipTest("recognition checkpoint or demo image is missing")

        import asyncio

        from backend.main import health, predict_latex, solve_equation
        from solver.models import SolveRequest

        class Upload:
            def __init__(self, data: bytes):
                self._data = data
                self.filename = "test_demo.png"
                self.content_type = "image/png"

            async def read(self) -> bytes:
                return self._data

        async def run():
            health_body = await health()
            recognized = await predict_latex(Upload(image.read_bytes()))
            solved = None
            if isinstance(recognized, dict) and recognized.get("latex"):
                solved = await solve_equation(SolveRequest(latex=recognized["latex"]))
            edited = await solve_equation(SolveRequest(latex="x ^ { 2 } + 2 x + 1 = 0"))
            return health_body, recognized, solved, edited

        health_body, recognized, solved, edited = asyncio.run(run())
        self.assertEqual(health_body["status"], "ok")
        self.assertTrue(health_body["model_loaded"])
        self.assertTrue(health_body["solver_available"])
        self.assertIn("vocab_size", health_body)
        self.assertIn("model_params", health_body)
        self.assertIsInstance(recognized, dict)
        self.assertTrue(str(recognized.get("latex", "")).strip())
        self.assertIsNotNone(solved)
        self.assertIn("success", solved)
        self.assertNotIn("Traceback", solved.get("message") or "")
        if _same_equation(recognized["latex"], "x+y=z"):
            self.assertEqual(solved["variables"], ["x", "y", "z"])
            self.assertIn("infinitely many", solved["message"])
        self.assertTrue(edited["success"], edited)
        self.assertEqual(edited["solution"], ["-1"])


if __name__ == "__main__":
    unittest.main()
