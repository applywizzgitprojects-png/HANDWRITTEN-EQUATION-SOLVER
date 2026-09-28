"""Convert recognized LaTeX into normalized arithmetic text.

The result uses explicit ** and * operators, for example
``x**2 + 2*x + 1 = 0``. Nothing in this module executes user input.
"""

import re

from .errors import SolverError

_FUNCS = {"sin", "cos", "tan", "log", "ln", "exp", "sqrt", "abs"}
_GREEK = {
    "alpha", "beta", "gamma", "delta", "epsilon", "theta",
    "lambda", "mu", "sigma", "omega", "phi", "pi",
}
_STRIP = {
    "left", "right", "displaystyle", "text", "mathrm", "mathbf",
    "bigl", "bigr", "Bigl", "Bigr", "limits", "nolimits", "quad", "qquad",
}
_ALLOWED = _FUNCS | _GREEK | _STRIP | {
    "frac", "dfrac", "tfrac", "sqrt", "cdot", "times", "div",
    "leq", "geq", "le", "ge", "neq", "ne", "infty",
}

_UNICODE = {
    "²": "^{2}",
    "³": "^{3}",
    "¹": "^{1}",
    "⁴": "^{4}",
    "⁵": "^{5}",
    "√": r"\sqrt",
    "×": r"\times",
    "·": r"\cdot",
    "−": "-",
    "–": "-",
    "—": "-",
    "≤": r"\leq",
    "≥": r"\geq",
    "≠": r"\neq",
    "π": r"\pi",
    "∞": r"\infty",
}


def latex_to_normalized(source: str) -> str:
    text = _apply_unicode(source)
    text = text.replace("$$", "").replace("$", "")
    text = text.replace(r"\[", "").replace(r"\]", "")
    text = text.replace(r"\(", "").replace(r"\)", "")
    parts = _split_statements(text)
    if not parts:
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    normalized = [_insert_implicit_multiplication(_convert(part)) for part in parts]
    return "\n".join(normalized)


def _apply_unicode(text: str) -> str:
    for src, dst in _UNICODE.items():
        text = text.replace(src, dst)
    return text


def _split_statements(text: str) -> list[str]:
    text = text.replace("\\\\", "\n")
    parts = re.split(r"[\n;]+", text)
    return [part.strip() for part in parts if part.strip()]


def _convert(source: str) -> str:
    out: list[str] = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch.isspace():
            if out and not out[-1].endswith(" "):
                out.append(" ")
            i += 1
            continue
        if ch == "\\":
            name, i = _read_command(source, i)
            if name == "\\":
                out.append("\n")
                continue
            if not any(char.isalpha() for char in name):
                continue
            if name in {"cdot", "times"}:
                out.append("*")
                continue
            if name == "div":
                out.append("/")
                continue
            if name in {"leq", "le"}:
                out.append("<=")
                continue
            if name in {"geq", "ge"}:
                out.append(">=")
                continue
            if name in {"neq", "ne"}:
                out.append("!=")
                continue
            if name == "infty":
                out.append("oo")
                continue
            if name == "pm":
                raise SolverError(
                    "UNSUPPORTED_EQUATION",
                    "The plus-minus symbol is not supported. Enter each case separately.",
                )
            if name in {"frac", "dfrac", "tfrac"}:
                i = _skip_ws(source, i)
                numerator, i = _read_braces(source, i)
                i = _skip_ws(source, i)
                denominator, i = _read_braces(source, i)
                out.append(f"(({_convert(numerator)})/({_convert(denominator)}))")
                continue
            if name == "sqrt":
                i = _skip_ws(source, i)
                root = None
                if i < n and source[i] == "[":
                    end = source.find("]", i)
                    if end < 0:
                        raise SolverError(
                            "MALFORMED_LATEX",
                            "Unable to solve because the recognized equation appears incomplete.",
                        )
                    root = source[i + 1:end]
                    i = _skip_ws(source, end + 1)
                body, i = _read_braces(source, i)
                inner = _convert(body)
                if root is None:
                    out.append(f"sqrt({inner})")
                else:
                    out.append(f"(({inner})**(1/({_convert(root)})))")
                continue
            if name not in _ALLOWED and name not in _GREEK and name not in _FUNCS:
                raise SolverError(
                    "UNSUPPORTED_EQUATION",
                    "This equation type is currently not supported.",
                )
            if name == "pi":
                out.append("pi")
                continue
            if name in _GREEK:
                out.append(name)
                continue
            if name in _STRIP:
                i = _skip_ws(source, i)
                if i < n and source[i] == "{":
                    inner, i = _read_braces(source, i)
                    out.append(_convert(inner))
                continue
            base = None
            i = _skip_ws(source, i)
            if name == "log" and i < n and source[i] == "_":
                i += 1
                i = _skip_ws(source, i)
                if i < n and source[i] == "{":
                    base, i = _read_braces(source, i)
                elif i < n and source[i].isalnum():
                    base = source[i]
                    i += 1
                i = _skip_ws(source, i)
            if i < n and source[i] in "{(":
                if source[i] == "{":
                    arg, i = _read_braces(source, i)
                else:
                    arg, i = _read_parens(source, i)
                rendered = _convert(arg)
                if name == "log" and base is not None:
                    out.append(f"log({rendered},{_convert(base)})")
                else:
                    out.append(f"{'ln' if name == 'ln' else name}({rendered})")
            else:
                out.append("ln" if name == "ln" else name)
            continue
        if ch == "^":
            i = _skip_ws(source, i + 1)
            if i >= n:
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            if source[i] == "{":
                exponent, i = _read_braces(source, i)
                out.append(f"**({_convert(exponent)})")
            elif source[i] == "(":
                exponent, i = _read_parens(source, i)
                out.append(f"**({_convert(exponent)})")
            else:
                out.append("**" + source[i])
                i += 1
            continue
        if ch == "_":
            i = _skip_ws(source, i + 1)
            if i < n and source[i] == "{":
                sub, i = _read_braces(source, i)
                sub_text = re.sub(r"\s+", "", _convert(sub))
            elif i < n and source[i].isalnum():
                sub_text = source[i]
                i += 1
            else:
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            if not re.fullmatch(r"[A-Za-z0-9]+", sub_text):
                raise SolverError(
                    "UNSUPPORTED_EQUATION",
                    "This equation type is currently not supported.",
                )
            if not out:
                raise SolverError(
                    "MALFORMED_LATEX",
                    "Unable to solve because the recognized equation appears incomplete.",
                )
            out[-1] = out[-1].rstrip() + "_" + sub_text
            continue
        if ch == "{":
            inner, i = _read_braces(source, i)
            out.append(f"({_convert(inner)})")
            continue
        if ch in "}]":
            raise SolverError(
                "MALFORMED_LATEX",
                "The recognized equation has unbalanced braces.",
            )
        out.append(ch)
        i += 1
    return "".join(out).strip()


