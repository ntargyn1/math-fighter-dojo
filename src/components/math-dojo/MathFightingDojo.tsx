import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { sfx, isMuted, setMuted } from "./sound";
import { getBelt, loadWins, saveWins, BELTS } from "./belts";

type Screen =
  | "home"
  | "battle"
  | "training"
  | "victory"
  | "defeat"
  | "two-player"
  | "two-player-result"
  | "settings";
type Operator = "+" | "-";
type PlayerId = "player1" | "player2";
type Side = "top" | "bottom";
type Pose = "idle" | "hit" | "attack" | "block";

interface Question {
  a: number;
  b: number;
  operator: Operator;
  correctAnswer: number;
}

const QUESTION_TIME = 5;
const FAST_ANSWER_THRESHOLD = 2; // seconds
const FAST_MULTIPLIER = 1.5;
const ULTIMATE_DAMAGE = 150;
const START_NPC_HEALTH = 300;
const START_PLAYER_HEALTH = 100;
const TP_START_HEALTH = 100;

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
const clampLevel = (l: number) => Math.max(1, Math.min(20, l));

export function generateQuestion(rawLevel: number): Question {
  const level = clampLevel(rawLevel);
  let a: number;
  let b: number;
  let operator: Operator = "+";
  if (level <= 5) {
    a = randInt(0, 10);
    b = randInt(0, 10 - a);
  } else if (level <= 10) {
    a = randInt(0, 20);
    b = randInt(0, 20 - a);
  } else if (level <= 15) {
    a = randInt(1, 10);
    b = randInt(0, a);
    operator = "-";
  } else {
    operator = Math.random() < 0.5 ? "+" : "-";
    if (operator === "+") {
      a = randInt(0, 20);
      b = randInt(0, 20 - a);
    } else {
      a = randInt(1, 20);
      b = randInt(0, a);
    }
  }
  const correctAnswer = operator === "+" ? a + b : a - b;
  return { a, b, operator, correctAnswer };
}

