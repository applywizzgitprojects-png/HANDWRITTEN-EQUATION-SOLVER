"""Solve classified SymPy problems. Results come only from SymPy."""

import sympy as sp

from .errors import SolverError
from .formatter import assignment_latex, to_latex, value_string
from .step_generator import generate_steps

_INFINITE = "This equation has infinitely many solutions."
_NO_REAL = "This equation has no real solution."
_NO_SOLUTION = "This equation has no solution."
_UNSUPPORTED = "This equation type is currently not supported."


def solve_problem(relations: list, classification: dict, allow_complex: bool = False) -> dict:
    equation_type = classification["equation_type"]
    symbols = classification["symbols"]
    if equation_type == "unsupported":
        raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)

    if equation_type == "expression":
        return _solve_expression(relations[0], classification)
    if equation_type == "inequality":
        return _solve_inequalities(relations, symbols, classification)
    equations = [item for item in relations if isinstance(item, sp.Equality)]
    if len(symbols) == 0 and len(equations) == 1:
        return _solve_constant(equations[0], classification)
    if len(equations) > 1 or len(symbols) > 1:
        return _solve_system(equations, symbols, classification)
    if len(equations) == 1 and len(symbols) == 1:
        return _solve_single(equations[0], symbols[0], classification, allow_complex)
    raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)


def assert_defined(relations: list) -> None:
    for relation in relations:
        for node in sp.preorder_traversal(relation):
            if isinstance(node, sp.Pow) and getattr(node.exp, "is_number", False) and node.exp.is_real and node.exp < 0:
                if sp.simplify(node.base) == 0:
                    raise SolverError("DIVISION_BY_ZERO", "This expression divides by zero.")


def _solve_expression(expr, classification: dict) -> dict:
    if expr.free_symbols:
        value = sp.simplify(expr)
    else:
        value = sp.simplify(expr)
        if value.is_number:
            value = sp.nsimplify(value)
    rendered = value_string(value) if not value.free_symbols else to_latex(value)
    steps = generate_steps([expr], classification, rendered)
    return _success(
        classification,
        solution=[rendered],
        solution_latex=to_latex(value),
        steps=steps,
        verification={
            "verified": True,
            "solution_status": "verified",
            "message": "Expression evaluated.",
        },
        solution_status="verified",
    )


def _solve_constant(equation, classification: dict) -> dict:
    if sp.simplify(equation.lhs - equation.rhs) == 0:
        return _infinite(classification, "\\mathbb{R}")
    return _none(classification, _NO_SOLUTION, [])


def _solve_single(equation, variable, classification: dict, allow_complex: bool) -> dict:
    domain = sp.S.Complexes if allow_complex else sp.S.Reals
    solution_set = sp.solveset(equation, variable, domain=domain)
    kind, values = _interpret_set(solution_set, [variable])
    if kind == "infinite":
        return _infinite(classification, to_latex(solution_set))
    if kind == "empty":
        complex_values = []
        if not allow_complex:
            complex_set = sp.solveset(equation, variable, domain=sp.S.Complexes)
            complex_kind, complex_values = _interpret_set(complex_set, [variable])
            if complex_kind != "finite":
                complex_values = []
        if complex_values:
            return _none(
                classification,
                _NO_REAL,
                _format_values(variable, complex_values),
            )
        return _none(classification, _NO_SOLUTION, [])
    if kind == "conditional":
        numeric = _numeric_fallback(equation, variable)
        if numeric is None:
            raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)
        values = [numeric]
        kind = "finite"
    if kind == "set":
        latex = rf"{to_latex(variable)} \in {to_latex(solution_set)}"
        samples = _samples(solution_set)
        verification = _verify_values(equation, variable, samples) if samples else {
            "verified": False,
            "solution_status": "not_applicable",
            "message": "Verification is not available for this solution form.",
        }
        steps = generate_steps([equation], classification, latex, samples)
        return _success(
            classification,
            solution=[to_latex(solution_set)],
            solution_latex=latex,
            steps=steps,
            verification=verification,
            solution_status=verification["solution_status"],
        )
    if kind != "finite":
        raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)

    values = _sort_values(values)
    verification = _verify_values(equation, variable, values)
    if not verification["verified"]:
        raise SolverError("SOLVER_FAILURE", "Unable to solve the recognized expression.")
    solution = [value_string(value) for value in values]
    solution_latex = ", ".join(assignment_latex(variable, value) for value in values)
    steps = generate_steps([equation], classification, solution_latex, values)
    return _success(
        classification,
        solution=solution,
        solution_latex=solution_latex,
        steps=steps,
        verification=verification,
        solution_status="verified",
    )


