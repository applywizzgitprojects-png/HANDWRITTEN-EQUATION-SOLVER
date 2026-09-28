"""Format SymPy results for the API and the KaTeX preview."""

import re

import sympy as sp


def to_latex(expr) -> str:
    return sp.latex(expr)


def display_math(expr) -> str:
    if isinstance(expr, sp.Equality):
        return f"{_compact(expr.lhs)} = {_compact(expr.rhs)}"
    if isinstance(expr, sp.StrictGreaterThan):
        return f"{_compact(expr.lhs)} > {_compact(expr.rhs)}"
    if isinstance(expr, sp.StrictLessThan):
        return f"{_compact(expr.lhs)} < {_compact(expr.rhs)}"
    if isinstance(expr, sp.GreaterThan):
        return f"{_compact(expr.lhs)} >= {_compact(expr.rhs)}"
    if isinstance(expr, sp.LessThan):
        return f"{_compact(expr.lhs)} <= {_compact(expr.rhs)}"
    return _compact(expr)


def display_system(relations: list) -> str:
    return "\n".join(display_math(item) for item in relations)


def value_string(expr) -> str:
    simplified = sp.simplify(expr)
    if simplified == sp.I:
        return "i"
    if simplified == -sp.I:
        return "-i"
    if simplified.is_Integer:
        return str(simplified)
    if simplified.is_Rational:
        return str(simplified)
    return str(simplified)


def assignment_latex(variable, value) -> str:
    return sp.latex(sp.Eq(variable, sp.simplify(value), evaluate=False))


def _compact(expr) -> str:
    text = sp.sstr(sp.simplify(expr))
    text = text.replace("**", "^")
    text = re.sub(r"(?<=\d)\*(?=[A-Za-z(])", "", text)
    text = re.sub(r"(?<=\))\*(?=[A-Za-z0-9(])", "", text)
    text = text.replace("^2", "²").replace("^3", "³")
    text = text.replace("sqrt", "√")
    return text