function generateOptions(correct: number): number[] {
  const set = new Set<number>([correct]);
  while (set.size < 3) {
    const candidate = correct + randInt(-3, 3);
    if (candidate >= 0 && candidate !== correct) set.add(candidate);
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
  const top = useAnimationControls();
  const bottom = useAnimationControls();
  const stage = useAnimationControls();
  const [flash, setFlash] = useState<Side | null>(null);
  const [poses, setPoses] = useState<Record<Side, Pose>>({ top: "idle", bottom: "idle" });
  const [popups, setPopups] = useState<Popup[]>([]);
  const [bursts, setBursts] = useState<Popup[]>([]);
  const [ko, setKo] = useState<Side | null>(null);
  const idRef = useRef(0);
  const controls = { top, bottom };

  const strike = async (attacker: Side, text: string, shake: boolean) => {
    const defender: Side = attacker === "top" ? "bottom" : "top";
    const dir = attacker === "top" ? 1 : -1;
    setPoses({ [attacker]: "attack", [defender]: "idle" } as Record<Side, Pose>);
    // Lunge (150ms)
    await controls[attacker].start({ y: dir * 55, transition: { duration: 0.15, ease: "easeIn" } });
    // Impact frame
    const id = ++idRef.current;
    setFlash(defender);
    setPoses({ [attacker]: "attack", [defender]: "hit" } as Record<Side, Pose>);
    controls[defender].set({ scaleY: 0.8 });
    setPopups((p) => [...p, { id, side: defender, text }]);
    setBursts((b) => [...b, { id, side: defender, text: "" }]);
    // Hitstop: freeze everything for 100ms
    await wait(100);
    if (shake) void stage.start({ x: [0, 4, -4, 4, -4, 0], transition: { duration: 0.2 } });
    void controls[defender].start({ scaleY: 1, transition: { type: "spring", stiffness: 600, damping: 10 } });
    await controls[attacker].start({ y: 0, transition: { duration: 0.15, ease: "easeOut" } });
    setTimeout(() => setFlash((f) => (f === defender ? null : f)), 150);
    setTimeout(() => {
      setPopups((p) => p.filter((x) => x.id !== id));
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 1000);
    await wait(150);
    setPoses({ top: "idle", bottom: "idle" });
  };

  const dodge = async (side: Side, text: string) => {
    const id = ++idRef.current;
    setPopups((p) => [...p, { id, side, text }]);
    await controls[side].start({ x: [0, 30, 0], transition: { duration: 0.35 } });
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 900);
  };

  const knockOut = async (side: Side) => {
    setKo(side);
    await controls[side].start({
      rotate: side === "top" ? -80 : 80,
      opacity: 0.5,
      transition: { duration: 0.9, ease: "easeOut" },
    });
  };

  return { controls, stage, flash, poses, popups, bursts, ko, strike, dodge, knockOut };
}
type FightFx = ReturnType<typeof useFightFx>;

function StarBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3">
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

function FighterSlot({
  fx,
  side,
  color,
  flipped,
}: {
  fx: FightFx;
  side: Side;
  color: string;
  flipped?: boolean;
}) {
  return (
    <div className="relative flex justify-center" style={{ height: 150 }}>
      <motion.div
        animate={fx.controls[side]}
        style={{ color: fx.flash === side ? "var(--dojo-danger)" : color, originY: 1 }}
      >
        <Stickman pose={fx.poses[side]} flipped={flipped} />
      </motion.div>
      {fx.bursts
        .filter((b) => b.side === side)
        .map((b) => (
          <StarBurst key={b.id} />
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
              className="pointer-events-none absolute top-4 whitespace-nowrap text-3xl font-black text-[var(--dojo-danger)]"
              style={{ textShadow: "0 2px 0 white, 0 -2px 0 white, 2px 0 0 white, -2px 0 0 white" }}
            >
              {p.text}
            </motion.div>
          ))}
      </AnimatePresence>
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
    <svg viewBox="0 0 100 140" className="h-28 w-20" style={{ transform: flipped ? "scaleX(-1)" : undefined }}>
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

function BigButton({
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
    <div className="flex w-full flex-col gap-2 rounded-3xl bg-white/70 p-4 shadow-inner">
      <div className="text-center text-lg font-black text-[var(--dojo-primary)]">{title}</div>
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
            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left shadow-lg active:scale-95 transition-transform ${
              k === "light"
                ? "bg-[var(--dojo-secondary)] text-[var(--dojo-secondary-foreground)]"
                : k === "medium"
                  ? "bg-[var(--dojo-accent)] text-[var(--dojo-accent-foreground)]"
                  : "bg-[var(--dojo-danger)] text-[var(--dojo-primary-foreground)]"
            }`}
          >
            <span className="text-xl font-black">
              {p.emoji} {p.label}
            </span>
            <span className="text-right text-xs font-bold leading-tight">
              Hit -{p.damage}
              <br />
              {p.risk}
            </span>
          </button>
        );
      })}
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
  const timerPct = (timeRemaining / QUESTION_TIME) * 100;
  const isFastWindow = QUESTION_TIME - timeRemaining <= FAST_ANSWER_THRESHOLD;
  return (
    <div className="relative flex w-full flex-col items-center gap-3 rounded-3xl bg-white/70 p-4 shadow-inner">
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
      <div className="flex w-full flex-col gap-2">
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
    setOptions(generateOptions(q.correctAnswer));
    setTimeRemaining(QUESTION_TIME);
    startRef.current = Date.now();
    setPhase("question");
  };

  useEffect(() => {
    if (phase !== "question") return;
    const id = setInterval(() => {
      const remaining = QUESTION_TIME - (Date.now() - startRef.current) / 1000;
      if (remaining <= 0) {
        setTimeRemaining(0);
        timeoutRef.current();
      } else setTimeRemaining(remaining);
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

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
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
          <Stickman pose="idle" />
        </motion.div>
        <div className="self-center text-4xl">⚔️</div>
        <motion.div
          className="text-[var(--dojo-danger)]"
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
      await fx.strike("bottom", `-${r.damage}`, r.ultimate || round.punch !== "light");
    } else if (r.counter > 0) {
      sfx.whoosh();
      await wait(120);
      sfx.punch(round.punch === "heavy");
      playHitAnimation("player");
      me -= r.counter;
      setPlayerHealth(me);
      await fx.strike("top", `-${r.counter}`, true);
    } else {
      sfx.whoosh();
      await fx.dodge("top", "Miss!");
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
    <motion.div animate={fx.stage} className="flex min-h-screen flex-col bg-[var(--dojo-bg)] px-4 py-4">
      <KOOverlay show={fx.ko !== null} />
      <div className="mb-2 flex justify-center">
        <BeltBadge wins={wins} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <HealthBar value={npcHealth} max={START_NPC_HEALTH} color="var(--dojo-danger)" label="👹 Boss" />
        <FighterSlot fx={fx} side="top" color="var(--dojo-danger)" flipped />
      </div>

      <div className="my-2 flex flex-1 flex-col items-center justify-center">
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

      <div className="flex flex-col items-center gap-1">
        <FighterSlot fx={fx} side="bottom" color="var(--dojo-primary)" />
        <FastMeter streak={streak} />
        <HealthBar value={playerHealth} max={START_PLAYER_HEALTH} color="var(--dojo-primary)" label="🧒 You" />
        <button type="button" onClick={onHome} className="mt-2 text-sm font-bold text-foreground/60 underline">
          Back to home
        </button>
      </div>
    </motion.div>
  );
}

// ---------- Two Player Battle ----------

function LevelSlider({ label, value, onChange, accent }: { label: string; value: number; onChange: (n: number) => void; accent: string }) {
  return (
    <div className="w-full rounded-3xl bg-white/70 p-4 shadow-inner">
      <div className="flex justify-between text-lg font-black" style={{ color: accent }}>
        <span>{label}</span>
        <span>Level {value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={20}
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
      await fx.strike(sideOf(attacker), `-${r.damage}`, r.ultimate || round.punch !== "light");
    } else if (r.counter > 0) {
      sfx.whoosh();
      await wait(120);
      sfx.punch(round.punch === "heavy");
      next[attacker] -= r.counter;
      setHealth(next);
      await fx.strike(sideOf(defender), `-${r.counter}`, true);
    } else {
      sfx.whoosh();
      await fx.dodge(sideOf(defender), "Miss!");
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
  const name = isP1 ? "Player 1" : "Player 2";

  return (
    <motion.div animate={fx.stage} className="flex min-h-screen flex-col bg-[var(--dojo-bg)]">
      <KOOverlay show={fx.ko !== null} />
      <div className={`flex flex-col items-center gap-1 border-b-4 p-3 ${!isP1 ? "border-pink-500 bg-pink-50" : "border-transparent"}`}>
        <HealthBar value={health.player2} max={TP_START_HEALTH} color="#ec4899" label={`🌸 Player 2 • Lv ${levels.player2}`} />
        <FighterSlot fx={fx} side="top" color="#ec4899" flipped />
        {!isP1 && (
          <div className="rounded-full bg-pink-500 px-4 py-1 text-sm font-black text-white">
            PLAYER 2 ATTACKS — answer to strike!
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-3">
        {round.phase === "choose" ? (
          <PunchPicker
            title={`${name}: choose your punch!`}
            onPick={(p) => round.begin(p, levels[turn])}
          />
        ) : (
          <QuestionCard
            question={round.question}
            options={round.options}
            timeRemaining={round.timeRemaining}
            timerColor={isP1 ? "#0ea5e9" : "#ec4899"}
            onAnswer={(v) => void finish(v === round.question.correctAnswer)}
            disabled={round.phase !== "question"}
            answerVariant={isP1 ? "p1" : "p2"}
            headerText={`${name} attacks • ${PUNCHES[round.punch].label}`}
            flash={flash}
          />
        )}
      </div>

      <div className={`flex flex-col items-center gap-1 border-t-4 p-3 ${isP1 ? "border-sky-500 bg-sky-50" : "border-transparent"}`}>
        {isP1 && (
          <div className="rounded-full bg-sky-500 px-4 py-1 text-sm font-black text-white">
            PLAYER 1 ATTACKS — answer to strike!
          </div>
        )}
        <FighterSlot fx={fx} side="bottom" color="#0ea5e9" />
        <FastMeter streak={streaks[turn]} />
        <HealthBar value={health.player1} max={TP_START_HEALTH} color="#0ea5e9" label={`🌊 Player 1 • Lv ${levels.player1}`} />
        <button type="button" onClick={onHome} className="text-sm font-bold text-foreground/60 underline">
          Back to home
        </button>
      </div>
    </motion.div>
  );
}

// ---------- Training (unchanged) ----------

function TrainingScreen({ onHome }: { onHome: () => void }) {
  const [level, setLevel] = useState(1);
  const [question, setQuestion] = useState<Question>(() => generateQuestion(1));
  const [options, setOptions] = useState<number[]>(() => generateOptions(question.correctAnswer));
  const [feedback, setFeedback] = useState<string | null>(null);

  const hint = useMemo(() => {
    const { a, b, operator, correctAnswer } = question;
    if (operator === "+") {
      if (b === 1) return `To do ${a} + 1, just count one step up from ${a} to ${a + 1}.`;
      if (a === 10 || b === 10) return `Adding 10 is easy — the tens digit goes up by 1!`;
      if (a + b === 10) return `${a} and ${b} are best friends — they make 10!`;
      return `Try starting at ${a} and taking ${b} steps forward. You land on ${correctAnswer}.`;
    }
    if (b === 0) return `Taking away 0 leaves everything: still ${a}.`;
    if (a === b) return `When both numbers are the same, the answer is 0.`;
    return `Start at ${a} and take ${b} steps back. You land on ${correctAnswer}.`;
  }, [question]);

  const next = () => {
    const nextLevel = level < 20 ? level + 1 : 1;
    setLevel(nextLevel);
    const q = generateQuestion(nextLevel);
    setQuestion(q);
    setOptions(generateOptions(q.correctAnswer));
    setFeedback(null);
  };

  const handleAnswer = (v: number) => {
    setFeedback(v === question.correctAnswer ? `✅ Nice! ${hint}` : `❌ Not quite. ${hint}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--dojo-bg)] px-6 py-8">
      <h2 className="text-3xl font-black text-[var(--dojo-primary)]">Training</h2>
      <p className="mt-1 text-sm text-foreground/70">Calm practice. No fighting.</p>
      <div className="mt-6 w-full max-w-sm rounded-3xl bg-white/70 p-6 shadow-inner">
        <div className="text-center text-5xl font-black text-[var(--dojo-primary)]">
          {question.a} {question.operator} {question.b} = ?
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {options.map((opt) => (
            <BigButton key={opt} variant="answer" onClick={() => handleAnswer(opt)}>
              {opt}
            </BigButton>
          ))}
        </div>
        {feedback && (
          <div className="mt-4 rounded-2xl bg-[var(--dojo-secondary)] p-3 text-center text-base font-semibold text-[var(--dojo-secondary-foreground)]">
            {feedback}
          </div>
        )}
      </div>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <BigButton onClick={next} variant="primary">
          Next question →
        </BigButton>
        <BigButton onClick={onHome} variant="secondary">
          ← Back to home
        </BigButton>
      </div>
    </div>
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
        <input type="range" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-4 w-full" />
        <div className="mt-2 flex justify-between text-xs font-bold text-foreground/60">
          <span>1</span>
          <span>20</span>
        </div>
        <div className="mt-4 text-center text-sm text-foreground/70">
          {level <= 5 && "Addition 0–10"}
          {level > 5 && level <= 10 && "Addition 0–20"}
          {level > 10 && level <= 15 && "Subtraction 0–10"}
          {level > 15 && "Mixed +/− 0–20"}
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
          {screen === "training" && <TrainingScreen onHome={home} />}
          {screen === "settings" && <SettingsScreen level={currentLevel} setLevel={setCurrentLevel} onHome={home} />}
          {screen === "victory" && <ResultScreen kind="victory" wins={wins} onRetry={startBattle} onHome={home} />}
          {screen === "defeat" && <ResultScreen kind="defeat" wins={wins} onRetry={startBattle} onHome={home} />}
          {screen === "two-player-result" && <TwoPlayerResultScreen winner={tpWinner} onRetry={startTwoPlayer} onHome={home} />}
        </ScreenFade>
      </AnimatePresence>
    </div>
  );
}
