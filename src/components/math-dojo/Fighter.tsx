import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { CHARACTERS, type CharacterId, type StripConfig } from "./spriteConfig";

/**
 * Fighter — animation state machine for one fighter.
 * Procedural motion (lunge, hitstop, knockback, KO fall) runs on the container;
 * the sprite strip inside plays frames with CSS steps(). Only the sprite element is mirrored.
 */
export type FighterState = "idle" | "intro" | "jab" | "kick" | "booger" | "block" | "hit" | "ko";
export type AttackMove = "jab" | "kick" | "booger";
export type Facing = "left" | "right";

export const HITSTOP_MS = 100;
export const LUNGE_MS = 120; // time from attack start until impact
const BLOCK_HOLD_MS = 600;

// Preloaded strip images are held here for the app's lifetime: without a
// surviving reference the browser may garbage-collect a loading Image and
// cancel its download.
const preloadedImages: HTMLImageElement[] = [];
let preloadStarted = false;

/**
 * Start downloading every sprite strip (idempotent). Called once at app
 * start (home screen) so the strips are cached before the first battle:
 * without this, the first battle shows a blank arena for ~0.7s while the
 * PNGs download, and the fighters pop in mid-walk-in.
 */
export function preloadAllStrips() {
  if (preloadStarted) return;
  preloadStarted = true;
  Object.values(CHARACTERS).forEach((s) => {
    Object.values(s).forEach((strip) => {
      if (strip) {
        const img = new Image();
        img.src = strip.src;
        preloadedImages.push(img);
      }
    });
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Flash = "none" | "white" | "red";
const FILTERS: Record<Flash, string | undefined> = {
  none: undefined,
  white: "brightness(2.6) saturate(0.2)",
  red: "sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.9)",
};

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
  // Preload every fighter strip once, on mount: strips otherwise load on
  // demand at the strip swap, so the first punch renders blank (or only the
  // top rows of a half-downloaded PNG) until its image arrives.
  // (The same preload also runs at app start — see MathFightingDojo.)
  useEffect(() => {
    preloadAllStrips();
  }, []);
  const [playId, setPlayId] = useState(0);
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
      setPlayId((n) => n + 1);
    };
    (async () => {
      controls.stop();
      switch (state) {
        case "idle":
          setFlash("none");
          show(sprites.idle);
          controls.set({ x: 0, y: 0, rotate: 0, scaleY: 1, opacity: 1 });
          return;
        case "intro": {
          // Walk-in: plays exactly once, then idle takes over (never loops).
          if (!sprites.intro) {
            show(sprites.idle);
            return done();
          }
          const finished = new Promise<void>((r) => (stripDone.current = r));
          show(sprites.intro);
          await finished; // strip plays exactly once
          if (!alive) return;
          show(sprites.idle);
          return done();
        }
        case "jab":
        case "kick":
        case "booger": {
          const finished = new Promise<void>((r) => (stripDone.current = r));
          show(sprites[state]);
          // Kick lunge: Alan's standing high kick lunges only 16px (the strip
          // is wide and the old 46px carried the foot past the arena centre,
          // where the slot clips it). Bayan's jump kick lunges 30px — a
          // shortened jump (the sheet's jump is much longer) so her extended
          // foot reaches Alan without crossing the centre — and it takes
          // 450ms to get there, so the forward travel matches the strip's
          // airborne phase instead of snapping back before the kick lands.
          // The strip itself carries the vertical jump (frames rise ~100px
          // off the ground), so no y arc here.
          // Booger lunge is 16px too — the monster strip is wide (fills the
          // frame), so a bigger lunge would carry its kick foot past the
          // arena centre, where the slot clips it.
          const dist =
            state === "booger" ? 16 : state === "kick" ? (character === "bayan" ? 30 : 16) : 36;
          const lungeMs = state === "kick" && character === "bayan" ? 450 : LUNGE_MS;
          await controls.start({ x: dist * d, y: 0, transition: { duration: lungeMs / 1000, ease: "easeIn" } });
          if (!alive) return;
          await freeze();
          if (!alive) return;
          await controls.start({ x: 0, y: 0, transition: { duration: 0.15, ease: "easeOut" } });
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
          if (!alive) return;
          setFlash("red");
          await controls.start({ x: [0, -30 * d, -24 * d, -32 * d, -28 * d], scaleY: 1, transition: { duration: 0.2, ease: "easeOut" } });
          if (alive) setFlash("none");
          await controls.start({ x: 0, transition: { duration: 0.15 } });
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
    };
  }, [state, controls, sprites, d]);

  return (
    <div className="flex h-full w-full items-end justify-center">
      <motion.div
        animate={controls}
        className="relative w-[160%] max-w-none shrink-0"
        style={{ aspectRatio: `${strip.frameWidth} / ${strip.frameHeight}`, originY: 1, originX: 0.5, filter: FILTERS[flash] }}
        data-fighter-state={state}
      >
        <SpriteStrip key={playId} strip={strip} mirrored={facing === "left"} paused={frozen} onDone={() => stripDone.current()} />
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
          // End at -(n-1)/n — NOT -100%. The -100% "fix" (Nov 10) broke every
          // animation live (idle/jab/intro/kick all sliced, duplicated and
          // blanked): with steps(n, jump-none) this engine lands the shifts
          // exactly on frame boundaries only with the -(n-1)/n end. Do not
          // change this value on theory alone — verify live first.
          ["--sprite-end" as string]: `${(-100 * (n - 1)) / n}%`,
          animation: `dojo-sprite ${ms}ms steps(${n}, jump-none) ${strip.loop ? "infinite" : "1 forwards"}`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}
