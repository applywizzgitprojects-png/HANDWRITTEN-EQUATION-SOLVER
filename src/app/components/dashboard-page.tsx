import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { SUPPORTED_PROBLEMS } from "@/app/content/supported-problems";
import { readSessionStats, type SessionStats } from "@/app/session-stats";
import { Upload } from "lucide-react";

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onNewConvert: () => void;
}

interface HealthStatus {
  status?: string;
  model_loaded?: boolean;
  solver_available?: boolean;
}

const PIPELINE = [
  "Image input",
  "Preprocessing",
  "Handwriting recognition",
  "Mathematical parsing",
  "Equation classification",
  "Symbolic solving",
  "Verification",
  "Solution",
];

const METRICS: { label: string; key: keyof SessionStats }[] = [
  { label: "Equations processed", key: "equationsProcessed" },
  { label: "Equations solved", key: "equationsSolved" },
  { label: "Recognition requests", key: "recognitionRequests" },
  { label: "Successful solutions", key: "successfulSolutions" },
  { label: "Verified solutions", key: "verifiedSolutions" },
];

export function DashboardPage({ onNewConvert }: DashboardPageProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [backendState, setBackendState] = useState<"checking" | "connected" | "unavailable">("checking");
  const [stats, setStats] = useState<SessionStats>(() => readSessionStats());

  useEffect(() => {
    setStats(readSessionStats());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<HealthStatus>;
      })
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        setBackendState(data.status === "ok" ? "connected" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setBackendState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = backendState === "connected";
  const recognition = ready && health?.model_loaded ? "Ready" : backendState === "checking" ? "Checking" : "Unavailable";
  const solver = ready && health?.solver_available ? "Ready" : backendState === "checking" ? "Checking" : "Unavailable";
  const backendLabel = backendState === "connected" ? "Connected" : backendState === "checking" ? "Checking" : "Unavailable";

  return (
    <div className="container mx-auto px-4 lg:px-6 py-8 pb-12 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Handwritten Equation Solver</p>
          <h1 className="text-2xl lg:text-3xl font-semibold mt-1">Solver dashboard</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Overview of handwritten recognition, mathematical analysis, and solution processing.
          </p>
        </div>
        <Button onClick={onNewConvert}>
          <Upload className="h-4 w-4 mr-2" />
          Start Solving
        </Button>
      </div>

      <section>
        <h2 className="text-sm font-medium mb-3">Session overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {METRICS.map((metric) => (
            <Card key={metric.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{stats[metric.key]}</p>
                <p className="text-[11px] text-muted-foreground mt-1">This session</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">End-to-end solving pipeline</h2>
        <Card>
          <CardContent className="pt-6">
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((step, index) => (
                <li key={step} className="rounded-lg border px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">0{index + 1}</p>
                  <p className="text-sm font-medium mt-1">{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Handwriting recognition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="font-medium">Input. </span><span className="text-muted-foreground">Handwritten equation image</span></p>
            <p><span className="font-medium">Processing. </span><span className="text-muted-foreground">Computer vision preprocessing</span></p>
            <p><span className="font-medium">Recognition. </span><span className="text-muted-foreground">Deep-learning mathematical expression recognition</span></p>
            <p><span className="font-medium">Output. </span><span className="text-muted-foreground">Structured mathematical notation</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mathematical solver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Converts recognized mathematical notation into structured symbolic expressions and applies mathematical solving methods to supported problem types.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Parsing</li>
              <li>Classification</li>
              <li>Symbolic solving</li>
              <li>Solution verification</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Supported equation types</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_PROBLEMS.map((item) => (
            <Card key={item.name}>
              <CardContent className="pt-4">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.support}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">System status</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Recognition engine", recognition],
            ["Mathematical parser", solver],
            ["Equation solver", solver],
            ["Verification engine", solver],
            ["Backend", backendLabel],
          ].map(([label, status]) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">Status: {status}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
