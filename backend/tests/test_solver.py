"""Solver tests that do not load the recognition model."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from solver import solve_math_text


def _values(result):
    return " ".join(result.get("solution") or []) + " " + (result.get("solution_latex") or "") + " " + (result.get("message") or "")


class SolverTests(unittest.TestCase):
    def test_linear(self):
        result = solve_math_text("2x + 5 = 15")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "linear_equation")
        self.assertEqual(result["variables"], ["x"])
        self.assertIn("5", result["solution"])
        self.assertEqual(result["solution_status"], "verified")

    def test_recognized_digits_are_one_number(self):
        result = solve_math_text("2 x + 5 = 1 5")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "linear_equation")
        self.assertEqual(result["solution"], ["5"])
        self.assertEqual(result["solution_status"], "verified")

    def test_perfect_square_quadratic(self):
        result = solve_math_text("x ^ { 2 } + 2 x + 1 = 0")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "quadratic_equation")
        self.assertEqual(result["solution"], ["-1"])
        descriptions = " ".join(step["description"] for step in result["steps"])
        self.assertIn("Factor", descriptions)
        self.assertTrue(result["verification"]["verified"])

    def test_quadratic_two_roots(self):
        result = solve_math_text("x² - 5x + 6 = 0")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["2", "3"])

    def test_cubic(self):
        result = solve_math_text("x^3 - 6x^2 + 11x - 6 = 0")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "polynomial_equation")
        self.assertEqual(result["solution"], ["1", "2", "3"])

    def test_linear_system(self):
        result = solve_math_text("x + y = 10\n2x - y = 5")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "simultaneous_linear_equations")
        self.assertEqual(result["variables"], ["x", "y"])
        joined = _values(result)
        self.assertIn("x = 5", joined)
        self.assertIn("y = 5", joined)

    def test_inequality(self):
        result = solve_math_text("2x + 4 > 10")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "inequality")
        joined = _values(result)
        self.assertIn(">", joined)
        self.assertIn("3", joined)

    def test_no_real_solution(self):
        result = solve_math_text("x^2 + 1 = 0")
        self.assertTrue(result["success"], result)
        self.assertIn("no real solution", result["message"].lower())
        self.assertEqual(result["solution"], [])
        self.assertTrue(result["complex_solutions"])

    def test_expression_arithmetic(self):
        result = solve_math_text("2 + 3 * 4")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["equation_type"], "expression")
        self.assertEqual(result["solution"], ["14"])

    def test_sqrt_expression(self):
        result = solve_math_text("sqrt(25)")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["5"])

    def test_power_expression(self):
        result = solve_math_text("2^5")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["32"])

    def test_invalid_input(self):
        result = solve_math_text("(((")
        self.assertFalse(result["success"])
        self.assertTrue(result["message"])
        self.assertNotIn("Traceback", result["message"])

    def test_empty_input(self):
        result = solve_math_text("   ")
        self.assertFalse(result["success"])
        self.assertEqual(result["error_type"], "EMPTY_INPUT")

    def test_malformed_latex(self):
        result = solve_math_text(r"\frac{1}{")
        self.assertFalse(result["success"])
        self.assertIn(result["error_type"], {"MALFORMED_LATEX", "INVALID_EQUATION"})

    def test_unsupported_function(self):
        result = solve_math_text(r"\zeta(2) = 0")
        self.assertFalse(result["success"])
        self.assertEqual(result["error_type"], "UNSUPPORTED_EQUATION")

    def test_division_by_zero(self):
        result = solve_math_text("1/0")
        self.assertFalse(result["success"])
        self.assertEqual(result["error_type"], "DIVISION_BY_ZERO")

    def test_infinite_solution(self):
        result = solve_math_text("x = x")
        self.assertTrue(result["success"], result)
        self.assertIn("infinitely many", result["message"])

    def test_fraction_equation(self):
        result = solve_math_text(r"\frac{x+1}{2}=5")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["9"])

    def test_square_root_equation(self):
        result = solve_math_text(r"\sqrt{x}+2=5")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["9"])

    def test_power_equation(self):
        result = solve_math_text("x^2 = 25")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["solution"], ["-5", "5"])

    def test_log_and_exponential(self):
        logarithmic = solve_math_text("log(x) = 1")
        exponential = solve_math_text("2^x = 8")
        trigonometric = solve_math_text("sin(x) = 0")
        self.assertTrue(logarithmic["success"], logarithmic)
        self.assertEqual(logarithmic["solution"], ["10"])
        self.assertEqual(logarithmic["equation_type"], "logarithmic_equation")
        self.assertTrue(exponential["success"], exponential)
        self.assertEqual(exponential["solution"], ["3"])
        self.assertEqual(exponential["equation_type"], "exponential_equation")
        self.assertTrue(trigonometric["success"], trigonometric)
        self.assertEqual(trigonometric["equation_type"], "trigonometric_equation")
        self.assertTrue(trigonometric["solution_latex"])

    def test_multiple_variables_are_reported(self):
        result = solve_math_text("x + y = 10")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["variables"], ["x", "y"])
        self.assertIn("infinitely many", result["message"])

    def test_edited_equation_is_what_gets_solved(self):
        recognized = solve_math_text("x^2 + Zx + 1 = 0")
        corrected = solve_math_text("x^2 + 2x + 1 = 0")
        self.assertNotEqual(recognized["solution"], ["-1"])
        self.assertEqual(corrected["solution"], ["-1"])

    def test_dangerous_input_is_rejected(self):
        result = solve_math_text("__import__('os')")
        self.assertFalse(result["success"])
        self.assertNotIn("Traceback", result["message"])


if __name__ == "__main__":
    unittest.main()
