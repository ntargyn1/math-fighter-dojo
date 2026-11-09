import { useEffect, useRef, useState } from "react";

/**
 * WritingPad — a handwriting area that works like paper on a tablet.
 * Draw with a finger or a stylus (pointer events cover both). The pen writes
 * in dark blue, the eraser wipes, Clear empties the pad. The ruled lines are
 * a CSS background, so erasing never wipes the lines. The drawing itself is
 * never graded — it is scratch work, exactly like the margin of a test.
 */
export function WritingPad({ label, height = 180 }: { label?: string; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Size the canvas backing store to the element (crisp on retina/tablet
  // screens). Runs once on mount and on window resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, [height]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const strokeTo = (p: { x: number; y: number }) => {
    const ctx = canvasRef.current!.getContext("2d");
    const last = lastRef.current;
    if (!ctx || !last) return;
    const erasing = toolRef.current === "eraser";
    ctx.save();
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = erasing ? "#000000" : "#1e3a5f";
    ctx.lineWidth = erasing ? 22 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    // A short curve through the midpoint smooths the stroke.
    const mx = (last.x + p.x) / 2;
    const my = (last.y + p.y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, mx, my);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
    lastRef.current = p;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    strokeTo(pos(e));
  };
  const onUp = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="w-full">
      {label && <div className="mb-1 text-sm font-bold text-foreground/70">{label}</div>}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border-2 border-foreground/20 bg-white"
        style={{
          height,
          backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(30,58,95,0.18) 31px, rgba(30,58,95,0.18) 32px)",
          backgroundPosition: "0 8px",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => setTool("pen")}
          className={`rounded-full px-3 py-1 text-sm font-black ${tool === "pen" ? "bg-[var(--dojo-primary)] text-white" : "bg-white/70 text-foreground/70"}`}
        >
          ✏️ Pen
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          className={`rounded-full px-3 py-1 text-sm font-black ${tool === "eraser" ? "bg-[var(--dojo-primary)] text-white" : "bg-white/70 text-foreground/70"}`}
        >
          🧽 Eraser
        </button>
        <button type="button" onClick={clear} className="rounded-full bg-white/70 px-3 py-1 text-sm font-black text-foreground/70">
          🗑 Clear
        </button>
      </div>
    </div>
  );
}
