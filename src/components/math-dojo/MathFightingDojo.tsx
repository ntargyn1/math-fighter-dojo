import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { sfx, isMuted, setMuted } from "./sound";
import { getBelt, loadWins, saveWins, BELTS } from "./belts";
import { TrainingScreen } from "./Training";
import { Fighter, HITSTOP_MS, LUNGE_MS, type FighterState, type AttackMove } from "./Fighter";

type Screen =
  | "home"
  | "battle"
  | "training"
  | "victory"
  | "defeat"
  | "two-player"
  | "two-player-result"
  | "settings";
export type Operator = "+" | "-" | "×" | "÷";
type PlayerId = "player1" | "player2";
type Side = "top" | "bottom";
type Pose = "idle" | "hit" | "attack" | "block";

export interface Question {
  a: number;
  b: number;
  operator: Operator;
  correctAnswer: number;
  level: number;
}

const QUESTION_TIME = 10;
export const questionTime = (level: number) => Math.max(5, 11 - clampLevel(level));
const FAST_ANSWER_THRESHOLD = 2; // seconds
const FAST_MULTIPLIER = 1.5;
const ULTIMATE_DAMAGE = 150;
const START_NPC_HEALTH = 1500;
const START_PLAYER_HEALTH = 500;
const TP_START_HEALTH = 500;

type PunchKind = "light" | "medium" | "heavy";
const PUNCHES: Record<
  PunchKind,
  { label: string; emoji: string; levelShift: number; damage: number; counter: number; risk: string }
