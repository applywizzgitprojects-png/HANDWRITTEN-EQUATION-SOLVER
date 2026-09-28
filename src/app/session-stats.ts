const STORAGE_KEY = "handwritten-equation-solver-session";

export interface SessionStats {
  recognitionRequests: number;
  equationsProcessed: number;
  equationsSolved: number;
  successfulSolutions: number;
  verifiedSolutions: number;
}

const EMPTY_STATS: SessionStats = {
  recognitionRequests: 0,
  equationsProcessed: 0,
  equationsSolved: 0,
  successfulSolutions: 0,
  verifiedSolutions: 0,
};

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function readSessionStats(): SessionStats {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<SessionStats>;
    return {
      recognitionRequests: asCount(parsed.recognitionRequests),
      equationsProcessed: asCount(parsed.equationsProcessed),
      equationsSolved: asCount(parsed.equationsSolved),
      successfulSolutions: asCount(parsed.successfulSolutions),
      verifiedSolutions: asCount(parsed.verifiedSolutions),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function writeSessionStats(stats: SessionStats) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function recordRecognitionRequest() {
  const stats = readSessionStats();
  stats.recognitionRequests += 1;
  writeSessionStats(stats);
}

export function recordSolveOutcome(result: {
  success: boolean;
  solution?: string[];
  solution_status?: string;
  verification?: { verified?: boolean };
}) {
  const stats = readSessionStats();
  stats.equationsProcessed += 1;
  if (result.success) {
    stats.equationsSolved += 1;
    const concluded =
      result.solution_status === "verified" ||
      result.solution_status === "infinite" ||
      result.solution_status === "no_real_solution" ||
      (result.solution?.length ?? 0) > 0;
    if (concluded) stats.successfulSolutions += 1;
    if (result.verification?.verified) stats.verifiedSolutions += 1;
  }
  writeSessionStats(stats);
}
