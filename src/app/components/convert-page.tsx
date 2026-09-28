import { useState, useEffect, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Upload, Copy, Loader2, X, Type, Minus, Plus, Undo2, Redo2, CheckCircle2, Circle,
} from "lucide-react";
import { LatexPreview } from "@/app/components/latex-preview";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "@/app/components/handwriting-canvas";
import { recordRecognitionRequest, recordSolveOutcome } from "@/app/session-stats";
import { toast } from "sonner";

interface ImageItem {
  id: string;
  url: string;
  file: File;
  latex: string;
  status: "pending" | "processing" | "done" | "error";
}

interface SolveStep {
  step: number;
  latex: string;
  description: string;
}

interface SolveResult {
  success: boolean;
  recognized_expression?: string;
  normalized_expression?: string;
  equation_type?: string;
  variables?: string[];
  solution?: string[];
  solution_latex?: string;
  steps?: SolveStep[];
  verification?: { verified: boolean; solution_status?: string; message?: string };
  message?: string;
  error_type?: string;
  complex_solutions?: string[];
  solution_status?: string;
}

const EQUATION_TYPE_LABELS: Record<string, string> = {
  linear_equation: "Linear Equation",
  quadratic_equation: "Quadratic Equation",
  polynomial_equation: "Polynomial Equation",
  simultaneous_linear_equations: "Simultaneous Linear Equations",
  simultaneous_nonlinear_equations: "Simultaneous Nonlinear Equations",
  inequality: "Inequality",
  expression: "Expression",
  trigonometric_equation: "Trigonometric Equation",
  logarithmic_equation: "Logarithmic Equation",
  exponential_equation: "Exponential Equation",
  algebraic_equation: "Algebraic Equation",
  unsupported: "Unsupported",
};