def _solve_system(equations: list, symbols: list, classification: dict) -> dict:
    if not equations:
        raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)
    linear = classification["equation_type"] == "simultaneous_linear_equations" or (
        classification["equation_type"] == "linear_equation" and len(symbols) > 1
    )
    try:
        solution_set = sp.linsolve(equations, symbols) if linear else sp.nonlinsolve(equations, symbols)
    except Exception as exc:
        raise SolverError("SOLVER_FAILURE", "Unable to solve the recognized expression.") from exc
    if solution_set == sp.EmptySet or not solution_set:
        return _none(classification, _NO_SOLUTION, [])
    tuples = list(solution_set)
    if len(tuples) != 1 and linear:
        tuples = list(solution_set)
    parametric = False
    assignments = []
    for candidate in tuples:
        if any(expr.free_symbols for expr in candidate):
            parametric = True
            break
        assignments.append(dict(zip(symbols, candidate)))
    if parametric or not assignments:
        rendered = to_latex(solution_set)
        return _infinite(classification, rendered)
    if len(assignments) != 1 and not linear:
        # A finite list of tuples is a real solution set.
        pass
    verification = _verify_system(equations, assignments)
    if not verification["verified"]:
        raise SolverError("SOLVER_FAILURE", "Unable to solve the recognized expression.")
    solution = []
    latex_parts = []
    for assignment in assignments:
        for symbol in symbols:
            text = f"{symbol.name} = {value_string(assignment[symbol])}"
            solution.append(text)
            latex_parts.append(assignment_latex(symbol, assignment[symbol]))
    solution_latex = ", ".join(latex_parts)
    ordered_values = [assignments[0][symbol] for symbol in symbols] if len(assignments) == 1 else []
    steps = generate_steps(equations, classification, solution_latex, ordered_values)
    return _success(
        classification,
        solution=solution,
        solution_latex=solution_latex,
        steps=steps,
        verification=verification,
        solution_status="verified",
    )


def _solve_inequalities(relations: list, symbols: list, classification: dict) -> dict:
    if len(symbols) != 1 or len(relations) != 1:
        raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED)
    variable = symbols[0]
    try:
        reduced = sp.reduce_inequalities(relations, [variable])
    except Exception as exc:
        raise SolverError("UNSUPPORTED_EQUATION", _UNSUPPORTED) from exc
    if reduced == False:
        return _none(classification, _NO_SOLUTION, [])
    if reduced == True:
        return _infinite(classification, to_latex(sp.S.Reals))
    display = _canonical_relation(_simplify_inequality(reduced, variable), variable)
    solution_latex = to_latex(display)
    point = _sample_inside(reduced, variable)
    outside = _sample_outside(reduced, variable)
    verified = point is not None and bool(relations[0].subs(variable, point))
    if outside is not None and bool(relations[0].subs(variable, outside)):
        verified = False
    verification = {
        "verified": verified,
        "solution_status": "verified" if verified else "verification_failed",
        "message": "Solution satisfies the inequality." if verified else "The solution could not be verified.",
    }
    if not verified:
        raise SolverError("SOLVER_FAILURE", "Unable to solve the recognized expression.")
    steps = generate_steps(relations, classification, solution_latex)
    return _success(
        classification,
        solution=[solution_latex.replace(" ", "") if False else _plain_inequality(display)],
        solution_latex=solution_latex,
        steps=steps,
        verification=verification,
        solution_status="verified",
    )


def _numeric_fallback(equation, variable):
    expr = sp.simplify(equation.lhs - equation.rhs)
    for guess in (-5, -2, -1, 0, 1, 2, 5, 10):
        try:
            root = sp.nsolve(expr, variable, guess)
        except Exception:
            continue
        exact = sp.nsimplify(root, rational=True, tolerance=1e-8)
        if exact.free_symbols:
            continue
        if _is_zero(expr.subs(variable, exact)):
            return exact
    return None


def _interpret_set(solution_set, variables: list):
    if solution_set in (sp.S.Reals, sp.S.Complexes) or solution_set == sp.S.Reals:
        return "infinite", []
    if solution_set == sp.EmptySet or getattr(solution_set, "is_empty", False):
        return "empty", []
    if isinstance(solution_set, sp.FiniteSet):
        values = list(solution_set)
        if any(value.free_symbols for value in values):
            return "infinite", []
        return "finite", values
    if isinstance(solution_set, sp.ConditionSet):
        return "conditional", []
    if isinstance(solution_set, (sp.Union, sp.ImageSet, sp.Intersection)):
        return "set", []
    return "unknown", []


def _verify_values(equation, variable, values: list) -> dict:
    for value in values:
        if not _is_zero(sp.simplify(equation.lhs - equation.rhs).subs(variable, value)):
            return {
                "verified": False,
                "solution_status": "verification_failed",
                "message": "The solution does not satisfy the original equation.",
            }
    if not values:
        return {"verified": False, "solution_status": "not_applicable", "message": None}
    message = "Solution satisfies the equation."
    if any(value.free_symbols for value in values):
        message = "Representative solutions satisfy the equation."
    return {"verified": True, "solution_status": "verified", "message": message}


