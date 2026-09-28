"""Parse normalized arithmetic into SymPy objects without eval or exec."""

import re

import sympy as sp

from .errors import SolverError

_FUNCTIONS = {"sin", "cos", "tan", "log", "ln", "exp", "sqrt", "abs"}
_RELATIONS = {"=", "<", ">", "<=", ">=", "!="}

_SYMBOL_NAMES = {
    "alpha", "beta", "gamma", "delta", "epsilon", "theta",
    "lambda", "mu", "sigma", "omega", "phi",
}

_TOKEN = re.compile(
    r"[ \t]+"
    r"|(?P<num>\d+(?:\.\d+)?)"
    r"|(?P<ident>[A-Za-z][A-Za-z0-9_]*)"
    r"|(?P<op>\*\*|<=|>=|!=|[+\-*/=<>])"
    r"|(?P<lp>\()"
    r"|(?P<rp>\))"
    r"|(?P<comma>,)"
    r"|(?P<sep>\n|;)"
)


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]]):
        self.tokens = tokens
        self.index = 0

    def parse(self) -> list:
        self._skip_separators()
        if self._end():
            raise SolverError(
                "MALFORMED_LATEX",
                "Unable to solve because the recognized equation appears incomplete.",
            )
        relations = [self._parse_relation()]
        while not self._end():
            if not self._match_separator():
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            self._skip_separators()
            if self._end():
                break
            relations.append(self._parse_relation())
        return relations

    def _parse_relation(self):
        left = self._parse_expr()
        if self._peek_kind() == "op" and self._peek_value() in _RELATIONS:
            op = self._pop()[1]
            right = self._parse_expr()
            if self._peek_kind() == "op" and self._peek_value() in _RELATIONS:
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            return _relation(op, left, right)
        return left

    def _parse_expr(self):
        node = self._parse_term()
        while self._peek_value() in {"+", "-"}:
            op = self._pop()[1]
            right = self._parse_term()
            node = node + right if op == "+" else node - right
        return node

    def _parse_term(self):
        node = self._parse_unary()
        while self._peek_value() in {"*", "/"}:
            op = self._pop()[1]
            right = self._parse_unary()
            if op == "*":
                node = node * right
            else:
                if _is_literal_zero(right):
                    raise SolverError(
                        "DIVISION_BY_ZERO",
                        "This expression divides by zero.",
                    )
                node = node / right
        return node

    def _parse_unary(self):
        if self._peek_value() in {"+", "-"}:
            op = self._pop()[1]
            value = self._parse_unary()
            return value if op == "+" else -value
        return self._parse_power()

    def _parse_power(self):
        base = self._parse_primary()
        if self._peek_value() == "**":
            self._pop()
            exponent = self._parse_unary()
            return base ** exponent
        return base

    def _parse_primary(self):
        kind, value = self._peek()
        if kind == "num":
            self._pop()
            if "." in value:
                return sp.Float(value)
            return sp.Integer(value)
        if kind == "ident":
            self._pop()
            if value == "pi":
                return sp.pi
            if value == "oo":
                return sp.oo
            if value == "e" and self._peek_value() == "**":
                return sp.E
            if value in _FUNCTIONS:
                return self._parse_call(value)
            if not _is_symbol_name(value):
                raise SolverError(
                    "UNSUPPORTED_EQUATION",
                    "This equation type is currently not supported.",
                )
            return sp.Symbol(value)
        if kind == "lp":
            self._pop()
            node = self._parse_expr()
            if self._peek_kind() != "rp":
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            self._pop()
            return node
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )

    def _parse_call(self, name: str):
        if self._peek_kind() == "lp":
            self._pop()
            args = [self._parse_expr()]
            while self._peek_kind() == "comma":
                self._pop()
                args.append(self._parse_expr())
            if self._peek_kind() != "rp":
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            self._pop()
            return _apply(name, args)
        argument = self._parse_power()
        return _apply(name, [argument])

    def _skip_separators(self) -> None:
        while self._peek_kind() == "sep":
            self._pop()

    def _match_separator(self) -> bool:
        if self._peek_kind() == "sep":
            self._pop()
            return True
        return False

    def _peek(self) -> tuple[str, str]:
        if self._end():
            return ("eof", "")
        return self.tokens[self.index]

    def _peek_kind(self) -> str:
        return self._peek()[0]

    def _peek_value(self) -> str:
        return self._peek()[1]

    def _pop(self) -> tuple[str, str]:
        token = self.tokens[self.index]
        self.index += 1
        return token

    def _end(self) -> bool:
        return self.index >= len(self.tokens)


def parse_normalized(text: str) -> list:
    tokens = []
    pos = 0
    while pos < len(text):
        match = _TOKEN.match(text, pos)
        if not match:
            raise SolverError(
                "MALFORMED_LATEX",
                "Unable to solve because the recognized equation appears incomplete.",
            )
        pos = match.end()
        if match.lastgroup:
            tokens.append((match.lastgroup, match.group(match.lastgroup)))
    return _Parser(tokens).parse()


def free_variables(relations: list) -> list[sp.Symbol]:
    found = set()
    for item in relations:
        found |= set(item.free_symbols)
    ignored = {sp.pi, sp.E, sp.oo, -sp.oo}
    return sorted((symbol for symbol in found if symbol not in ignored), key=lambda s: s.name)


def _relation(op: str, left, right):
    if op == "=":
        return sp.Eq(left, right, evaluate=False)
    if op == "<":
        return sp.StrictLessThan(left, right, evaluate=False)
    if op == ">":
        return sp.StrictGreaterThan(left, right, evaluate=False)
    if op == "<=":
        return sp.LessThan(left, right, evaluate=False)
    if op == ">=":
        return sp.GreaterThan(left, right, evaluate=False)
    if op == "!=":
        return sp.Ne(left, right, evaluate=False)
    raise SolverError(
        "UNSUPPORTED_EQUATION",
        "This equation type is currently not supported.",
    )


def _apply(name: str, args: list):
    if name == "sin" and len(args) == 1:
        return sp.sin(args[0])
    if name == "cos" and len(args) == 1:
        return sp.cos(args[0])
    if name == "tan" and len(args) == 1:
        return sp.tan(args[0])
    if name == "ln" and len(args) == 1:
        return sp.log(args[0])
    if name == "log" and len(args) == 1:
        return sp.log(args[0], 10)
    if name == "log" and len(args) == 2:
        return sp.log(args[0], args[1])
    if name == "exp" and len(args) == 1:
        return sp.exp(args[0])
    if name == "sqrt" and len(args) == 1:
        return sp.sqrt(args[0])
    if name == "abs" and len(args) == 1:
        return sp.Abs(args[0])
    raise SolverError(
        "UNSUPPORTED_EQUATION",
        "This equation type is currently not supported.",
    )


def _is_symbol_name(name: str) -> bool:
    if name in _SYMBOL_NAMES:
        return True
    if re.fullmatch(r"[A-Za-z]", name):
        return True
    return re.fullmatch(r"[A-Za-z]_[A-Za-z0-9]+", name) is not None


def _is_literal_zero(expr) -> bool:
    return getattr(expr, "is_number", False) and expr == 0
