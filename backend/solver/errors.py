"""Errors that are safe to show to API clients."""


class SolverError(Exception):
    def __init__(self, error_type: str, message: str):
        super().__init__(message)
        self.error_type = error_type
        self.message = message
