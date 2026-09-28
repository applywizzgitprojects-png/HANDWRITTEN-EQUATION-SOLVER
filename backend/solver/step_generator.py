"""Generate mathematically equivalent solution steps from SymPy expressions."""

import sympy as sp

from .formatter import to_latex

_FALLBACK = (
    "Solution found symbolically. Detailed transformation steps are not available for this equation type."
)


def generate_steps(relations: list, classification: dict, solution_latex: str, solution_values=None) -> list[dict]:
    equation_type = classification["equation_type"]
    symbols = classification["symbols"]
    try:
        if equation_type == "expression" and len(relations) == 1:
            return _expression_steps(relations[0])
        if equation_type == "inequality" and len(relations) == 1 and len(symbols) == 1:
            return _inequality_steps(relations[0], symbols[0])
        if equation_type == "linear_equation" and len(relations) == 1 and len(symbols) == 1:
            return _linear_steps(relations[0], symbols[0])
        if equation_type in {"quadratic_equation", "polynomial_equation"} and len(symbols) == 1:
            return _polynomial_steps(relations[0], symbols[0], solution_values or [])
        if equation_type == "simultaneous_linear_equations" and len(relations) == 2 and len(symbols) == 2:
            return _system_steps(relations, symbols, solution_values or [])
    except Exception:
        return _fallback(relations, solution_latex)
    return _fallback(relations, solution_latex)


def _pack(items: list[tuple[str, str]]) -> list[dict]:
    return [
        {"step": index, "latex": latex, "description": description}
        for index, (latex, description) in enumerate(items, start=1)
    ]


def _expression_steps(expr) -> list[dict]:
    value = sp.simplify(expr)
    return _pack([
        (to_latex(expr), "Original expression"),
        (to_latex(value), "Evaluate"),
    ])


def _linear_steps(equation, variable) -> list[dict]:
    rhs = equation.rhs
    if rhs.has(variable):
        return _linear_steps(sp.Eq(sp.expand(equation.lhs - equation.rhs), 0, evaluate=False), variable)
    polynomial = sp.Poly(sp.expand(equation.lhs), variable)
    if polynomial.degree() != 1:
        raise ValueError("not a monic linear left-hand side")
    coefficient = polynomial.coeff_monomial(variable)
    constant = polynomial.coeff_monomial(1)
    items = [(to_latex(equation), "Original equation")]
    if constant != 0:
        moved_rhs = sp.Add(rhs, -constant, evaluate=False)
        moved = sp.Eq(coefficient * variable, moved_rhs, evaluate=False)
        items.append((to_latex(moved), "Move the constant to the other side"))
        simplified_rhs = sp.simplify(rhs - constant)
        simplified = sp.Eq(coefficient * variable, simplified_rhs, evaluate=False)
        if to_latex(simplified) != to_latex(moved):
            items.append((to_latex(simplified), "Simplify"))
        isolated_rhs = simplified_rhs
    else:
        isolated_rhs = rhs
    if coefficient != 1:
        solution = sp.simplify(isolated_rhs / coefficient)
        items.append((
            to_latex(sp.Eq(variable, solution, evaluate=False)),
            "Divide both sides by the coefficient",
        ))
    else:
        items.append((
            to_latex(sp.Eq(variable, sp.simplify(isolated_rhs), evaluate=False)),
            "Solve for the variable",
        ))
    return _pack(items)


def _polynomial_steps(equation, variable, solutions: list) -> list[dict]:
    expr = sp.expand(equation.lhs - equation.rhs)
    factored = sp.factor(expr)
    if sp.expand(factored - expr) != 0:
        raise ValueError("factorization did not preserve the polynomial")
    items = [(to_latex(equation), "Original equation")]
    if factored != expr:
        factor_label = "Factor the quadratic" if sp.degree(expr, variable) == 2 else "Factor the polynomial"
        items.append((to_latex(sp.Eq(factored, 0, evaluate=False)), factor_label))
        factors = _nonconstant_factors(factored)
        if len(factors) == 1:
            items.append((to_latex(sp.Eq(factors[0], 0, evaluate=False)), "Set the factor equal to zero"))
        else:
            for factor in factors:
                items.append((to_latex(sp.Eq(factor, 0, evaluate=False)), "Set the factor equal to zero"))
        for value in solutions:
            items.append((
                to_latex(sp.Eq(variable, sp.simplify(value), evaluate=False)),
                "Solve for the variable",
            ))
        return _pack(items)

    polynomial = sp.Poly(expr, variable)
    if polynomial.degree() != 2:
        raise ValueError("no reliable factor steps")
    a, b, c = polynomial.all_coeffs()
    discriminant = sp.simplify(b ** 2 - 4 * a * c)
    items.append((
        to_latex(sp.Eq(sp.Symbol("\\Delta"), discriminant, evaluate=False)) if False else
        rf"\Delta = {to_latex(discriminant)}",
        "Compute the discriminant",
    ))
    formula = rf"{to_latex(variable)} = \frac{{-{to_latex(b)} \pm \sqrt{{{to_latex(discriminant)}}}}}{{{to_latex(2 * a)}}}"
    items.append((formula, "Apply the quadratic formula"))
    if discriminant.is_real and discriminant < 0:
        items.append((to_latex(sp.EmptySet), "The discriminant is negative, so there is no real solution"))
        return _pack(items)
    for value in solutions:
        items.append((
            to_latex(sp.Eq(variable, sp.simplify(value), evaluate=False)),
            "Simplify",
        ))
    return _pack(items)


