import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Eraser, PenLine, Redo2, Undo2 } from "lucide-react";

export interface HandwritingCanvasHandle {
  hasInk: () => boolean;
  clear: () => void;
  exportPng: () => Promise<Blob | null>;
}

interface NormPoint {
  x: number;
  y: number;
  pressure: number;
}

interface NormStroke {
  points: NormPoint[];
  size: number;
  /** Stroke thickness as a fraction of the writing surface height. */
  normWidth: number;
  eraser: boolean;
}

const PEN_SIZES = [
  { id: "small", label: "Small", width: 1.7 },
  { id: "medium", label: "Medium", width: 2.5 },
  { id: "large", label: "Large", width: 3.6 },
] as const;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: NormStroke, width: number, height: number) {
  const points = stroke.points;
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  ctx.strokeStyle = "#1a1a1a";
  ctx.fillStyle = "#1a1a1a";
  const widthFor = (pressure: number) => {
    const base = stroke.eraser ? stroke.size * 7 : stroke.size * (0.82 + pressure * 0.36);
    return Math.max(stroke.eraser ? 8 : 1.2, base);
  };
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x * width, points[0].y * height, widthFor(points[0].pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    ctx.lineWidth = widthFor((current.pressure + next.pressure) / 2);
    ctx.quadraticCurveTo(
      current.x * width,
      current.y * height,
      ((current.x + next.x) / 2) * width,
      ((current.y + next.y) / 2) * height,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(((current.x + next.x) / 2) * width, ((current.y + next.y) / 2) * height);
  }
  const last = points[points.length - 1];
  ctx.lineWidth = widthFor(last.pressure);
  ctx.lineTo(last.x * width, last.y * height);
  ctx.stroke();
  ctx.restore();
}

function renderStrokes(ctx: CanvasRenderingContext2D, strokes: NormStroke[], cssWidth: number, cssHeight: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  const ratio = cssWidth > 0 ? ctx.canvas.width / cssWidth : 1;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  strokes.forEach((stroke) => drawStroke(ctx, stroke, cssWidth, cssHeight));
  ctx.restore();
}

export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, { onInkChange?: (hasInk: boolean) => void; disabled?: boolean; active?: boolean }>(
  function HandwritingCanvas({ onInkChange, disabled, active = true }, ref) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<NormStroke[]>([]);
    const redoRef = useRef<NormStroke[]>([]);
    const activeRef = useRef<NormStroke | null>(null);
    const toolRef = useRef<"pen" | "eraser">("pen");
    const sizeRef = useRef<number>(PEN_SIZES[1].width);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [penSize, setPenSize] = useState<(typeof PEN_SIZES)[number]["id"]>("medium");
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [hasInk, setHasInk] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const syncInk = () => {
      const ink = strokesRef.current.length > 0;
      setHasInk(ink);
      setCanUndo(ink);
      setCanRedo(redoRef.current.length > 0);
      onInkChange?.(ink);
    };

    const paint = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width < 2 || height < 2) return;
      const strokes = activeRef.current ? [...strokesRef.current, activeRef.current] : strokesRef.current;
      renderStrokes(context, strokes, width, height);
    };

    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width < 2 || height < 2) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      paint();
    };

    useEffect(() => {
      resize();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const observer = new ResizeObserver(() => resize());
      observer.observe(wrap);
      return () => observer.disconnect();
      // The canvas is sized from the element, not from React state.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!active) return;
      const frame = window.requestAnimationFrame(() => resize());
      return () => window.cancelAnimationFrame(frame);
      // Resize when the writing panel becomes visible.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const clearStrokes = () => {
      strokesRef.current = [];
      redoRef.current = [];
      activeRef.current = null;
      setConfirmClear(false);
      syncInk();
      paint();
    };

    useImperativeHandle(ref, () => ({
      hasInk: () => strokesRef.current.length > 0,
      clear: clearStrokes,
      exportPng: () => exportHandwriting(strokesRef.current),
    }));

    const finishStroke = () => {
      const stroke = activeRef.current;
      activeRef.current = null;
      if (!stroke || stroke.points.length === 0) return;
      strokesRef.current = [...strokesRef.current, stroke];
      redoRef.current = [];
      syncInk();
      paint();
    };

    const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): NormPoint => {
      const rect = event.currentTarget.getBoundingClientRect();
      const pressure = event.pressure > 0 && event.pressure < 1 ? event.pressure : 0.5;
      return {
        x: rect.width ? (event.clientX - rect.left) / rect.width : 0,
        y: rect.height ? (event.clientY - rect.top) / rect.height : 0,
        pressure,
      };
    };

    const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || event.button !== 0) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers reject capture for a pointer that is no longer active.
      }
      wrapRef.current?.focus();
      const bounds = event.currentTarget.getBoundingClientRect();
      const cssWidth = toolRef.current === "eraser" ? sizeRef.current * 7 : sizeRef.current;
      activeRef.current = {
        points: [pointFromEvent(event)],
        size: sizeRef.current,
        normWidth: bounds.height > 0 ? cssWidth / bounds.height : cssWidth / 256,
        eraser: toolRef.current === "eraser",
      };
      paint();
    };

    const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeRef.current || disabled) return;
      activeRef.current.points.push(pointFromEvent(event));
      paint();
    };

    const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Capture may already have been released.
        }
      }
      finishStroke();
    };

    const undo = () => {
      const stroke = strokesRef.current.pop();
      if (!stroke) return;
      redoRef.current.push(stroke);
      syncInk();
      paint();
    };

    const redo = () => {
      const stroke = redoRef.current.pop();
      if (!stroke) return;
      strokesRef.current.push(stroke);
      syncInk();
      paint();
    };

    const requestClear = () => {
      const pointCount = strokesRef.current.reduce((total, stroke) => total + stroke.points.length, 0);
      if (pointCount > 6) setConfirmClear(true);
      else clearStrokes();
    };

    return (
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            aria-pressed={tool === "pen"}
            onClick={() => { toolRef.current = "pen"; setTool("pen"); }}
          >
            <PenLine className="h-3.5 w-3.5" /> Pen
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs"
            aria-label="Eraser"
            aria-pressed={tool === "eraser"}
            onClick={() => { toolRef.current = "eraser"; setTool("eraser"); }}
          >
            <Eraser className="h-3.5 w-3.5" /> Eraser
          </Button>
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline" />
          {PEN_SIZES.map((size) => (
            <Button
              key={size.id}
              type="button"
              size="sm"
              variant={penSize === size.id ? "secondary" : "ghost"}
              className="h-8 px-2 text-xs"
              onClick={() => { sizeRef.current = size.width; setPenSize(size.id); }}
            >
              {size.label}
            </Button>
          ))}
        </div>

        <div
          ref={wrapRef}
          tabIndex={0}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
          }}
          className="relative mt-3 h-56 w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-64"
          style={{
            backgroundImage: "linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <canvas
            ref={canvasRef}
            aria-label="Handwriting equation input"
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {!hasInk && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-400">
              Write your equation here
            </p>
          )}
          {confirmClear && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/85 px-4">
              <div className="w-full max-w-xs rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-900">Clear handwritten equation?</p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmClear(false)}>Cancel</Button>
                  <Button type="button" size="sm" onClick={clearStrokes}>Clear</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={requestClear} disabled={!hasInk} aria-label="Clear">
            Clear
          </Button>
        </div>
      </div>
    );
  },
);