def _verify_system(equations: list, assignments: list[dict]) -> dict:
    for assignment in assignments:
        for equation in equations:
            if not _is_zero(sp.simplify(equation.lhs - equation.rhs).subs(assignment)):
                return {
                    "verified": False,
                    "solution_status": "verification_failed",
                    "message": "The solution does not satisfy every equation.",
                }
    return {
        "verified": True,
        "solution_status": "verified",
        "message": "Solution satisfies every equation.",
    }


def _samples(solution_set, limit: int = 2) -> list:
    if isinstance(solution_set, sp.ImageSet):
        lam = solution_set.lamda
        parameter = lam.variables[0]
        return [lam.expr.subs(parameter, k) for k in range(limit)]
    if isinstance(solution_set, sp.Union):
        values = []
        for part in solution_set.args:
            values.extend(_samples(part, 1))
        return values
    if isinstance(solution_set, sp.FiniteSet):
        return list(solution_set)
    return []


def _format_values(variable, values: list) -> list[str]:
    return [assignment_latex(variable, value) for value in _sort_values(values)]


def _sort_values(values: list) -> list:
    def key(value):
        try:
            return (0, float(value))
        except Exception:
            return (1, str(value))
    return sorted(values, key=key)


def _canonical_relation(expr, variable):
    flipped = {
        sp.StrictLessThan: sp.StrictGreaterThan,
        sp.LessThan: sp.GreaterThan,
        sp.StrictGreaterThan: sp.StrictLessThan,
        sp.GreaterThan: sp.LessThan,
    }
    kind = type(expr)
    if kind in flipped and getattr(expr.lhs, "is_number", False) and expr.rhs == variable:
        return flipped[kind](variable, expr.lhs, evaluate=False)
    return expr


def _simplify_inequality(reduced, variable):
    if isinstance(reduced, sp.And):
        parts = []
        for arg in reduced.args:
            if arg.has(sp.oo) or arg.has(-sp.oo):
                continue
            parts.append(arg)
        if len(parts) == 1:
            return parts[0]
        if parts:
            return sp.And(*parts)
    return reduced


def _plain_inequality(expr) -> str:
    return to_latex(expr)


def _sample_inside(reduced, variable):
    region = _inequality_set(reduced, variable)
    return _sample_set(region)


def _sample_outside(reduced, variable):
    region = _inequality_set(reduced, variable)
    if region is None:
        return None
    return _sample_set(sp.S.Reals - region)


def _inequality_set(reduced, variable):
    try:
        if hasattr(reduced, "as_set"):
            return reduced.as_set()
    except Exception:
        return None
    return None


def _sample_set(region):
    if region is None or region == sp.EmptySet:
        return None
    if isinstance(region, sp.Interval):
        if region.inf.is_infinite and region.sup.is_infinite:
            return sp.Integer(0)
        if region.sup.is_infinite:
            return sp.ceiling(region.inf) + 1
        if region.inf.is_infinite:
            return sp.floor(region.sup) - 1
        return sp.simplify((region.inf + region.sup) / 2)
    if isinstance(region, sp.FiniteSet) and region:
        return next(iter(region))
    return None


def _is_zero(expr) -> bool:
    value = sp.simplify(expr)
    if value == 0 or value == sp.true:
        return True
    if getattr(value, "free_symbols", None):
        return False
    try:
        return abs(complex(value.evalf())) < 1e-8
    except Exception:
        return False


def _success(classification, solution, solution_latex, steps, verification, solution_status) -> dict:
    return {
        "success": True,
        "solution": solution,
        "solution_latex": solution_latex,
        "steps": steps,
        "verification": verification,
        "solution_status": solution_status,
        "message": None,
        "complex_solutions": None,
        "classification": classification,
    }


def _none(classification, message: str, complex_solutions: list[str]) -> dict:
    return {
        "success": True,
        "solution": [],
        "solution_latex": "",
        "steps": [{
            "step": 1,
            "latex": message,
            "description": message,
        }],
        "verification": {
            "verified": False,
            "solution_status": "no_real_solution",
            "message": message,
        },
        "solution_status": "no_real_solution",
        "message": message,
        "complex_solutions": complex_solutions or None,
        "classification": classification,
    }


def _infinite(classification, solution_latex: str) -> dict:
    return {
        "success": True,
        "solution": [],
        "solution_latex": solution_latex,
        "steps": [{
            "step": 1,
            "latex": solution_latex,
            "description": _INFINITE,
        }],
        "verification": {
            "verified": False,
            "solution_status": "infinite",
            "message": _INFINITE,
        },
        "solution_status": "infinite",
        "message": _INFINITE,
        "complex_solutions": None,
        "classification": classification,
    }