def _read_command(source: str, i: int) -> tuple[str, int]:
    i += 1
    if i >= len(source):
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    if source[i] == "\\":
        return "\\", i + 1
    if not source[i].isalpha():
        return source[i], i + 1
    j = i
    while j < len(source) and source[j].isalpha():
        j += 1
    return source[i:j], j


def _read_braces(source: str, i: int) -> tuple[str, int]:
    if i >= len(source) or source[i] != "{":
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    depth = 0
    for j in range(i, len(source)):
        if source[j] == "{":
            depth += 1
        elif source[j] == "}":
            depth -= 1
            if depth == 0:
                return source[i + 1:j], j + 1
    raise SolverError(
        "MALFORMED_LATEX",
        "The recognized equation has unbalanced braces.",
    )


def _read_parens(source: str, i: int) -> tuple[str, int]:
    if i >= len(source) or source[i] != "(":
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    depth = 0
    for j in range(i, len(source)):
        if source[j] == "(":
            depth += 1
        elif source[j] == ")":
            depth -= 1
            if depth == 0:
                return source[i + 1:j], j + 1
    raise SolverError(
        "MALFORMED_LATEX",
        "Unable to solve because the recognized equation appears incomplete.",
    )


def _skip_ws(source: str, i: int) -> int:
    while i < len(source) and source[i].isspace():
        i += 1
    return i


_TOKEN = re.compile(
    r"\s+"
    r"|(?P<num>\d+(?:\.\d+)?)"
    r"|(?P<ident>[A-Za-z][A-Za-z0-9_]*)"
    r"|(?P<op>\*\*|<=|>=|!=|[+\-*/=<>])"
    r"|(?P<lp>\()"
    r"|(?P<rp>\))"
    r"|(?P<comma>,)"
    r"|(?P<sep>\n|;)"
)


def _tokenize(text: str) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    pos = 0
    while pos < len(text):
        match = _TOKEN.match(text, pos)
        if not match:
            raise SolverError(
                "MALFORMED_LATEX",
                "Unable to solve because the recognized equation appears incomplete.",
            )
        pos = match.end()
        kind = match.lastgroup
        if kind is None:
            continue
        tokens.append((kind, match.group(kind)))
    return tokens


def _insert_implicit_multiplication(text: str) -> str:
    tokens = _join_split_numbers(_tokenize(text))
    if not tokens:
        raise SolverError(
            "MALFORMED_LATEX",
            "Unable to solve because the recognized equation appears incomplete.",
        )
    combined: list[tuple[str, str]] = []
    for token in tokens:
        if combined and _needs_multiply(combined[-1], token):
            combined.append(("op", "*"))
        combined.append(token)
    return " ".join(value for _, value in combined)


def _join_split_numbers(tokens: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """The recognizer emits each digit separately, so ``1 5`` means 15."""
    combined: list[tuple[str, str]] = []
    for token in tokens:
        if combined and token[0] == "num" and combined[-1][0] == "num" and _can_join_digits(combined[-1][1], token[1]):
            combined[-1] = ("num", combined[-1][1] + token[1])
            continue
        combined.append(token)
    return combined


def _can_join_digits(previous: str, current: str) -> bool:
    if not re.fullmatch(r"\d+", current):
        return False
    return re.fullmatch(r"\d+", previous) is not None or re.fullmatch(r"\d+\.\d+", previous) is not None


def _needs_multiply(left: tuple[str, str], right: tuple[str, str]) -> bool:
    if left[0] == "num" and right[0] == "num":
        raise SolverError(
            "MALFORMED_LATEX",
            "Please verify the recognized equation.",
        )
    if left[0] == "ident" and left[1] in _FUNCS and right[0] in {"ident", "lp", "num"}:
        return False
    left_value = left[0] in {"num", "ident", "rp"}
    right_value = right[0] in {"num", "ident", "lp"}
    return left_value and right_value
