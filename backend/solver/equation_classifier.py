"""Classify parsed mathematics."""

import sympy as sp

from .errors import SolverError

def _is_relation(item) -> bool:
    return hasattr(item, "lhs") and hasattr(item, "rhs")


def classify(relations: list) -> dict:
    variables = _variables(relations)
    inequalities = [item for item in relations if _is_relation(item) and not isinstance(item, sp.Equality)]
    equations = [item for item in relations if isinstance(item, sp.Equality)]
    expressions = [item for item in relations if not _is_relation(item)]

    if expressions and (equations or inequalities):
        raise SolverError(
            "INVALID_EQUATION",
            "Please verify the recognized equation.",
        )
    if inequalities and equations:
        raise SolverError(
            "UNSUPPORTED_EQUATION",
            "This equation type is currently not supported.",
        )

    degree = None
    if len(relations) == 1 and expressions:
        equation_type = "expression"
    elif inequalities:
        equation_type = "inequality"
        if len(relations) == 1 and len(variables) == 1:
            degree = _degree(_moved(relations[0]), variables)
    elif len(equations) > 1:
        if all(_is_linear(eq, variables) for eq in equations):
            equation_type = "simultaneous_linear_equations"
            degree = 1
        else:
            equation_type = "simultaneous_nonlinear_equations"
    elif len(equations) == 1:
        equation_type, degree = _classify_equation(equations[0], variables)
    else:
        equation_type = "unsupported"

    return {
        "equation_type": equation_type,
        "variables": [symbol.name for symbol in variables],
        "symbols": variables,
        "degree": degree,
        "equation_count": 0 if equation_type == "expression" else len(relations),
        "unknown_count": len(variables),
    }


def _classify_equation(equation, variables: list[sp.Symbol]) -> tuple[str, int | None]:
    expr = sp.expand(equation.lhs - equation.rhs)
    if expr.has(sp.sin, sp.cos, sp.tan):
        return "trigonometric_equation", _degree(expr, variables)
    if expr.has(sp.log):
        return "logarithmic_equation", _degree(expr, variables)
    if _is_exponential(expr):
        return "exponential_equation", _degree(expr, variables)
    degree = _degree(expr, variables)
    if degree == 1 or (degree == 0 and len(variables) <= 1 and _is_linear(equation, variables)):
        return "linear_equation", degree if degree else 1 if variables else 0
    if degree == 2 and len(variables) == 1:
        return "quadratic_equation", degree
    if degree is not None and degree >= 3 and len(variables) == 1:
        return "polynomial_equation", degree
    if degree is not None and degree > 1 and len(variables) > 1:
        return "simultaneous_nonlinear_equations", degree
    if degree == 1 and len(variables) > 1:
        return "linear_equation", degree
    if _has_radical(expr):
        return "algebraic_equation", degree
    if len(variables) == 1:
        return "algebraic_equation", degree
    if len(variables) == 0:
        return "linear_equation", 0
    return "unsupported", degree


def _variables(relations: list) -> list[sp.Symbol]:
    found = set()
    for item in relations:
        found |= set(item.free_symbols)
    ignored = {sp.pi, sp.E, sp.oo, -sp.oo}
    return sorted((symbol for symbol in found if symbol not in ignored), key=lambda item: item.name)


def _moved(relation):
    return sp.expand(relation.lhs - relation.rhs)


def _degree(expr, variables: list[sp.Symbol]) -> int | None:
    if not variables:
        return 0 if not expr.free_symbols else None
    try:
        if len(variables) == 1 and expr.is_polynomial(variables[0]):
            return int(sp.degree(expr, variables[0]))
        if all(expr.is_polynomial(variable) for variable in variables):
            return int(sp.total_degree(sp.Poly(sp.expand(expr), *variables)))
    except Exception:
        return None
    return None


def _is_linear(equation, variables: list[sp.Symbol]) -> bool:
    if not isinstance(equation, sp.Equality):
        return False
    expr = sp.expand(equation.lhs - equation.rhs)
    if not variables:
        return expr.free_symbols == set()
    try:
        polynomial = sp.Poly(expr, *variables)
    except (sp.PolynomialError, TypeError, ValueError):
        return False
    if polynomial.total_degree() > 1:
        return False
    for monomial in polynomial.as_dict():
        if sum(monomial) > 1:
            return False
    return True


def _is_exponential(expr) -> bool:
    if expr.has(sp.exp):
        return True
    for power in expr.atoms(sp.Pow):
        if power.exp.free_symbols and not power.base.free_symbols:
            return True
    return False


def _has_radical(expr) -> bool:
    if expr.has(sp.sqrt):
        return True
    for power in expr.atoms(sp.Pow):
        exponent = power.exp
        if getattr(exponent, "is_Rational", False) and exponent.q not in (0, 1):
            return True
    return False