> = {
  light: { label: "Light Jab", emoji: "👊", levelShift: -2, damage: 10, counter: 0, risk: "Easy • No risk" },
  medium: { label: "Medium Cross", emoji: "🥊", levelShift: 0, damage: 20, counter: 10, risk: "Normal • Miss = -10 you" },
  heavy: { label: "Heavy Uppercut", emoji: "💥", levelShift: 2, damage: 35, counter: 20, risk: "Hard • Miss = -20 you" },
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clampLevel = (l: number) => Math.max(1, Math.min(30, l));

export function levelDescription(rawLevel: number): string {
  const l = clampLevel(rawLevel);
  if (l <= 3) return `Level ${l}: + and - 0–10`;
  if (l <= 5) return `Level ${l}: + and - 0–20`;
  if (l <= 10) return `Level ${l}: x2–x6 + division`;
  if (l <= 15) return `Level ${l}: x2–x10 + division`;
  if (l <= 20) return `Level ${l}: x2–x12 + division`;
  if (l <= 25) return `Level ${l}: x2–x15 + division`;
  return `Level ${l}: x12–x20 + division`;
}

export function generateQuestion(rawLevel: number): Question {
  const level = clampLevel(rawLevel);
  if (level <= 5) {
    const max = level <= 3 ? 10 : 20;
    if (Math.random() < 0.5) {
      const a = randInt(0, max);
      const b = randInt(0, max - a);
      return { a, b, operator: "+", correctAnswer: a + b, level };
    }
    const a = randInt(1, max);
    const b = randInt(0, a);
    return { a, b, operator: "-", correctAnswer: a - b, level };
  }
  const maxTable = level <= 10 ? 6 : level <= 15 ? 10 : level <= 20 ? 12 : level <= 25 ? 15 : 20;
  const minFactor = level >= 26 ? 12 : 2;
  const x = randInt(minFactor, maxTable);
  const y = randInt(minFactor, maxTable);
  if (Math.random() < 0.5) return { a: x, b: y, operator: "×", correctAnswer: x * y, level };
  const c = x * y;
  return Math.random() < 0.5
    ? { a: c, b: x, operator: "÷", correctAnswer: y, level }
    : { a: c, b: y, operator: "÷", correctAnswer: x, level };
}

export function generateOptions(correct: number, q?: Question): number[] {
  const set = new Set<number>([correct]);
  const cands: number[] = [];
  if (q && q.operator === "×") {
    // neighbors in the times tables: (a±1)×b, a×(b±1)
    cands.push((q.a - 1) * q.b, (q.a + 1) * q.b, q.a * (q.b - 1), q.a * (q.b + 1), correct - 2, correct + 2);
  } else {
    cands.push(correct - 1, correct + 1, correct - 2, correct + 2);
  }
  const pool = cands.filter((c) => c >= 0 && c !== correct).sort(() => Math.random() - 0.5);
  for (const c of pool) {
    if (set.size >= 3) break;
    set.add(c);
  }
  let d = 3;
  while (set.size < 3) {
    if (correct + d >= 0) set.add(correct + d);
    d++;
  }
  const arr = Array.from(set);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface RoundResult {
  hit: boolean;
  damage: number;
  counter: number;
  newStreak: number;
  ultimate: boolean;
  fast: boolean;
  label: string;
}

function resolveRound(punch: PunchKind, correct: boolean, elapsed: number, streak: number): RoundResult {
  const p = PUNCHES[punch];
  if (!correct) {
    return {
      hit: false,
      damage: 0,
      counter: p.counter,
      newStreak: 0,
      ultimate: false,
      fast: false,
      label: p.counter ? `Countered! -${p.counter}` : "Missed! (no damage)",
    };
  }
  const fast = elapsed <= FAST_ANSWER_THRESHOLD;
  const newStreak = fast ? streak + 1 : 0;
  if (newStreak >= 3) {
    return { hit: true, damage: ULTIMATE_DAMAGE, counter: 0, newStreak: 0, ultimate: true, fast, label: "⚡ ULTIMATE STRIKE! ⚡" };
  }
  const damage = Math.round(p.damage * (fast ? FAST_MULTIPLIER : 1));
  return { hit: true, damage, counter: 0, newStreak, ultimate: false, fast, label: fast ? `FAST ${p.label}! -${damage}` : `${p.label}! -${damage}` };
}

// ---------- Placeholder animation hooks (extend later) ----------
function playHitAnimation(target: string) {
  console.debug(`hit anim on ${target}`);
}
function playUltimateAnimation() {
  console.debug("ULTIMATE!");
}

// ---------- Fight FX (framer-motion) ----------

interface Popup {
  id: number;
  side: Side;
  text: string;
}

function useFightFx() {
  const stage = useAnimationControls();
  const [states, setStates] = useState<Record<Side, FighterState>>({ top: "idle", bottom: "idle" });
  const [popups, setPopups] = useState<Popup[]>([]);
  const [bursts, setBursts] = useState<Popup[]>([]);
  const [ko, setKo] = useState<Side | null>(null);
  const idRef = useRef(0);
  const cur = useRef<Record<Side, FighterState>>({ top: "idle", bottom: "idle" });
  const ends = useRef<Record<Side, { p: Promise<void>; r: () => void } | null>>({ top: null, bottom: null });

  // State machine: a busy fighter must finish (onAnimationEnd) before a new state starts; only "ko" interrupts.
  const play = async (side: Side, s: FighterState): Promise<void> => {
    if (s !== "ko") while (ends.current[side]) await ends.current[side]!.p;
    if (cur.current[side] === "ko") return;
    ends.current[side]?.r();
    let r!: () => void;
    const p = new Promise<void>((res) => (r = res));
    ends.current[side] = { p, r };
    cur.current[side] = s;
    setStates((st) => ({ ...st, [side]: s }));
    return p;
  };
  const onEnd = (side: Side, s: FighterState) => {
    if (cur.current[side] !== s) return;
    const e = ends.current[side];
    ends.current[side] = null;
    if (s !== "ko") {
      cur.current[side] = "idle";
      setStates((st) => ({ ...st, [side]: "idle" }));
    }
    e?.r();
  };

  const addFx = (side: Side, text: string, burst: boolean) => {
    const id = ++idRef.current;
    setPopups((p) => [...p, { id, side, text }]);
    if (burst) setBursts((b) => [...b, { id, side, text: "" }]);
    setTimeout(() => {
      setPopups((p) => p.filter((x) => x.id !== id));
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 1000);
  };

  // Side mapping in the arena: "bottom" = LEFT fighter, "top" = RIGHT fighter.
  const strike = async (attacker: Side, text: string, shake: boolean, move: AttackMove = "jab", reaction: "hit" | "block" = "hit") => {
    const defender: Side = attacker === "top" ? "bottom" : "top";
    const atk = play(attacker, move);
    await wait(LUNGE_MS); // impact frame
    addFx(defender, text, reaction === "hit");
    const def = play(defender, reaction);
    if (shake && reaction === "hit") setTimeout(() => void stage.start({ x: [0, 4, -4, 4, -4, 0], transition: { duration: 0.2 } }), HITSTOP_MS);
    await Promise.all([atk, def]);
  };

  const dodge = async (side: Side, text: string) => {
    addFx(side, text, false);
    await play(side, "block");
  };

  const knockOut = async (side: Side) => {
    setKo(side);
    await play(side, "ko");
    await wait(700);
  };

  return { stage, states, onEnd, popups, bursts, ko, strike, dodge, knockOut };
}
type FightFx = ReturnType<typeof useFightFx>;

function StarBurst({ side }: { side: Side }) {
  return (
    <div className={`pointer-events-none absolute top-[35%] ${side === "top" ? "left-[20%]" : "right-[20%]"}`}>
      {Array.from({ length: 8 }).map((_, i) => {
        const ang = (i / 8) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="absolute text-2xl text-[var(--dojo-accent)]"
            initial={{ x: -10, y: -14, opacity: 1, scale: 1.2 }}
            animate={{ x: Math.cos(ang) * 60 - 10, y: Math.sin(ang) * 60 - 14, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            ✦
          </motion.div>
        );
      })}
    </div>
  );
}

function FighterSlot({ fx, side, color }: { fx: FightFx; side: Side; color: string }) {
  // Left fighter (bottom) faces right; right fighter (top) is mirrored to face left.
  const flipped = side === "top";
  return (
    <div className="relative flex h-full w-[38%] items-end justify-center">
      <div className="h-[85%] w-full">
        <Fighter state={fx.states[side]} facing={flipped ? "left" : "right"} character={flipped ? "bayan" : "alan"} color={color} onAnimationEnd={(s) => fx.onEnd(side, s)} />
      </div>
      {fx.bursts
        .filter((b) => b.side === side)
        .map((b) => (
          <StarBurst key={b.id} side={side} />
        ))}
      <AnimatePresence>
        {fx.popups
          .filter((p) => p.side === side)
          .map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: 10, opacity: 1, scale: 0.6 }}
              animate={{ y: -60, opacity: 0, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.1 }}
              className="pointer-events-none absolute top-2 whitespace-nowrap text-3xl font-black text-[var(--dojo-danger)]"
              style={{ textShadow: "0 2px 0 white, 0 -2px 0 white, 2px 0 0 white, -2px 0 0 white" }}
            >
              {p.text}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

function Arena({
  fx,
  leftColor,
  rightColor,
  banner,
}: {
  fx: FightFx;
  leftColor: string;
  rightColor: string;
  banner?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-[40vh] min-h-56 w-full items-end justify-between overflow-hidden rounded-3xl bg-white/50 px-2 pb-3 shadow-inner">
      <div className="absolute inset-x-6 bottom-3 h-1 rounded-full bg-foreground/15" />
      {banner && <div className="absolute inset-x-0 top-2 z-10 flex justify-center">{banner}</div>}
      <FighterSlot fx={fx} side="bottom" color={leftColor} />
      <div className="mb-[18%] shrink-0 rounded-full bg-[var(--dojo-accent)] px-2 py-1 text-xs font-black text-[var(--dojo-accent-foreground)] shadow">
        VS
      </div>
      <FighterSlot fx={fx} side="top" color={rightColor} />
    </div>
  );
}

function KOOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 9, delay: 0.25 }}
            className="text-8xl font-black text-[var(--dojo-danger)]"
            style={{ textShadow: "0 4px 0 white, 0 -4px 0 white, 4px 0 0 white, -4px 0 0 white" }}
          >
            K.O.!
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Shared UI ----------

function HealthBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-sm font-bold text-foreground">
        <span>{label}</span>
        <span>
          {Math.max(0, Math.round(value))}/{max}
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full border-2 border-foreground/20 bg-muted">
        <motion.div
          className="h-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Stickman({ pose, flipped }: { pose: Pose; flipped?: boolean }) {
  const color = "currentColor";
  const armAngle = pose === "attack" ? -40 : pose === "hit" ? 20 : pose === "block" ? -10 : 0;
  return (
    <svg viewBox="0 0 100 140" className="h-full w-full" preserveAspectRatio="xMidYMax meet" style={{ transform: flipped ? "scaleX(-1)" : undefined }}>
      <circle cx="50" cy="20" r="14" stroke={color} strokeWidth="4" fill="none" />
      <line x1="50" y1="34" x2="50" y2="80" stroke={color} strokeWidth="4" />
      <line x1="50" y1="50" x2={25} y2={50 + armAngle} stroke={color} strokeWidth="4" />
      <line x1="50" y1="50" x2={75} y2={50 + armAngle} stroke={color} strokeWidth="4" />
      <line x1="50" y1="80" x2="30" y2="120" stroke={color} strokeWidth="4" />
      <line x1="50" y1="80" x2="70" y2="120" stroke={color} strokeWidth="4" />
    </svg>
  );
}

function BeltBadge({ wins }: { wins: number }) {
  const belt = getBelt(wins);
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border-2 border-foreground/20 px-3 py-1 text-sm font-black shadow"
      style={{ backgroundColor: belt.color, color: belt.text }}
    >
      🥋 {belt.name} Belt <span className="opacity-70">• {wins} wins</span>
    </div>
  );
}

function FastMeter({ streak }: { streak: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-foreground">FAST</span>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: i < streak ? 1.2 : 1 }}
          className={`h-4 w-4 rounded-full border-2 border-foreground/40 ${
            i < streak ? "bg-[var(--dojo-accent)]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "answer" | "p1" | "p2";
  disabled?: boolean;
  small?: boolean;
}) {
  const base = `w-full rounded-2xl ${small ? "px-4 py-3 text-lg" : "px-6 py-5 text-2xl"} font-black shadow-lg active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100`;
  const styles: Record<string, string> = {
    primary: "bg-[var(--dojo-primary)] text-[var(--dojo-primary-foreground)]",
    secondary:
      "bg-[var(--dojo-secondary)] text-[var(--dojo-secondary-foreground)] border-4 border-[var(--dojo-primary)]",
    answer: "bg-[var(--dojo-accent)] text-[var(--dojo-accent-foreground)]",
    p1: "bg-sky-500 text-white",
    p2: "bg-pink-500 text-white",
  };
  return (
    <button
      type="button"
      onClick={() => {
        sfx.click();
        onClick?.();
      }}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function PunchPicker({ onPick, title }: { onPick: (p: PunchKind) => void; title: string }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-3xl bg-white/70 p-3 shadow-inner">
      <div className="text-center text-base font-black text-[var(--dojo-primary)]">{title}</div>
      <div className="grid grid-cols-3 gap-2">
      {(Object.keys(PUNCHES) as PunchKind[]).map((k) => {
        const p = PUNCHES[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => {
              sfx.click();
              onPick(k);
            }}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center shadow-lg active:scale-95 transition-transform ${
              k === "light"
                ? "bg-[var(--dojo-secondary)] text-[var(--dojo-secondary-foreground)]"
                : k === "medium"
                  ? "bg-[var(--dojo-accent)] text-[var(--dojo-accent-foreground)]"
                  : "bg-[var(--dojo-danger)] text-[var(--dojo-primary-foreground)]"
            }`}
          >
            <span className="text-3xl leading-none">{p.emoji}</span>
            <span className="text-sm font-black leading-tight">{p.label}</span>
            <span className="text-[11px] font-bold leading-tight">
              Hit -{p.damage}
              <br />
              {p.risk}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  options,
  timeRemaining,
  timerColor,
  onAnswer,
  disabled,
  answerVariant = "answer",
  headerText,
  flash,
}: {
  question: Question;
  options: number[];
  timeRemaining: number;
  timerColor: string;
  onAnswer: (v: number) => void;
  disabled?: boolean;
  answerVariant?: "answer" | "p1" | "p2";
  headerText?: string;
  flash?: string | null;
}) {
  const total = questionTime(question.level);
  const timerPct = (timeRemaining / total) * 100;
  const isFastWindow = total - timeRemaining <= FAST_ANSWER_THRESHOLD;
  return (
    <div className="relative flex w-full flex-col items-center gap-2 rounded-3xl bg-white/70 p-3 shadow-inner">
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[var(--dojo-accent)]/90 px-2 text-center text-2xl font-black text-[var(--dojo-accent-foreground)]"
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full transition-all" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
        </div>
        <div className="mt-1 text-center text-xs font-bold text-foreground/70">
          {timeRemaining.toFixed(1)}s{isFastWindow && !disabled ? " • ⚡ FAST!" : ""}
          {headerText ? ` • ${headerText}` : ""}
        </div>
      </div>
      <div className="text-4xl font-black text-[var(--dojo-primary)]">
        {question.a} {question.operator} {question.b} = ?
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {options.map((opt) => (
          <BigButton key={opt} variant={answerVariant} onClick={() => onAnswer(opt)} disabled={disabled}>
            {opt}
          </BigButton>
        ))}
      </div>
    </div>
  );
}

/** Shared round state: punch choice -> timed question -> resolve. */
function useRound() {
  const [phase, setPhase] = useState<"choose" | "question" | "resolving" | "ko">("choose");
  const [punch, setPunch] = useState<PunchKind>("medium");
  const [question, setQuestion] = useState<Question>(() => generateQuestion(1));
  const [options, setOptions] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME);
  const startRef = useRef(Date.now());
  const timeoutRef = useRef<() => void>(() => {});

  const begin = (p: PunchKind, level: number) => {
    const q = generateQuestion(level + PUNCHES[p].levelShift);
    setPunch(p);
    setQuestion(q);
    setOptions(generateOptions(q.correctAnswer, q));
    setTimeRemaining(questionTime(q.level));
    startRef.current = Date.now();
    setPhase("question");
  };

  useEffect(() => {
    if (phase !== "question") return;
    const id = setInterval(() => {
      const remaining = questionTime(question.level) - (Date.now() - startRef.current) / 1000;
      if (remaining <= 0) {
        setTimeRemaining(0);
        timeoutRef.current();
      } else setTimeRemaining(remaining);
    }, 100);
    return () => clearInterval(id);
  }, [phase, question]);

  const elapsed = () => (Date.now() - startRef.current) / 1000;
  return { phase, setPhase, punch, question, options, timeRemaining, begin, elapsed, timeoutRef };
}