function strokeNormWidth(stroke: NormStroke) {
  return stroke.normWidth ?? stroke.size / 256;
}

async function exportHandwriting(strokes: NormStroke[]): Promise<Blob | null> {
  if (strokes.length === 0) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (const stroke of strokes) {
    const radius = strokeNormWidth(stroke) / 2;
    for (const point of stroke.points) {
      found = true;
      minX = Math.min(minX, point.x - radius);
      minY = Math.min(minY, point.y - radius);
      maxX = Math.max(maxX, point.x + radius);
      maxY = Math.max(maxY, point.y + radius);
    }
  }
  if (!found) return null;
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(1, maxX);
  maxY = Math.min(1, maxY);
  const contentWidth = Math.max(maxX - minX, 0.02);
  const contentHeight = Math.max(maxY - minY, 0.02);
  // The recognizer keeps images inside 128×512 and shrinks anything larger.
  // Render the ink just under that limit so the strokes are not blurred away.
  const maxInkHeight = 100;
  const maxInkWidth = 470;
  let scale = maxInkHeight / contentHeight;
  if (contentWidth * scale > maxInkWidth) scale = maxInkWidth / contentWidth;
  const padding = 12;
  const outWidth = Math.max(16, Math.round(contentWidth * scale) + padding * 2);
  const outHeight = Math.max(16, Math.round(contentHeight * scale) + padding * 2);
  const source = document.createElement("canvas");
  source.width = outWidth;
  source.height = outHeight;
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return null;
  const toX = (value: number) => padding + (value - minX) * scale;
  const toY = (value: number) => padding + (value - minY) * scale;
  for (const stroke of strokes) {
    const points = stroke.points;
    if (points.length === 0) continue;
    sourceContext.save();
    sourceContext.lineCap = "round";
    sourceContext.lineJoin = "round";
    sourceContext.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
    sourceContext.strokeStyle = "#111111";
    sourceContext.fillStyle = "#111111";
    const widthFor = (pressure: number) => {
      const relative = strokeNormWidth(stroke) * scale * (stroke.eraser ? 1 : 0.82 + pressure * 0.36);
      return Math.max(stroke.eraser ? relative : 2.8, relative);
    };
    if (points.length === 1) {
      sourceContext.beginPath();
      sourceContext.arc(toX(points[0].x), toY(points[0].y), widthFor(points[0].pressure) / 2, 0, Math.PI * 2);
      sourceContext.fill();
      sourceContext.restore();
      continue;
    }
    sourceContext.beginPath();
    sourceContext.moveTo(toX(points[0].x), toY(points[0].y));
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      sourceContext.lineWidth = widthFor((current.pressure + next.pressure) / 2);
      sourceContext.quadraticCurveTo(
        toX(current.x),
        toY(current.y),
        toX((current.x + next.x) / 2),
        toY((current.y + next.y) / 2),
      );
      sourceContext.stroke();
      sourceContext.beginPath();
      sourceContext.moveTo(toX((current.x + next.x) / 2), toY((current.y + next.y) / 2));
    }
    const last = points[points.length - 1];
    sourceContext.lineWidth = widthFor(last.pressure);
    sourceContext.lineTo(toX(last.x), toY(last.y));
    sourceContext.stroke();
    sourceContext.restore();
  }
  const output = document.createElement("canvas");
  output.width = outWidth;
  output.height = outHeight;
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, outWidth, outHeight);
  outputContext.drawImage(source, 0, 0);
  const pixels = outputContext.getImageData(0, 0, outWidth, outHeight).data;
  let dark = false;
  for (let index = 0; index < pixels.length; index += 16) {
    if (pixels[index] < 245) {
      dark = true;
      break;
    }
  }
  if (!dark) return null;
  return new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
}