def _inequality_steps(relation, variable) -> list[dict]:
    polynomial = sp.Poly(sp.expand(relation.lhs), variable)
    if polynomial.degree() != 1 or relation.rhs.has(variable):
        raise ValueError("inequality is not linear in standard form")
    coefficient = polynomial.coeff_monomial(variable)
    constant = polynomial.coeff_monomial(1)
    items = [(to_latex(relation), "Original inequality")]
    moved_rhs = sp.simplify(relation.rhs - constant)
    moved = _replace_sides(relation, coefficient * variable, relation.rhs - constant if False else moved_rhs)
    if constant != 0:
        unsimplified = _replace_sides(relation, coefficient * variable, sp.Add(relation.rhs, -constant, evaluate=False))
        items.append((to_latex(unsimplified), "Move the constant to the other side"))
        if to_latex(moved) != to_latex(unsimplified):
            items.append((to_latex(moved), "Simplify"))
    flip = coefficient.is_real and coefficient < 0
    solution_rhs = sp.simplify(moved_rhs / coefficient)
    solved = _replace_sides(relation, variable, solution_rhs, flip=flip)
    items.append((
        to_latex(solved),
        "Divide both sides and reverse the inequality" if flip else "Divide both sides by the coefficient",
    ))
    return _pack(items)


def _system_steps(equations: list, variables: list, solutions: list) -> list[dict]:
    if len(solutions) != 2:
        raise ValueError("expected one value per variable")
    x, y = variables
    a1, b1, c1 = _standard_linear(equations[0], x, y)
    a2, b2, c2 = _standard_linear(equations[1], x, y)
    items = [(
        rf"{to_latex(equations[0])} \\ {to_latex(equations[1])}",
        "Original system",
    )]
    if b1 == 0 and b2 == 0:
        raise ValueError("cannot eliminate a missing variable")
    elim_x_coeff = sp.simplify(a1 * b2 - a2 * b1)
    elim_rhs = sp.simplify(c1 * b2 - c2 * b1)
    if elim_x_coeff == 0:
        raise ValueError("variables did not eliminate cleanly")
    items.append((
        to_latex(sp.Eq(elim_x_coeff * x, elim_rhs, evaluate=False)),
        "Eliminate the second variable",
    ))
    x_value = sp.simplify(elim_rhs / elim_x_coeff)
    if sp.simplify(x_value - solutions[0]) != 0:
        raise ValueError("elimination did not match the solved value")
    items.append((to_latex(sp.Eq(x, x_value, evaluate=False)), "Solve for the first variable"))
    substituted = sp.Eq(sp.simplify(a1 * x_value + b1 * y), c1, evaluate=False)
    items.append((to_latex(substituted), "Substitute into the first equation"))
    y_value = sp.simplify(solutions[1])
    items.append((to_latex(sp.Eq(y, y_value, evaluate=False)), "Solve for the second variable"))
    return _pack(items)


def _fallback(relations: list, solution_latex: str) -> list[dict]:
    original = " \\\\ ".join(to_latex(item) for item in relations)
    return _pack([
        (original, "Original problem"),
        (solution_latex or original, _FALLBACK),
    ])


def _nonconstant_factors(expr) -> list:
    pieces = expr.args if isinstance(expr, sp.Mul) else (expr,)
    factors = []
    for piece in pieces:
        if piece.is_number:
            continue
        if isinstance(piece, sp.Pow) and piece.exp.is_Integer and piece.exp > 0:
            factors.append(piece.base)
        else:
            factors.append(piece)
    return factors or [expr]


def _replace_sides(relation, left, right, flip: bool = False):
    kind = type(relation)
    if flip:
        flipped = {
            sp.StrictLessThan: sp.StrictGreaterThan,
            sp.StrictGreaterThan: sp.StrictLessThan,
            sp.LessThan: sp.GreaterThan,
            sp.GreaterThan: sp.LessThan,
        }
        kind = flipped.get(kind, kind)
    return kind(left, right, evaluate=False)


def _standard_linear(equation, x, y):
    polynomial = sp.Poly(sp.expand(equation.lhs - equation.rhs), x, y)
    return (
        polynomial.coeff_monomial(x),
        polynomial.coeff_monomial(y),
        -polynomial.coeff_monomial(1),
    )