function useMounted() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

// ---------- Screen transition wrapper ----------
function ScreenFade({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ---------- Home ----------

function HomeScreen({
  wins,
  onPlay,
  onTwoPlayer,
  onTrain,
  onSettings,
}: {
  wins: number;
  onPlay: () => void;
  onTwoPlayer: () => void;
  onTrain: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[var(--dojo-bg)] px-6 py-8">
      <div className="flex flex-col items-center gap-2 pt-4">
        <div className="text-5xl">🥋</div>
        <h1 className="text-center text-4xl font-black leading-tight text-[var(--dojo-primary)]">
          Math Fighting
          <br />
          Dojo
        </h1>
        <BeltBadge wins={wins} />
        <p className="mt-1 text-center text-base text-foreground/70">Pick a punch. Solve it. Strike!</p>
      </div>

      <div className="flex w-full items-center justify-center gap-4 py-4 text-[var(--dojo-primary)]">
        <motion.div className="h-28 w-20" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
          <Stickman pose="idle" />
        </motion.div>
        <div className="self-center text-4xl">⚔️</div>
        <motion.div
          className="h-28 w-20 text-[var(--dojo-danger)]"
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: 0.6 }}
        >
          <Stickman pose="idle" flipped />
        </motion.div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <BigButton onClick={onPlay} variant="primary">
          ▶ Single Battle
        </BigButton>
        <BigButton onClick={onTwoPlayer} variant="p2">
          👥 Two Players
        </BigButton>
        <BigButton onClick={onTrain} variant="secondary">
          🧠 Training
        </BigButton>
        <BigButton onClick={onSettings} variant="secondary">
          ⚙️ Settings
        </BigButton>
      </div>
    </div>
  );
}

