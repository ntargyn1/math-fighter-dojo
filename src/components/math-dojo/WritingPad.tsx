import { useEffect, useRef, useState } from "react";

/**
 * WritingPad — a handwriting area that works like paper on a tablet.
 * Draw with a finger or a stylus (pointer events cover both). The pen writes
 * in dark blue, the eraser wipes, Clear empties the pad. The ruled lines are
 * a CSS background, so erasing never wipes the lines. The drawing itself is
 * never graded — it is scratch work, exactly like the margin of a test.
 *
 * The pad is tall by default (360px) for finger writing, and the ⛶ button
 * opens it full-screen — the drawing survives the switch, because resizing
 * the canvas copies the current drawing to an offscreen canvas first and
 * draws it back scaled, instead of wiping it.
 */
export function WritingPad({ label, height = 360 }: { label?: string; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [expanded, setExpanded] = useState(false);

  // Size the canvas backing store to the element (crisp on retina/tablet
  // screens). Runs on mount, on window resize, and when the pad goes
  // full-screen — the drawing is copied through an offscreen canvas so a
  // resize never wipes it.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 1 || h < 1) return;
      // Save the current drawing synchronously before the resize clears it.
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const offCtx = off.getContext("2d");
      if (offCtx && canvas.width > 0 && canvas.height > 0) offCtx.drawImage(canvas, 0, 0);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (off.width > 0 && off.height > 0) ctx.drawImage(off, 0, 0, w, h);
    };
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, [height, expanded]);

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
    ctx.lineWidth = erasing ? 28 : 4;
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
    <div className={expanded ? "fixed inset-0 z-50 flex touch-none flex-col bg-[var(--dojo-bg)] p-3" : "w-full"}>
      {label && <div className="mb-1 text-base font-bold text-foreground/70">{label}</div>}
      <div
        ref={wrapRef}
        className={`relative w-full overflow-hidden rounded-xl border-2 border-foreground/20 bg-white ${
          expanded ? "min-h-0 flex-1" : ""
        }`}
        style={
          expanded
            ? {
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 31px, rgba(30,58,95,0.18) 31px, rgba(30,58,95,0.18) 32px)",
                backgroundPosition: "0 8px",
              }
            : {
                height,
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 31px, rgba(30,58,95,0.18) 31px, rgba(30,58,95,0.18) 32px)",
                backgroundPosition: "0 8px",
              }
        }
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
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTool("pen")}
          className={`rounded-full px-4 py-2 text-base font-black ${
            tool === "pen" ? "bg-[var(--dojo-primary)] text-white" : "bg-white/70 text-foreground/70"
          }`}
        >
          ✏️ Pen
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          className={`rounded-full px-4 py-2 text-base font-black ${
            tool === "eraser" ? "bg-[var(--dojo-primary)] text-white" : "bg-white/70 text-foreground/70"
          }`}
        >
          🧽 Eraser
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-full bg-white/70 px-4 py-2 text-base font-black text-foreground/70"
        >
          🗑 Clear
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-full bg-white/70 px-4 py-2 text-base font-black text-foreground/70"
        >
          {expanded ? "✕ Close" : "⛶ Full screen"}
        </button>
      </div>
    </div>
  );
}
