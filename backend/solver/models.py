"""Pydantic models for the equation solver API."""

from typing import Optional

from pydantic import BaseModel, Field


class SolveRequest(BaseModel):
    latex: str = Field(..., description="Recognized or edited LaTeX / math text")
    allow_complex: bool = False


class StepResult(BaseModel):
    step: int
    latex: str
    description: str


class VerificationResult(BaseModel):
    verified: bool
    solution_status: str = "not_applicable"
    message: Optional[str] = None


class SolveResponse(BaseModel):
    success: bool
    recognized_expression: Optional[str] = None
    normalized_expression: Optional[str] = None
    equation_type: Optional[str] = None
    variables: list[str] = Field(default_factory=list)
    degree: Optional[int] = None
    equation_count: Optional[int] = None
    unknown_count: Optional[int] = None
    solution: list[str] = Field(default_factory=list)
    solution_latex: Optional[str] = None
    steps: list[StepResult] = Field(default_factory=list)
    verification: Optional[VerificationResult] = None
    message: Optional[str] = None
    error_type: Optional[str] = None
    complex_solutions: Optional[list[str]] = None
    solution_status: Optional[str] = None