// ---------- Single Battle ----------

function BattleScreen({
  level,
  wins,
  onVictory,
  onDefeat,
  onHome,
}: {
  level: number;
  wins: number;
  onVictory: () => void;
  onDefeat: () => void;
  onHome: () => void;
}) {
  const [playerHealth, setPlayerHealth] = useState(START_PLAYER_HEALTH);
  const [npcHealth, setNpcHealth] = useState(START_NPC_HEALTH);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const round = useRound();
  const fx = useFightFx();
  const mounted = useMounted();

  const finish = async (correct: boolean) => {
    if (round.phase !== "question") return;
    round.setPhase("resolving");
    const r = resolveRound(round.punch, correct, round.elapsed(), streak);
    setStreak(r.newStreak);
    let npc = npcHealth;
    let me = playerHealth;
    if (r.hit) {
      if (r.ultimate) playUltimateAnimation();
      playHitAnimation("npc");
      sfx.punch(r.ultimate || round.punch === "heavy");
      npc -= r.damage;
      setNpcHealth(npc);
      await fx.strike("bottom", `-${r.damage}`, r.ultimate || round.punch !== "light", r.ultimate || round.punch === "heavy" ? "uppercut" : round.punch === "medium" ? "cross" : "jab");
    } else if (r.counter > 0) {
      sfx.whoosh();
      await wait(120);
      sfx.punch(round.punch === "heavy");
      playHitAnimation("player");
      me -= r.counter;
      setPlayerHealth(me);
      await fx.strike("top", `-${r.counter}`, true, round.punch === "heavy" ? "uppercut" : "cross");
    } else {
      sfx.whoosh();
      await fx.strike("bottom", "Blocked!", false, "jab", "block");
    }
    if (!mounted.current) return;
    setFlash(r.label);
    await wait(650);
    if (!mounted.current) return;
    setFlash(null);
    if (npc <= 0 || me <= 0) {
      round.setPhase("ko");
      const won = npc <= 0;
      await fx.knockOut(won ? "top" : "bottom");
      if (won) sfx.victory();
      else sfx.defeat();
      await wait(1300);
      if (!mounted.current) return;
      if (won) onVictory();
      else onDefeat();
    } else {
      round.setPhase("choose");
    }
  };
  round.timeoutRef.current = () => void finish(false);

  return (
    <motion.div animate={fx.stage} className="flex min-h-screen flex-col gap-2 bg-[var(--dojo-bg)] px-3 py-3">
      <KOOverlay show={fx.ko !== null} />
      <div className="flex justify-center">
        <BeltBadge wins={wins} />
      </div>
      <HealthBar value={npcHealth} max={START_NPC_HEALTH} color="var(--dojo-danger)" label="👹 Boss" />

      <Arena fx={fx} leftColor="var(--dojo-primary)" rightColor="var(--dojo-danger)" />

      <div className="flex flex-1 flex-col items-center justify-end gap-2">
        <FastMeter streak={streak} />
        {round.phase === "choose" ? (
          <PunchPicker title={`Choose your punch! (Level ${level})`} onPick={(p) => round.begin(p, level)} />
        ) : (
          <QuestionCard
            question={round.question}
            options={round.options}
            timeRemaining={round.timeRemaining}
            timerColor="var(--dojo-primary)"
            onAnswer={(v) => void finish(v === round.question.correctAnswer)}
            disabled={round.phase !== "question"}
            headerText={`${PUNCHES[round.punch].emoji} ${PUNCHES[round.punch].label}`}
            flash={flash}
          />
        )}
      </div>

      <HealthBar value={playerHealth} max={START_PLAYER_HEALTH} color="var(--dojo-primary)" label="🧒 You" />
      <button type="button" onClick={onHome} className="text-sm font-bold text-foreground/60 underline">
        Back to home
      </button>
    </motion.div>
  );
}

