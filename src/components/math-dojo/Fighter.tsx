import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { CHARACTERS, type CharacterId, type StripConfig } from "./spriteConfig";

/**
 * Fighter — animation state machine for one fighter.
 * Procedural motion (lunge, hitstop, knockback, KO fall) runs on the container;
 * the sprite strip inside plays frames with CSS steps(). Only the sprite element is mirrored.
 */
export type FighterState = "idle" | "jab" | "cross" | "uppercut" | "block" | "hit" | "ko";
export type AttackMove = "jab" | "cross" | "uppercut";
export type Facing = "left" | "right";

export const HITSTOP_MS = 100;
export const LUNGE_MS = 120; // time from attack start until impact
const BLOCK_HOLD_MS = 600;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Flash = "none" | "white" | "red";
// Flash is rendered as a blend-mode overlay (not a CSS filter) so the
// fighter's compositing layer is never torn down mid-animation.

export function Fighter({
  state,
  facing,
  onAnimationEnd,
  character = "alan",
}: {
  state: FighterState;
  facing: Facing;
  onAnimationEnd?: (s: FighterState) => void;
  character?: CharacterId;
  color?: string;
  flash?: string;
}) {
  const controls = useAnimationControls();
  const sprites = CHARACTERS[character];
  const [flash, setFlash] = useState<Flash>("none");
  const [frozen, setFrozen] = useState(false);
  // Which strip is visible; hit/ko keep the previous strip when no real strip exists.
  const [strip, setStrip] = useState<StripConfig>(sprites.idle);
  const endRef = useRef(onAnimationEnd);
  endRef.current = onAnimationEnd;
  const stripDone = useRef<() => void>(() => {});
  const d = facing === "right" ? 1 : -1; // direction toward the opponent

  useEffect(() => {
    let alive = true;
    const done = () => alive && endRef.current?.(state);
    const freeze = async () => {
      setFrozen(true);
      await wait(HITSTOP_MS);
      if (alive) setFrozen(false);
    };
    const show = (s: StripConfig) => {
      setStrip(s);
    };
    (async () => {
      controls.stop();
      switch (state) {
        case "idle":
          setFlash("none");
          show(sprites.idle);
          controls.set({ x: 0, y: 0, rotate: 0, scaleY: 1, opacity: 1 });
          return;
        case "jab":
        case "cross":
        case "uppercut": {
          const finished = new Promise<void>((r) => (stripDone.current = r));
          show(sprites[state]);
          const dist = state === "uppercut" ? 56 : state === "cross" ? 46 : 36;
          await controls.start({ x: dist * d, y: state === "uppercut" ? -8 : 0, transition: { duration: LUNGE_MS / 1000, ease: "easeIn" } });
          if (!alive) {
            controls.set({ x: 0, y: 0, rotate: 0 });
            return;
          }
          await freeze();
          if (!alive) {
            controls.set({ x: 0, y: 0, rotate: 0 });
            return;
          }
          // Snap back synchronously: awaiting the return can leave the fighter
          // stranded off its slot if the animation is interrupted.
          controls.set({ x: 0, y: 0, rotate: 0 });
          await finished; // strip plays exactly once
          if (!alive) return;
          show(sprites.idle);
          return done();
        }
        case "hit":
          if (sprites.hit) show(sprites.hit);
          setFlash("white");
          controls.set({ scaleY: 0.9, y: 0 });
          await freeze();
          if (!alive) {
            controls.set({ x: 0, y: 0, rotate: 0, scaleY: 1 });
            return;
          }
          setFlash("red");
          await controls.start({ x: [0, -30 * d, -24 * d, -32 * d, -28 * d], scaleY: 1, transition: { duration: 0.2, ease: "easeOut" } });
          // Snap back synchronously instead of awaiting: if this await is
          // interrupted the fighter would be left stuck at the knockback offset.
          controls.set({ x: 0, y: 0, rotate: 0, scaleY: 1 });
          if (alive) setFlash("none");
          if (!alive) return;
          show(sprites.idle);
          return done();
        case "block":
          show(sprites.block);
          await controls.start({ x: [0, -8 * d, -8 * d, 0], scaleY: [1, 0.95, 0.95, 1], y: 0, transition: { duration: BLOCK_HOLD_MS / 1000, times: [0, 0.15, 0.85, 1] } });
          if (!alive) return;
          show(sprites.idle);
          return done();
        case "ko":
          if (sprites.ko) show(sprites.ko);
          setFrozen(true); // interrupt current strip on its current frame
          setFlash("red");
          await controls.start({ x: -18 * d, rotate: -8 * d, transition: { duration: 0.1, ease: "easeOut" } });
          if (!alive) return;
          setFlash("none");
          await controls.start({ rotate: -90 * d, x: -30 * d, y: 6, transition: { duration: 0.45, ease: "easeIn" } });
          if (!alive) return;
          await controls.start({ y: [6, -8, 6, 2, 6], transition: { duration: 0.35, ease: "easeOut" } });
          return done(); // stays lying down until state returns to idle
      }
    })();
    return () => {
      alive = false;
      setFrozen(false);
      controls.stop();
      // If the animation was interrupted mid-flight (e.g. knockback cut short by
      // the next state), snap back to the neutral spot so the fighter can never
      // drift off-screen. The newly started state then animates from a clean base.
      controls.set({ x: 0, y: 0, rotate: 0, scaleY: 1, opacity: 1 });
    };
  }, [state, controls, sprites, d]);

  return (
    <div className="flex h-full w-full items-end justify-center">
      <motion.div
        animate={controls}
        className="relative w-[160%] max-w-none shrink-0"
        style={{ aspectRatio: `${strip.frameWidth} / ${strip.frameHeight}`, originY: 1, originX: 0.5 }}
        data-fighter-state={state}
      >
        <SpriteStrip key={strip.src} strip={strip} mirrored={facing === "left"} paused={frozen} onDone={() => stripDone.current()} />
        {flash !== "none" && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: flash === "white" ? "#ffffff" : "#ef4444",
              opacity: flash === "white" ? 0.65 : 0.3,
              mixBlendMode: "overlay",
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

/** CSS sprite player: shifts the strip one frame at a time with steps(); never reverses. */
function SpriteStrip({ strip, mirrored, paused, onDone }: { strip: StripConfig; mirrored: boolean; paused: boolean; onDone: () => void }) {
  const n = strip.frames;
  const ms = (n / strip.fps) * 1000;
  return (
    <div className="h-full w-full overflow-hidden" style={{ transform: mirrored ? "scaleX(-1)" : undefined }}>
      <div
        className="h-full"
        onAnimationEnd={onDone}
        style={{
          width: `${n * 100}%`,
          backgroundImage: `url(${strip.src})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          ["--sprite-end" as string]: "-100%",
          animation: `dojo-sprite ${ms}ms steps(${n}, jump-none) ${strip.loop ? "infinite" : "1"}`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}
