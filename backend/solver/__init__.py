"""Public entry point for the handwritten-equation solver."""

import logging

from .equation_classifier import classify
from .equation_solver import assert_defined, solve_problem
from .errors import SolverError
from .expression_parser import parse_normalized
from .formatter import display_system
from .latex_parser import latex_to_normalized
from .models import SolveResponse, StepResult, VerificationResult
from .validators import validate_source

logger = logging.getLogger(__name__)


def solve_math_text(source: str, allow_complex: bool = False) -> dict:
    try:
        text = validate_source(source)
        normalized = latex_to_normalized(text)
        relations = parse_normalized(normalized)
        assert_defined(relations)
        classification = classify(relations)
        if classification["equation_type"] == "unsupported":
            raise SolverError(
                "UNSUPPORTED_EQUATION",
                "This equation type is currently not supported.",
            )
        outcome = solve_problem(relations, classification, allow_complex=allow_complex)
        verification = outcome.get("verification") or {}
        response = SolveResponse(
            success=True,
            recognized_expression=display_system(relations),
            normalized_expression=normalized,
            equation_type=classification["equation_type"],
            variables=classification["variables"],
            degree=classification["degree"],
            equation_count=classification["equation_count"],
            unknown_count=classification["unknown_count"],
            solution=outcome["solution"],
            solution_latex=outcome["solution_latex"],
            steps=[StepResult(**step) for step in outcome["steps"]],
            verification=VerificationResult(**verification) if verification else None,
            message=outcome.get("message"),
            complex_solutions=outcome.get("complex_solutions"),
            solution_status=outcome.get("solution_status"),
        )
        return response.model_dump()
    except SolverError as exc:
        return SolveResponse(
            success=False,
            error_type=exc.error_type,
            message=exc.message,
        ).model_dump()
    except Exception:
        logger.exception("Equation solver failed")
        return SolveResponse(
            success=False,
            error_type="SOLVER_FAILURE",
            message="Unable to solve the recognized expression.",
        ).model_dump()