function equationTypeLabel(type?: string) {
  if (!type) return "Unknown";
  return EQUATION_TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const PARSE_ERROR_TYPES = new Set(["MALFORMED_LATEX", "INVALID_EQUATION", "EMPTY_INPUT"]);
const RECOGNITION_ERROR = "Unable to recognize the handwritten equation. Please upload a clearer handwritten equation.";
const DRAW_RECOGNITION_ERROR = "Unable to recognize the handwritten equation. Please try writing more clearly.";
const DRAW_SOLVE_ERROR = "Equation recognized, but the equation could not be solved.";
const PARSE_ERROR = "The recognized equation could not be interpreted. Please verify the equation.";
const SOLVE_ERROR = "This equation could not be solved. Please verify the recognized equation.";

function isParseFailure(result: SolveResult | null) {
  return Boolean(result && !result.success && result.error_type && PARSE_ERROR_TYPES.has(result.error_type));
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_IMAGE_NAME = /\.(png|jpe?g|webp)$/i;

function isAllowedImage(file: File) {
  return ALLOWED_IMAGE_TYPES.has(file.type) || ALLOWED_IMAGE_NAME.test(file.name);
}

function solutionStatusLabel(result: SolveResult) {
  if (result.solution_status === "no_real_solution") return "No real solution";
  if (result.solution_status === "infinite") return "Infinite solutions";
  return "Solution Found";
}

type Marker = "done" | "active" | "pending" | "error";

function StatusMark({ state }: { state: Marker }) {
  if (state === "active") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
  if (state === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (state === "error") return <Circle className="h-4 w-4 shrink-0 text-destructive" />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />;
}

export function ConvertPage({ resetToken = 0 }: { resetToken?: number }) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [latexCode, setLatexCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solveState, setSolveState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [inputMode, setInputMode] = useState<"upload" | "draw">("upload");
  const [canvasHasInk, setCanvasHasInk] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HandwritingCanvasHandle>(null);
  const inputModeRef = useRef<"upload" | "draw">("upload");
  const solveAbortRef = useRef<AbortController | null>(null);
  const solveRequestRef = useRef(0);
  const editTimerRef = useRef<number | null>(null);
  const analyzeTimerRef = useRef<number | null>(null);
  const skipResetRef = useRef(true);
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);

  const bumpHistory = () => setHistoryVersion((version) => version + 1);

  const resetHistory = (value = "") => {
    historyRef.current = [value];
    historyIndexRef.current = 0;
    bumpHistory();
  };

  const rememberEquation = (code: string) => {
    if (skipHistoryRef.current) return;
    const trimmedHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (trimmedHistory[trimmedHistory.length - 1] === code) return;
    const next = [...trimmedHistory, code].slice(-100);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    bumpHistory();
  };

  const cancelScheduledSolve = () => {
    if (editTimerRef.current !== null) {
      window.clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
  };

  const cancelAnalyze = () => {
    if (analyzeTimerRef.current !== null) {
      window.clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
  };

  const invalidateSolve = () => {
    cancelScheduledSolve();
    cancelAnalyze();
    solveRequestRef.current += 1;
    solveAbortRef.current?.abort();
    solveAbortRef.current = null;
    setIsAnalyzing(false);
    setIsSolving(false);
  };

  const queueRecognizedSolve = (latex: string) => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    cancelScheduledSolve();
    cancelAnalyze();
    setSolveResult(null);
    setSolveState("idle");
    setIsSolving(false);
    setIsAnalyzing(true);
    analyzeTimerRef.current = window.setTimeout(() => {
      analyzeTimerRef.current = null;
      setIsAnalyzing(false);
      void runSolve(trimmed);
    }, 450);
  };

  const runSolve = async (latex: string) => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    cancelScheduledSolve();
    cancelAnalyze();
    setIsAnalyzing(false);
    const requestId = ++solveRequestRef.current;
    solveAbortRef.current?.abort();
    const controller = new AbortController();
    solveAbortRef.current = controller;
    setSolveResult(null);
    setSolveState("loading");
    setIsSolving(true);
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: trimmed }),
        signal: controller.signal,
      });
      const data = (await response.json()) as SolveResult;
      if (requestId !== solveRequestRef.current) return;
      setSolveResult(data);
      setSolveState(data.success ? "success" : "error");
      recordSolveOutcome(data);
    } catch (error) {
      if (requestId !== solveRequestRef.current) return;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (aborted && controller.signal.aborted && requestId !== solveRequestRef.current) return;
      if (aborted && solveAbortRef.current !== controller) return;
      const message = aborted
        ? "The solver took too long. Please try a simpler equation."
        : "We were unable to process this equation. Please try again.";
      setSolveState("error");
      const failure = { success: false, error_type: aborted ? "TIMEOUT" : "BACKEND_UNAVAILABLE", message };
      setSolveResult(failure);
      recordSolveOutcome(failure);
    } finally {
      window.clearTimeout(timer);
      if (requestId === solveRequestRef.current) setIsSolving(false);
    }
  };

  const scheduleSolve = (latex: string) => {
    cancelScheduledSolve();
    const trimmed = latex.trim();
    if (!trimmed) {
      invalidateSolve();
      setSolveResult(null);
      setSolveState("idle");
      return;
    }
    editTimerRef.current = window.setTimeout(() => {
      editTimerRef.current = null;
      void runSolve(trimmed);
    }, 650);
  };

  const processImage = async (item: ImageItem) => {
    invalidateSolve();
    setSolveResult(null);
    setSolveState("idle");
    setLatexCode("");
    setRecognitionError(null);
    setImages((prev) => prev.map((img) => img.id === item.id ? { ...img, status: "processing" as const } : img));
    let recognitionRecorded = false;
    try {
      const formData = new FormData();
      formData.append("file", item.file);
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/predict`, {
        method: "POST",
        body: formData,
      });
      recordRecognitionRequest();
      recognitionRecorded = true;
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not recognize mathematical content.");
      }
      setImages((prev) => prev.map((img) => img.id === item.id ? { ...img, latex: data.latex, status: "done" as const } : img));
      setLatexCode(data.latex);
      setActiveImageId(item.id);
      rememberEquation(data.latex);
      toast.success("Equation recognized");
      queueRecognizedSolve(data.latex);
    } catch {
      if (!recognitionRecorded) recordRecognitionRequest();
      setImages((prev) => prev.map((img) => img.id === item.id ? { ...img, status: "error" as const } : img));
      const message = inputModeRef.current === "draw" ? DRAW_RECOGNITION_ERROR : RECOGNITION_ERROR;
      setRecognitionError(message);
      toast.error(message);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (files.length > 1) {
      toast("Only one image can be processed at a time. The first image was used.");
    }
    const file = files.find(isAllowedImage);
    if (!file) {
      toast.error("Unsupported image type. Use PNG, JPG, JPEG, or WEBP.");
      return;
    }

    const item: ImageItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: URL.createObjectURL(file),
      file,
      latex: "",
      status: "pending",
    };

    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [item];
    });
    setActiveImageId(item.id);
    setLatexCode("");
    setSolveResult(null);
    setSolveState("idle");
    setRecognitionError(null);
    resetHistory();
    invalidateSolve();
    setIsProcessing(true);
    await processImage(item);
    setIsProcessing(false);
  };

  const handleRecognizeDrawing = async () => {
    if (!canvasRef.current?.hasInk()) {
      toast.error("Please write a mathematical equation first.");
      return;
    }
    const blob = await canvasRef.current.exportPng();
    if (!blob) {
      toast.error("Please write a mathematical equation first.");
      return;
    }
    const file = new File([blob], "handwritten-equation.png", { type: "image/png" });
    await handleImageUpload([file]);
  };

  const handleRerecognize = async () => {
    const item = images.find((img) => img.id === activeImageId);
    if (!item || isProcessing) return;
    setIsProcessing(true);
    await processImage(item);
    setIsProcessing(false);
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((img) => img.id !== id);
    });
    if (activeImageId === id) {
      invalidateSolve();
      setActiveImageId(null);
      setLatexCode("");
      setSolveResult(null);
      setSolveState("idle");
      setRecognitionError(null);
      resetHistory();
    }
  };

  const handleClearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    invalidateSolve();
    setImages([]);
    setActiveImageId(null);
    setLatexCode("");
    setSolveResult(null);
    setSolveState("idle");
    setRecognitionError(null);
    resetHistory();
    canvasRef.current?.clear();
    setCanvasHasInk(false);
  };

  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    handleClearAll();
    // New Equation increments resetToken. The first mount is skipped so an empty page is not cleared twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useEffect(() => () => {
    cancelScheduledSolve();
    cancelAnalyze();
    solveAbortRef.current?.abort();
  }, []);

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexCode);
    toast.success("Equation copied");
  };

  const handleCodeChange = (code: string) => {
    setLatexCode(code);
    rememberEquation(code);
    invalidateSolve();
    setSolveResult(null);
    setSolveState("idle");
    if (!activeImageId) return;
    setImages((prev) => prev.map((img) => img.id === activeImageId ? { ...img, latex: code } : img));
    scheduleSolve(code);
  };

  const applyHistory = (nextIndex: number) => {
    historyIndexRef.current = nextIndex;
    skipHistoryRef.current = true;
    handleCodeChange(historyRef.current[nextIndex] ?? "");
    skipHistoryRef.current = false;
    bumpHistory();
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files: File[] = [];
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length > 0 && inputModeRef.current === "upload") handleImageUpload(files);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeImageId]);

  inputModeRef.current = inputMode;
  const activeImage = images.find((img) => img.id === activeImageId) ?? images[0];
  const hasEquation = Boolean(latexCode.trim());
  const recognitionFailed = Boolean(recognitionError) || activeImage?.status === "error";
  const solvingNow = isAnalyzing || isSolving;
  const solved = !isProcessing && !solvingNow && solveState === "success" && Boolean(solveResult?.success);
  const solveFailed = !isProcessing && !solvingNow && solveState === "error";
  const variableLabel = (solveResult?.variables || []).length === 1 ? "Variable" : "Variables";
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  void historyVersion;

  const statusRows: { label: string; state: Marker }[] = [
    {
      label: inputMode === "draw" ? "Handwriting captured" : "Image uploaded successfully",
      state: inputMode === "draw" ? (canvasHasInk || activeImage ? "done" : "pending") : (activeImage ? "done" : "pending"),
    },
    {
      label: isProcessing ? "Recognizing handwriting..." : "Recognizing handwriting",
      state: isProcessing ? "active" : recognitionFailed && !hasEquation ? "error" : hasEquation || activeImage?.status === "done" ? "done" : "pending",
    },
    {
      label: "Equation recognized",
      state: isProcessing || (recognitionFailed && !hasEquation) ? "pending" : hasEquation ? "done" : "pending",
    },
    {
      label: solvingNow ? "Solving equation..." : "Solving equation",
      state: solvingNow ? "active" : solved ? "done" : solveFailed ? "error" : "pending",
    },
    {
      label: "Solution found",
      state: solved ? "done" : solveFailed ? "error" : "pending",
    },
  ];

  return (
    <div className="bg-muted/30 pb-24 md:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Handwritten Equation Solver</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write or upload a handwritten equation and receive an automatically generated mathematical solution.
        </p>

        <div className="mt-5 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,3.5fr)_minmax(0,3.5fr)]">
          <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">1. Input Method</h2>
            <div className="mt-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Input method">
              <Button
                type="button"
                size="sm"
                variant={inputMode === "upload" ? "default" : "outline"}
                className="h-9 rounded-full"
                aria-pressed={inputMode === "upload"}
                onClick={() => setInputMode("upload")}
              >
                Upload Image
              </Button>
              <Button
                type="button"
                size="sm"
                variant={inputMode === "draw" ? "default" : "outline"}
                className="h-9 rounded-full"
                aria-pressed={inputMode === "draw"}
                onClick={() => setInputMode("draw")}
              >
                Write by Hand
              </Button>
            </div>

            <div className={inputMode === "upload" ? "contents" : "hidden"}>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Upload one image containing a handwritten mathematical equation.
                </p>
                <div
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const files = Array.from(event.dataTransfer.files);
                    if (files.length > 0) void handleImageUpload(files);
                  }}
                  onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                  className={`mt-4 cursor-pointer rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
                  } ${isProcessing ? "pointer-events-none opacity-70" : ""}`}
                >
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-2 text-sm font-medium">{isDragging ? "Drop here" : "Upload or drag & drop"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG, JPEG, WEBP · Single image · Ctrl+V</p>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length > 0) void handleImageUpload(files);
                    event.target.value = "";
                  }} />
                </div>
                {activeImage ? (
                  <div className="relative mt-4 overflow-hidden rounded-xl border bg-muted/40">
                    <img src={activeImage.url} alt="Uploaded handwritten equation" className="max-h-52 w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(activeImage.id)}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs text-muted-foreground">Upload a handwritten equation to begin.</p>
                )}
                {activeImage && (
                  <Button variant="ghost" size="sm" className="mt-3 h-8 self-start px-2 text-xs" onClick={handleRerecognize} disabled={isProcessing}>
                    Re-recognize
                  </Button>
                )}
            </div>
            <div className={inputMode === "draw" ? "contents" : "hidden"}>
                <h3 className="mt-4 text-sm font-semibold">Write your equation</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Use your mouse, finger, or stylus to write a mathematical equation.
                </p>
                <HandwritingCanvas ref={canvasRef} active={inputMode === "draw"} disabled={isProcessing || solvingNow} onInkChange={setCanvasHasInk} />
                <Button
                  type="button"
                  className="mt-3 h-10 w-full"
                  onClick={() => void handleRecognizeDrawing()}
                  disabled={!canvasHasInk || isProcessing || solvingNow}
                >
                  {isProcessing ? "Recognizing..." : solvingNow ? "Solving..." : "Recognize & Solve"}
                </Button>
            </div>
          </section>

          <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">2. Recognized Equation</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Verify the recognized equation. You can edit the expression if the handwriting was interpreted incorrectly.
            </p>
            <div className="mt-4 flex items-center gap-1 rounded-lg border bg-muted/30 px-2 py-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyHistory(historyIndexRef.current - 1)} disabled={!canUndo} aria-label="Undo">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyHistory(historyIndexRef.current + 1)} disabled={!canRedo} aria-label="Redo">
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <span className="mx-1 h-4 w-px bg-border" />
              <Type className="h-3.5 w-3.5 text-muted-foreground" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFontSize((size) => Math.max(12, size - 2))} aria-label="Decrease font size">
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-[11px] text-muted-foreground">{fontSize}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFontSize((size) => Math.min(24, size + 2))} aria-label="Increase font size">
                <Plus className="h-3 w-3" />
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyLatex} disabled={!hasEquation}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="mt-3 min-h-28 rounded-xl border bg-background px-3 py-4">
              {isProcessing ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Recognizing handwriting...</p>
              ) : hasEquation ? (
                <div className="overflow-x-auto text-center">
                  <LatexPreview latex={latexCode} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Recognized equation will appear here...</p>
              )}
              <Textarea
                value={latexCode}
                onChange={(event) => handleCodeChange(event.target.value)}
                placeholder="Recognized equation will appear here..."
                disabled={isProcessing}
                className="mt-3 min-h-16 resize-none border-muted bg-muted/20 font-mono"
                style={{ fontSize: `${fontSize}px` }}
              />
            </div>
            <ul className="mt-4 space-y-2" aria-live="polite">
              {statusRows.map((row) => (
                <li key={row.label} className={`flex items-center gap-2 text-sm ${row.state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                  <StatusMark state={row.state} />
                  <span className={row.state === "done" && row.label === "Solution found" ? "text-emerald-700" : ""}>{row.label}</span>
                </li>
              ))}
            </ul>
            {recognitionFailed && !hasEquation && (
              <p className="mt-3 text-sm text-destructive">{inputMode === "draw" ? DRAW_RECOGNITION_ERROR : RECOGNITION_ERROR}</p>
            )}
          </section>

          <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">3. Mathematical Preview & Solution</h2>
            {!hasEquation && !recognitionFailed && !isProcessing ? (
              <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                Your mathematical preview and solution will appear here.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border bg-blue-50/70 px-4 py-5 dark:bg-primary/10">
                  <p className="text-xs font-medium text-primary">Recognized Equation</p>
                  <div className="mt-3 overflow-x-auto text-center">
                    {hasEquation ? <LatexPreview latex={latexCode} /> : <p className="text-sm text-muted-foreground">Recognizing handwriting...</p>}
                  </div>
                </div>

                <div className={`rounded-xl border px-4 py-5 ${solved ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30" : "bg-card"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Solution</p>
                    {solved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">
                        <CheckCircle2 className="h-3 w-3" /> {solveResult ? solutionStatusLabel(solveResult) : "Solution Found"}
                      </span>
                    )}
                    {solvingNow && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  <div className="mt-4 overflow-x-auto text-center text-lg">
                    {solved && solveResult ? (
                      solveResult.solution_status === "no_real_solution" || solveResult.solution_status === "infinite" ? (
                        <p className="text-base font-medium">{solveResult.message}</p>
                      ) : (
                        <LatexPreview latex={solveResult.solution_latex || (solveResult.solution || []).join(", ")} />
                      )
                    ) : solvingNow ? (
                      <p className="text-sm text-muted-foreground">Solving equation...</p>
                    ) : solveFailed ? (
                      <p className="text-sm text-destructive">{isParseFailure(solveResult) ? PARSE_ERROR : inputMode === "draw" ? DRAW_SOLVE_ERROR : SOLVE_ERROR}</p>
                    ) : recognitionFailed && !hasEquation ? (
                      <p className="text-sm text-destructive">{inputMode === "draw" ? DRAW_RECOGNITION_ERROR : RECOGNITION_ERROR}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Solving equation...</p>
                    )}
                  </div>
                  {solved && solveResult?.complex_solutions && solveResult.complex_solutions.length > 0 && (
                    <div className="mt-3 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Complex solutions</p>
                      <LatexPreview latex={solveResult.complex_solutions.join(", ")} displayMode={false} />
                    </div>
                  )}
                </div>

                {solved && solveResult && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border px-3 py-3">
                      <p className="text-[11px] text-muted-foreground">Equation Type</p>
                      <p className="mt-1 text-sm font-medium">{equationTypeLabel(solveResult.equation_type)}</p>
                    </div>
                    <div className="rounded-xl border px-3 py-3">
                      <p className="text-[11px] text-muted-foreground">{variableLabel}</p>
                      <p className="mt-1 text-sm font-medium">{(solveResult.variables || []).join(", ") || "—"}</p>
                    </div>
                  </div>
                )}

                {solved && solveResult?.verification?.verified && (
                  <div className="rounded-xl border px-3 py-3">
                    <p className="text-[11px] text-muted-foreground">Verification</p>
                    <p className="mt-1 flex items-start gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      Solution verified against the original equation.
                    </p>
                  </div>
                )}
                {solved && solveResult && solveResult.verification && !solveResult.verification.verified && (
                  <div className="rounded-xl border px-3 py-3">
                    <p className="text-[11px] text-muted-foreground">Verification</p>
                    <p className="mt-1 text-sm text-muted-foreground">Verification could not be completed for this equation.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">4. Step-by-Step Solution</h2>
          <p className="mt-1 text-xs text-muted-foreground">Detailed steps showing how the equation is solved.</p>
          {solved && solveResult?.steps && solveResult.steps.length > 0 ? (
            <ol className="mt-4">
              {solveResult.steps.map((step, index) => (
                <li key={step.step} className="grid grid-cols-1 gap-3 border-b border-border/70 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
                  <div className="flex gap-3">
                    <div className="relative flex w-7 self-stretch justify-center">
                      <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{step.step}</span>
                      {index < (solveResult.steps?.length || 0) - 1 && <span className="absolute bottom-0 left-1/2 top-7 w-px -translate-x-1/2 bg-border" />}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold">{step.description}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 text-center">
                    <LatexPreview latex={step.latex} displayMode={false} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              {solvingNow ? "Solving equation..." : "Step-by-step solution will appear after the equation is solved."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