// ---------- Two Player Battle ----------

function LevelSlider({ label, value, onChange, accent }: { label: string; value: number; onChange: (n: number) => void; accent: string }) {
  return (
    <div className="w-full rounded-3xl bg-white/70 p-4 shadow-inner">
      <div className="flex justify-between text-lg font-black" style={{ color: accent }}>
        <span>{label}</span>
        <span className="text-right text-sm">{levelDescription(value)}</span>
      </div>
      <input
        type="range"
        min={1}
        max={30}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full"
        style={{ accentColor: accent }}
      />
    </div>
  );
}

function TwoPlayerBattleScreen({
  level,
  onFinish,
  onHome,
}: {
  level: number;
  onFinish: (winner: PlayerId) => void;
  onHome: () => void;
}) {
  const [setup, setSetup] = useState(true);
  const [levels, setLevels] = useState<Record<PlayerId, number>>({ player1: level, player2: level });
  const [health, setHealth] = useState<Record<PlayerId, number>>({ player1: TP_START_HEALTH, player2: TP_START_HEALTH });
  const [streaks, setStreaks] = useState<Record<PlayerId, number>>({ player1: 0, player2: 0 });
  const [turn, setTurn] = useState<PlayerId>("player1");
  const [flash, setFlash] = useState<string | null>(null);
  const round = useRound();
  const fx = useFightFx();
  const mounted = useMounted();

  const sideOf = (p: PlayerId): Side => (p === "player1" ? "bottom" : "top");

  const finish = async (correct: boolean) => {
    if (round.phase !== "question") return;
    round.setPhase("resolving");
    const attacker = turn;
    const defender: PlayerId = attacker === "player1" ? "player2" : "player1";
    const r = resolveRound(round.punch, correct, round.elapsed(), streaks[attacker]);
    setStreaks((s) => ({ ...s, [attacker]: r.newStreak }));
    const next = { ...health };
    if (r.hit) {
      if (r.ultimate) playUltimateAnimation();
      sfx.punch(r.ultimate || round.punch === "heavy");
      next[defender] -= r.damage;
      setHealth(next);
      await fx.strike(sideOf(attacker), `-${r.damage}`, r.ultimate || round.punch !== "light", r.ultimate || round.punch === "heavy" ? "uppercut" : round.punch === "medium" ? "cross" : "jab");
    } else if (r.counter > 0) {
      sfx.whoosh();
      await wait(120);
      sfx.punch(round.punch === "heavy");
      next[attacker] -= r.counter;
      setHealth(next);
      await fx.strike(sideOf(defender), `-${r.counter}`, true, round.punch === "heavy" ? "uppercut" : "cross");
    } else {
      sfx.whoosh();
      await fx.strike(sideOf(attacker), "Blocked!", false, "jab", "block");
    }
    if (!mounted.current) return;
    setFlash(r.label);
    await wait(700);
    if (!mounted.current) return;
    setFlash(null);
    const loser = next.player1 <= 0 ? "player1" : next.player2 <= 0 ? "player2" : null;
    if (loser) {
      round.setPhase("ko");
      await fx.knockOut(sideOf(loser));
      sfx.victory();
      await wait(1300);
      if (mounted.current) onFinish(loser === "player1" ? "player2" : "player1");
    } else {
      setTurn(defender);
      round.setPhase("choose");
    }
  };
  round.timeoutRef.current = () => void finish(false);

  if (setup) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-4 bg-[var(--dojo-bg)] px-6 py-8">
        <h2 className="text-3xl font-black text-[var(--dojo-primary)]">Two Players</h2>
        <p className="text-center text-sm text-foreground/70">
          Each player picks their own level. Damage is the same for everyone — level only changes how hard the math is!
        </p>
        <LevelSlider label="🌸 Player 2" value={levels.player2} accent="#ec4899" onChange={(n) => setLevels((l) => ({ ...l, player2: n }))} />
        <LevelSlider label="🌊 Player 1" value={levels.player1} accent="#0ea5e9" onChange={(n) => setLevels((l) => ({ ...l, player1: n }))} />
        <div className="mt-2 flex w-full flex-col gap-3">
          <BigButton variant="primary" onClick={() => setSetup(false)}>
            🥊 Fight!
          </BigButton>
          <BigButton variant="secondary" onClick={onHome}>
            ← Back to home
          </BigButton>
        </div>
      </div>
    );
  }

  const isP1 = turn === "player1";

  const zone = (p: PlayerId) => {
    const active = turn === p;
    const label = p === "player1" ? "Player 1" : "Player 2";
    const tint = p === "player1" ? "border-sky-500 bg-sky-50" : "border-pink-500 bg-pink-50";
    if (!active) {
      return (
        <div className="rounded-2xl border-2 border-dashed border-foreground/15 px-3 py-2 text-center text-sm font-bold text-foreground/50">
          {label} — get ready…
        </div>
      );
    }
    return (
      <motion.div
        key={`${p}-zone`}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className={`flex flex-col items-center gap-2 rounded-3xl border-4 p-2 ${tint}`}
      >
        <FastMeter streak={streaks[p]} />
        {round.phase === "choose" ? (
          <PunchPicker title={`${label}: choose your punch!`} onPick={(k) => round.begin(k, levels[p])} />
        ) : (
          <QuestionCard
            question={round.question}
            options={round.options}
            timeRemaining={round.timeRemaining}
            timerColor={p === "player1" ? "#0ea5e9" : "#ec4899"}
            onAnswer={(v) => void finish(v === round.question.correctAnswer)}
            disabled={round.phase !== "question"}
            answerVariant={p === "player1" ? "p1" : "p2"}
            headerText={`${PUNCHES[round.punch].emoji} ${PUNCHES[round.punch].label}`}
            flash={flash}
          />
        )}
      </motion.div>
    );
  };

  return (
    <motion.div animate={fx.stage} className="flex min-h-screen flex-col gap-2 bg-[var(--dojo-bg)] px-3 py-3">
      <KOOverlay show={fx.ko !== null} />
      <HealthBar value={health.player2} max={TP_START_HEALTH} color="#ec4899" label={`🌸 Player 2 • Lv ${levels.player2}`} />
      {zone("player2")}

      <div className="flex flex-1 flex-col justify-center">
        <Arena
          fx={fx}
          leftColor="#0ea5e9"
          rightColor="#ec4899"
          banner={
            <div className={`rounded-full px-4 py-1 text-sm font-black text-white shadow ${isP1 ? "bg-sky-500" : "bg-pink-500"}`}>
              {isP1 ? "PLAYER 1 ATTACKS" : "PLAYER 2 ATTACKS"}
            </div>
          }
        />
      </div>

      {zone("player1")}
      <HealthBar value={health.player1} max={TP_START_HEALTH} color="#0ea5e9" label={`🌊 Player 1 • Lv ${levels.player1}`} />
      <button type="button" onClick={onHome} className="text-sm font-bold text-foreground/60 underline">
        Back to home
      </button>
    </motion.div>
  );
}

