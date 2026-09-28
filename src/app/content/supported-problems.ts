export interface SupportedProblem {
  name: string;
  support: string;
}

/** Categories the current solver can actually handle. Partial coverage is labeled. */
export const SUPPORTED_PROBLEMS: SupportedProblem[] = [
  { name: "Linear Equations", support: "Supported" },
  { name: "Quadratic Equations", support: "Supported" },
  { name: "Polynomial Equations", support: "Supported" },
  { name: "Systems of Equations", support: "Linear systems supported" },
  { name: "Inequalities", support: "Supported" },
  { name: "Expressions", support: "Supported" },
  { name: "Fractions", support: "Supported" },
  { name: "Square-root Equations", support: "Supported" },
  { name: "Exponential Equations", support: "Selected forms" },
  { name: "Trigonometric Equations", support: "Selected forms" },
  { name: "Logarithmic Equations", support: "Selected forms" },
];
