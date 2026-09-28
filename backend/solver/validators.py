"""Validate recognized mathematics before it is solved."""

import re

from .errors import SolverError

_DANGEROUS = re.compile(
    r"(__|eval\s*\(|exec\s*\(|compile\s*\(|__import__|import\s+|os\.|sys\.|"
    r"subprocess|open\s*\(|lambda\b|globals\s*\(|locals\s*\(|getattr\s*\(|setattr\s*\()",
    re.IGNORECASE,
)

_TRAILING_OP = re.compile(r"[+\-*/^=<>]\s*$")


def validate_source(source: str) -> str:
    """Return stripped source or raise SolverError."""
    if source is None or not str(source).strip():
        raise SolverError("EMPTY_INPUT", "Please verify the recognized equation.")

    text = str(source).strip()
    if _DANGEROUS.search(text):
        raise SolverError(
            "INVALID_EQUATION",
            "The recognized equation contains unsupported input.",
        )

    if text.count("(") != text.count(")"):
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    if text.count("{") != text.count("}"):
        raise SolverError(
            "MALFORMED_LATEX",
            "The recognized equation has unbalanced braces.",
        )
    if text.count("[") != text.count("]"):
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )

    stripped = text.replace(r"\left", "").replace(r"\right", "")
    if _TRAILING_OP.search(stripped) and not stripped.endswith((">", "<")):
        # Inequalities can end with the relation only when the right side is missing,
        # which the trailing check already covers for '=' and operators.
        if re.search(r"(=|<=|>=|\\leq|\\geq|\+|-|\*|/|\^)\s*$", text):
            raise SolverError(
                "MALFORMED_LATEX",
                "Unable to solve because the recognized equation appears incomplete.",
            )

    return text