// ---------- Result screens ----------

function ResultScreen({
  kind,
  wins,
  onRetry,
  onHome,
}: {
  kind: "victory" | "defeat";
  wins: number;
  onRetry: () => void;
  onHome: () => void;
}) {
  const isWin = kind === "victory";
  const belt = getBelt(wins);
  const newBelt = isWin && BELTS.some((b) => b.min === wins && wins > 0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--dojo-bg)] px-6 py-10">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 10 }}
        className="text-7xl"
      >
        {isWin ? "🏆" : "💪"}
      </motion.div>
      <h2 className="text-center text-4xl font-black text-[var(--dojo-primary)]">{isWin ? "Victory!" : "Try Again!"}</h2>
      <p className="text-center text-base text-foreground/70">
        {isWin ? "You crushed the boss with math power!" : "You're getting stronger. One more try!"}
      </p>
      {newBelt && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.4 }}
          className="text-center text-xl font-black text-[var(--dojo-primary)]"
        >
          🎉 New belt: {belt.name}!
        </motion.div>
      )}
      <BeltBadge wins={wins} />
      <div className="flex w-full max-w-sm flex-col gap-3">
        <BigButton variant="primary" onClick={onRetry}>
          {isWin ? "Play again" : "Retry battle"}
        </BigButton>
        <BigButton variant="secondary" onClick={onHome}>
          Back to home
        </BigButton>
      </div>
    </div>
  );
}

