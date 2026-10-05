import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";

/**
 * Fighter — animation state machine for one fighter.
 *
 * Motion (lunge, knockback, fall, bounce) lives on the wrapper here.
 * The visual is produced by a swappable `FighterRenderer`; Phase 2 replaces
 * StickmanRenderer with a sprite-strip renderer without touching props or game logic.
 */
export type FighterState = "idle" | "punch" | "kick" | "hit" | "block" | "ko";
export type Facing = "left" | "right";

export const HITSTOP_MS = 100;
export const LUNGE_MS = 120; // time from attack start until impact

export interface FighterRendererProps {
  state: FighterState;
  /** Increments every time a state starts, so renderers can restart one-shot strips. */
  playId: number;
  color: string;
  /** True while frozen by hitstop — sprite renderers should pause. */
  frozen: boolean;
}
export type FighterRenderer = (p: FighterRendererProps) => React.ReactElement;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Fighter({
  state,
  facing,
  onAnimationEnd,
  color = "currentColor",
  flash = "var(--dojo-danger)",
  renderer: Renderer = StickmanRenderer,
}: {
  state: FighterState;
  facing: Facing;
  onAnimationEnd?: (s: FighterState) => void;
  color?: string;
  flash?: string;
  renderer?: FighterRenderer;
}) {
  const controls = useAnimationControls();
  const [playId, setPlayId] = useState(0);
  const [red, setRed] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const endRef = useRef(onAnimationEnd);
  endRef.current = onAnimationEnd;

  useEffect(() => {
    let alive = true;
    setPlayId((n) => n + 1);
    const done = () => alive && endRef.current?.(state);
    const freeze = async () => {
      setFrozen(true);
      await wait(HITSTOP_MS);
      if (alive) setFrozen(false);
    };
    (async () => {
      controls.stop();
      switch (state) {
        case "idle":
          controls.set({ x: 0, rotate: 0, scaleY: 1 });
          void controls.start({ y: [0, -6, 0], transition: { duration: 1, repeat: Infinity, ease: "easeInOut" } });
          return;
        case "punch":
        case "kick": {
          const dist = state === "kick" ? 56 : 40;
          await controls.start({ x: dist, y: state === "kick" ? -8 : 0, rotate: state === "kick" ? -6 : 0, transition: { duration: LUNGE_MS / 1000, ease: "easeIn" } });
          if (!alive) return;
          await freeze();
          if (!alive) return;
          await controls.start({ x: 0, y: 0, rotate: 0, transition: { duration: 0.15, ease: "easeOut" } });
          return done();
        }
        case "hit":
          setRed(true);
          controls.set({ scaleY: 0.85, y: 0 });
          await freeze();
          if (!alive) return;
          await controls.start({ x: -30, scaleY: 1, transition: { duration: 0.15, ease: "easeOut" } });
          if (alive) setRed(false);
          await controls.start({ x: 0, transition: { duration: 0.15 } });
          return done();
        case "block":
          await controls.start({ x: [0, -8, -8, 0], scaleY: [1, 0.94, 0.94, 1], y: 0, transition: { duration: 0.3, times: [0, 0.2, 0.8, 1] } });
          return done();
        case "ko":
          setRed(false);
          await controls.start({ rotate: -90, y: 20, x: -20, opacity: 0.6, transition: { duration: 0.5, ease: "easeIn" } });
          return done();
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, controls]);

  return (
    <div className="h-full w-full" style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}>
      <motion.div
        animate={controls}
        className="h-full w-full"
        style={{ color: red ? flash : color, originY: 1, originX: 0.5 }}
        data-fighter-state={state}
      >
        <Renderer state={state} playId={playId} color={red ? flash : color} frozen={frozen} />
      </motion.div>
    </div>
  );
}

/** Phase 1 placeholder renderer: SVG stickman (always drawn facing right). */
export function StickmanRenderer({ state }: FighterRendererProps) {
  const c = "currentColor";
  const arm = state === "punch" ? { fx: 95, fy: 42 } : state === "block" ? { fx: 62, fy: 28 } : state === "hit" ? { fx: 70, fy: 72 } : { fx: 75, fy: 50 };
  const backArm = state === "block" ? { x: 58, y: 34 } : { x: 25, y: state === "hit" ? 30 : 50 };
  const frontLeg = state === "kick" ? { x: 98, y: 70 } : { x: 70, y: 120 };
  return (
    <svg viewBox="0 0 100 140" className="h-full w-full overflow-visible" preserveAspectRatio="xMidYMax meet">
      <circle cx="50" cy="20" r="14" stroke={c} strokeWidth="4" fill="none" />
      <line x1="50" y1="34" x2="50" y2="80" stroke={c} strokeWidth="4" />
      <line x1="50" y1="50" x2={backArm.x} y2={backArm.y} stroke={c} strokeWidth="4" strokeLinecap="round" />
      <line x1="50" y1="50" x2={arm.fx} y2={arm.fy} stroke={c} strokeWidth="4" strokeLinecap="round" />
      <line x1="50" y1="80" x2="30" y2="120" stroke={c} strokeWidth="4" strokeLinecap="round" />
      <line x1="50" y1="80" x2={frontLeg.x} y2={frontLeg.y} stroke={c} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