function TwoPlayerResultScreen({ winner, onRetry, onHome }: { winner: PlayerId; onRetry: () => void; onHome: () => void }) {
  const isP1 = winner === "player1";
  return (
    <div className={`flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10 ${isP1 ? "bg-sky-100" : "bg-pink-100"}`}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 10 }}
        className="text-7xl"
      >
        🏆
      </motion.div>
      <h2 className={`text-center text-4xl font-black ${isP1 ? "text-sky-600" : "text-pink-600"}`}>
        {isP1 ? "Player 1 Wins!" : "Player 2 Wins!"}
      </h2>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <BigButton variant={isP1 ? "p1" : "p2"} onClick={onRetry}>
          Play again
        </BigButton>
        <BigButton variant="secondary" onClick={onHome}>
          Back to home
        </BigButton>
      </div>
    </div>
  );
}

// ---------- Settings ----------

function SettingsScreen({ level, setLevel, onHome }: { level: number; setLevel: (n: number) => void; onHome: () => void }) {
  const [mute, setMute] = useState(false);
  useEffect(() => setMute(isMuted()), []);
  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--dojo-bg)] px-6 py-8">
      <h2 className="text-3xl font-black text-[var(--dojo-primary)]">Settings</h2>
      <p className="mt-1 text-sm text-foreground/70">Pick a starting level.</p>
      <div className="mt-6 w-full max-w-sm rounded-3xl bg-white/70 p-6 shadow-inner">
        <div className="text-center text-2xl font-black text-[var(--dojo-primary)]">Level {level}</div>
        <input type="range" min={1} max={30} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-4 w-full" />
        <div className="mt-2 flex justify-between text-xs font-bold text-foreground/60">
          <span>1</span>
          <span>20</span>
        </div>
        <div className="mt-4 text-center text-sm text-foreground/70">
          {levelDescription(level)}
        </div>
      </div>
      <div className="mt-4 w-full max-w-sm">
        <BigButton
          variant={mute ? "secondary" : "answer"}
          onClick={() => {
            const v = !mute;
            setMuted(v);
            setMute(v);
          }}
        >
          {mute ? "🔇 Sound: Off" : "🔊 Sound: On"}
        </BigButton>
      </div>
      <div className="mt-4 w-full max-w-sm">
        <BigButton onClick={onHome} variant="secondary">
          ← Back to home
        </BigButton>
      </div>
    </div>
  );
}

// ---------- Root ----------

export function MathFightingDojo() {
  const [screen, setScreen] = useState<Screen>("home");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [battleKey, setBattleKey] = useState(0);
  const [tpWinner, setTpWinner] = useState<PlayerId>("player1");
  const [wins, setWins] = useState(0);

  useEffect(() => setWins(loadWins()), []);

  const startBattle = () => {
    setBattleKey((k) => k + 1);
    setScreen("battle");
  };
  const startTwoPlayer = () => {
    setBattleKey((k) => k + 1);
    setScreen("two-player");
  };
  const home = useCallback(() => setScreen("home"), []);

  return (
    <div className="mx-auto max-w-md overflow-x-hidden">
      <AnimatePresence mode="wait">
        <ScreenFade id={`${screen}-${battleKey}`} key={`${screen}-${battleKey}`}>
          {screen === "home" && (
            <HomeScreen
              wins={wins}
              onPlay={startBattle}
              onTwoPlayer={startTwoPlayer}
              onTrain={() => setScreen("training")}
              onSettings={() => setScreen("settings")}
            />
          )}
          {screen === "battle" && (
            <BattleScreen
              level={currentLevel}
              wins={wins}
              onVictory={() => {
                const w = wins + 1;
                setWins(w);
                saveWins(w);
                setCurrentLevel((l) => Math.min(20, l + 1));
                setScreen("victory");
              }}
              onDefeat={() => setScreen("defeat")}
              onHome={home}
            />
          )}
          {screen === "two-player" && (
            <TwoPlayerBattleScreen
              level={currentLevel}
              onFinish={(w) => {
                setTpWinner(w);
                setScreen("two-player-result");
              }}
              onHome={home}
            />
          )}
          {screen === "training" && <TrainingScreen level={currentLevel} onHome={home} />}
          {screen === "settings" && <SettingsScreen level={currentLevel} setLevel={setCurrentLevel} onHome={home} />}
          {screen === "victory" && <ResultScreen kind="victory" wins={wins} onRetry={startBattle} onHome={home} />}
          {screen === "defeat" && <ResultScreen kind="defeat" wins={wins} onRetry={startBattle} onHome={home} />}
          {screen === "two-player-result" && <TwoPlayerResultScreen winner={tpWinner} onRetry={startTwoPlayer} onHome={home} />}
        </ScreenFade>
      </AnimatePresence>
    </div>
  );
}
