import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DaughterSprite } from "./DaughterSprite";
import type { AnimationType } from "./spriteConfig";

const DAUGHTER_SPRITE_URL = "/assets/daughter-sprite.png";

function poseToAnimation(pose: "idle" | "hit" | "attack" | "block"): AnimationType {
  if (pose === "attack") return "punch";
  return "idle";
}

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

interface Question {
  a: number;
  b: number;
  operator: Operator;
  correctAnswer: number;
}

const QUESTION_TIME = 5;
const FAST_ANSWER_THRESHOLD = 1; // seconds
const BIG_DAMAGE = 30;
const SMALL_DAMAGE = 15;
const NPC_DAMAGE = 10;
const START_NPC_HEALTH = 300;
const START_PLAYER_HEALTH = 100;

// Two-player tuning
const TP_START_HEALTH = 100;
const TP_COUNTER_DAMAGE = 15;
const TP_STRIKE_DAMAGE = 20;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateQuestion(level: number): Question {
  let a: number;
  let b: number;
  let operator: Operator = "+";
  if (level <= 5) {
    a = randInt(0, 10);
    b = randInt(0, 10 - a);
    operator = "+";
  } else if (level <= 10) {
    a = randInt(0, 20);
    b = randInt(0, 20 - a);
    operator = "+";
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
    const delta = randInt(-3, 3);
    const candidate = correct + delta;
    if (candidate >= 0 && candidate !== correct) set.add(candidate);
  }
  const arr = Array.from(set);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Placeholder animation hooks ----------
function playHitAnimation(target: string) {
  console.log(`hit anim on ${target}`);
}
function playBlockAnimation(target: string) {
  console.log(`block anim on ${target}`);
}
function playUltimateAnimation() {
  console.log("ULTIMATE!");
}

// ---------- Shared UI ----------

function HealthBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
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
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Stickman({
  pose,
  flipped,
}: {
  pose: "idle" | "hit" | "attack" | "block";
  flipped?: boolean;
}) {
  const color = "currentColor";
  const armAngle = pose === "attack" ? -40 : pose === "hit" ? 20 : pose === "block" ? -10 : 0;
  return (
    <svg
      viewBox="0 0 100 140"
      className={`h-28 w-20 ${pose === "hit" ? "animate-pulse" : ""}`}
      style={{ transform: flipped ? "scaleX(-1)" : undefined }}
    >
      <circle cx="50" cy="20" r="14" stroke={color} strokeWidth="4" fill="none" />
      <line x1="50" y1="34" x2="50" y2="80" stroke={color} strokeWidth="4" />
      <line x1="50" y1="50" x2={50 - 25} y2={50 + armAngle} stroke={color} strokeWidth="4" />
      <line x1="50" y1="50" x2={50 + 25} y2={50 + armAngle} stroke={color} strokeWidth="4" />
      <line x1="50" y1="80" x2="30" y2="120" stroke={color} strokeWidth="4" />
      <line x1="50" y1="80" x2="70" y2="120" stroke={color} strokeWidth="4" />
      {pose === "block" && (
        <rect
          x="20"
          y="45"
          width="12"
          height="30"
          rx="2"
          stroke={color}
          strokeWidth="3"
          fill="none"
        />
      )}
    </svg>
  );
}

function ComboMeter({ combo }: { combo: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-foreground">COMBO</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full border-2 border-foreground/40 ${
            i < combo ? "bg-[var(--dojo-accent)]" : "bg-transparent"
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "answer" | "p1" | "p2";
  disabled?: boolean;
}) {
  const base =
    "w-full rounded-2xl px-6 py-5 text-2xl font-black shadow-lg active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100";
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
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
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
  return (
    <div className="relative flex w-full flex-col items-center gap-3 rounded-3xl bg-white/70 p-4 shadow-inner">
      {flash && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[var(--dojo-accent)]/90 px-2 text-center text-2xl font-black text-[var(--dojo-accent-foreground)]">
          {flash}
        </div>
      )}
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all"
            style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
          />
        </div>
        <div className="mt-1 text-center text-xs font-bold text-foreground/70">
          {timeRemaining.toFixed(1)}s{headerText ? ` • ${headerText}` : ""}
        </div>
      </div>
      <div className="text-4xl font-black text-[var(--dojo-primary)]">
        {question.a} {question.operator} {question.b} = ?
      </div>
      <div className="flex w-full flex-col gap-2">
        {options.map((opt) => (
          <BigButton
            key={opt}
            variant={answerVariant}
            onClick={() => onAnswer(opt)}
            disabled={disabled}
          >
            {opt}
          </BigButton>
        ))}
      </div>
    </div>
  );
}

// ---------- Home ----------

function HomeScreen({
  onPlay,
  onTwoPlayer,
  onTrain,
  onSettings,
}: {
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
        <p className="mt-2 text-center text-base text-foreground/70">
          Answer fast. Punch harder!
        </p>
      </div>

      <div className="flex w-full items-center justify-center gap-4 py-4">
        <DaughterSprite animationType="idle" isAnimating spriteUrl={DAUGHTER_SPRITE_URL} />
        <div className="self-center text-4xl">⚔️</div>
        <DaughterSprite animationType="idle" isAnimating spriteUrl={DAUGHTER_SPRITE_URL} flipped />
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
  onVictory,
  onDefeat,
  onHome,
}: {
  level: number;
  onVictory: () => void;
  onDefeat: () => void;
  onHome: () => void;
}) {
  const [playerHealth, setPlayerHealth] = useState(START_PLAYER_HEALTH);
  const [npcHealth, setNpcHealth] = useState(START_NPC_HEALTH);
  const [comboCount, setComboCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question>(() =>
    generateQuestion(level),
  );
  const [answerOptions, setAnswerOptions] = useState<number[]>(() =>
    generateOptions(currentQuestion.correctAnswer),
  );
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME);
  const [playerPose, setPlayerPose] = useState<"idle" | "hit" | "attack" | "block">("idle");
  const [npcPose, setNpcPose] = useState<"idle" | "hit" | "attack" | "block">("idle");
  const [flash, setFlash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const questionStartRef = useRef<number>(Date.now());

  const nextQuestion = useCallback(() => {
    const q = generateQuestion(level);
    setCurrentQuestion(q);
    setAnswerOptions(generateOptions(q.correctAnswer));
    setTimeRemaining(QUESTION_TIME);
    questionStartRef.current = Date.now();
    setLocked(false);
    setPlayerPose("idle");
    setNpcPose("idle");
  }, [level]);

  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const remaining = QUESTION_TIME - elapsed;
      if (remaining <= 0) {
        setTimeRemaining(0);
        setLocked(true);
        setPlayerHealth((h) => h - NPC_DAMAGE);
        setComboCount(0);
        setNpcPose("attack");
        setPlayerPose("hit");
        playHitAnimation("player");
        setFlash("Too slow!");
        setTimeout(() => {
          setFlash(null);
          nextQuestion();
        }, 900);
      } else {
        setTimeRemaining(remaining);
      }
    }, 100);
    return () => clearInterval(id);
  }, [locked, nextQuestion]);

  useEffect(() => {
    if (npcHealth <= 0) {
      setTimeout(onVictory, 500);
    } else if (playerHealth <= 0) {
      setTimeout(onDefeat, 500);
    }
  }, [npcHealth, playerHealth, onVictory, onDefeat]);

  const handleAnswer = (value: number) => {
    if (locked) return;
    setLocked(true);
    const elapsed = (Date.now() - questionStartRef.current) / 1000;
    const isCorrect = value === currentQuestion.correctAnswer;

    if (isCorrect && elapsed <= FAST_ANSWER_THRESHOLD) {
      const newCombo = comboCount + 1;
      setPlayerPose("attack");
      setNpcPose("hit");
      playHitAnimation("npc");

      if (newCombo >= 3) {
        playUltimateAnimation();
        setFlash("⚡ ULTIMATE STRIKE! ⚡");
        setNpcHealth((h) => h - 150);
        setComboCount(0);
      } else {
        setFlash(`FAST! -${BIG_DAMAGE}`);
        setNpcHealth((h) => h - BIG_DAMAGE);
        setComboCount(newCombo);
      }
    } else if (isCorrect) {
      setPlayerPose("attack");
      setNpcPose("hit");
      playHitAnimation("npc");
      setFlash(`Hit! -${SMALL_DAMAGE}`);
      setNpcHealth((h) => h - SMALL_DAMAGE);
      setComboCount(0);
    } else {
      setPlayerPose("hit");
      setNpcPose("attack");
      playHitAnimation("player");
      setFlash("Miss!");
      setPlayerHealth((h) => h - NPC_DAMAGE);
      setComboCount(0);
    }

    setTimeout(() => {
      setFlash(null);
      nextQuestion();
    }, 900);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--dojo-bg)] px-4 py-4">
      <div className="flex flex-col items-center gap-2">
        <HealthBar
          value={npcHealth}
          max={START_NPC_HEALTH}
          color="var(--dojo-danger)"
          label="👹 Boss"
        />
        <div className="flex justify-center" style={{ height: 170 }}>
          <DaughterSprite
            animationType={poseToAnimation(npcPose)}
            isAnimating
            spriteUrl={DAUGHTER_SPRITE_URL}
          />
        </div>
      </div>

      <div className="my-4 flex flex-1 flex-col items-center justify-center">
        <QuestionCard
          question={currentQuestion}
          options={answerOptions}
          timeRemaining={timeRemaining}
          timerColor="var(--dojo-primary)"
          onAnswer={handleAnswer}
          disabled={locked}
          headerText={`Level ${level}`}
          flash={flash}
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-[var(--dojo-primary)] flex justify-center" style={{ height: 170 }}>
          <DaughterSprite
            animationType={poseToAnimation(playerPose)}
            isAnimating={true}
            spriteUrl={DAUGHTER_SPRITE_URL}
          />
        </div>
        <ComboMeter combo={comboCount} />
        <HealthBar
          value={playerHealth}
          max={START_PLAYER_HEALTH}
          color="var(--dojo-primary)"
          label="🧒 You"
        />
        <button
          type="button"
          onClick={onHome}
          className="mt-2 text-sm font-bold text-foreground/60 underline"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

// ---------- Two Player Battle ----------

function TwoPlayerBattleScreen({
  level,
  onFinish,
  onHome,
}: {
  level: number;
  onFinish: (winner: PlayerId) => void;
  onHome: () => void;
}) {
  const [p1Health, setP1Health] = useState(TP_START_HEALTH);
  const [p2Health, setP2Health] = useState(TP_START_HEALTH);
  const [currentTurn, setCurrentTurn] = useState<PlayerId>("player1");
  const [currentQuestion, setCurrentQuestion] = useState<Question>(() =>
    generateQuestion(level),
  );
  const [answerOptions, setAnswerOptions] = useState<number[]>(() =>
    generateOptions(currentQuestion.correctAnswer),
  );
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME);
  const [flash, setFlash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const questionStartRef = useRef<number>(Date.now());

  const nextTurn = useCallback(() => {
    setCurrentTurn((t) => (t === "player1" ? "player2" : "player1"));
    const q = generateQuestion(level);
    setCurrentQuestion(q);
    setAnswerOptions(generateOptions(q.correctAnswer));
    setTimeRemaining(QUESTION_TIME);
    questionStartRef.current = Date.now();
    setLocked(false);
  }, [level]);

  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const remaining = QUESTION_TIME - elapsed;
      if (remaining <= 0) {
        setTimeRemaining(0);
        setLocked(true);
        // failed to block -> takes damage
        if (currentTurn === "player1") {
          setP1Health((h) => h - TP_STRIKE_DAMAGE);
        } else {
          setP2Health((h) => h - TP_STRIKE_DAMAGE);
        }
        playHitAnimation(currentTurn);
        setFlash("Too slow! Took a hit!");
        setTimeout(() => {
          setFlash(null);
          nextTurn();
        }, 1000);
      } else {
        setTimeRemaining(remaining);
      }
    }, 100);
    return () => clearInterval(id);
  }, [locked, nextTurn, currentTurn]);

  useEffect(() => {
    if (p1Health <= 0) setTimeout(() => onFinish("player2"), 400);
    else if (p2Health <= 0) setTimeout(() => onFinish("player1"), 400);
  }, [p1Health, p2Health, onFinish]);

  const handleAnswer = (value: number) => {
    if (locked) return;
    setLocked(true);
    const elapsed = (Date.now() - questionStartRef.current) / 1000;
    const isCorrect = value === currentQuestion.correctAnswer;
    const attacker = currentTurn;
    const defender: PlayerId = attacker === "player1" ? "player2" : "player1";

    if (isCorrect && elapsed <= FAST_ANSWER_THRESHOLD) {
      playBlockAnimation(attacker);
      playHitAnimation(defender);
      setFlash(`Blocked + Counter! -${TP_COUNTER_DAMAGE}`);
      if (defender === "player1") setP1Health((h) => h - TP_COUNTER_DAMAGE);
      else setP2Health((h) => h - TP_COUNTER_DAMAGE);
    } else if (isCorrect) {
      playBlockAnimation(attacker);
      setFlash("Blocked!");
    } else {
      playHitAnimation(attacker);
      setFlash(`Hit! -${TP_STRIKE_DAMAGE}`);
      if (attacker === "player1") setP1Health((h) => h - TP_STRIKE_DAMAGE);
      else setP2Health((h) => h - TP_STRIKE_DAMAGE);
    }

    setTimeout(() => {
      setFlash(null);
      nextTurn();
    }, 1000);
  };

  const isP1Turn = currentTurn === "player1";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--dojo-bg)]">
      {/* Player 2 (top, rotated feel via label) */}
      <div
        className={`flex flex-col items-center gap-2 border-b-4 p-3 ${
          !isP1Turn ? "border-pink-500 bg-pink-50" : "border-transparent"
        }`}
      >
        <HealthBar
          value={p2Health}
          max={TP_START_HEALTH}
          color="#ec4899"
          label="🌸 Player 2"
        />
        <div className="flex justify-center" style={{ height: 170 }}>
          <DaughterSprite animationType="idle" isAnimating spriteUrl={DAUGHTER_SPRITE_URL} />
        </div>
        {!isP1Turn && (
          <div className="rounded-full bg-pink-500 px-4 py-1 text-sm font-black text-white">
            PLAYER 2 — YOUR TURN
          </div>
        )}
      </div>

      {/* Center question — belongs to active player */}
      <div className="flex flex-1 items-center justify-center px-4 py-3">
        <QuestionCard
          question={currentQuestion}
          options={answerOptions}
          timeRemaining={timeRemaining}
          timerColor={isP1Turn ? "#0ea5e9" : "#ec4899"}
          onAnswer={handleAnswer}
          disabled={locked}
          answerVariant={isP1Turn ? "p1" : "p2"}
          headerText={isP1Turn ? "Player 1 defends" : "Player 2 defends"}
          flash={flash}
        />
      </div>

      {/* Player 1 (bottom) */}
      <div
        className={`flex flex-col items-center gap-2 border-t-4 p-3 ${
          isP1Turn ? "border-sky-500 bg-sky-50" : "border-transparent"
        }`}
      >
        {isP1Turn && (
          <div className="rounded-full bg-sky-500 px-4 py-1 text-sm font-black text-white">
            PLAYER 1 — YOUR TURN
          </div>
        )}
        <div className="flex justify-center" style={{ height: 170 }}>
          <DaughterSprite animationType="idle" isAnimating spriteUrl={DAUGHTER_SPRITE_URL} flipped />
        </div>
        <HealthBar
          value={p1Health}
          max={TP_START_HEALTH}
          color="#0ea5e9"
          label="🌊 Player 1"
        />
        <button
          type="button"
          onClick={onHome}
          className="text-sm font-bold text-foreground/60 underline"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

// ---------- Training ----------

function TrainingScreen({ onHome }: { onHome: () => void }) {
  const [level, setLevel] = useState(1);
  const [question, setQuestion] = useState<Question>(() => generateQuestion(1));
  const [options, setOptions] = useState<number[]>(() =>
    generateOptions(question.correctAnswer),
  );
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
    if (v === question.correctAnswer) {
      setFeedback(`✅ Nice! ${hint}`);
    } else {
      setFeedback(`❌ Not quite. ${hint}`);
    }
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
  onRetry,
  onHome,
}: {
  kind: "victory" | "defeat";
  onRetry: () => void;
  onHome: () => void;
}) {
  const isWin = kind === "victory";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--dojo-bg)] px-6 py-10">
      <div className="text-7xl">{isWin ? "🏆" : "💪"}</div>
      <h2 className="text-center text-4xl font-black text-[var(--dojo-primary)]">
        {isWin ? "Victory!" : "Try Again!"}
      </h2>
      <p className="text-center text-base text-foreground/70">
        {isWin
          ? "You crushed the boss with math power!"
          : "You're getting stronger. One more try!"}
      </p>
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

function TwoPlayerResultScreen({
  winner,
  onRetry,
  onHome,
}: {
  winner: PlayerId;
  onRetry: () => void;
  onHome: () => void;
}) {
  const isP1 = winner === "player1";
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10 ${
        isP1 ? "bg-sky-100" : "bg-pink-100"
      }`}
    >
      <div className="text-7xl">🏆</div>
      <h2
        className={`text-center text-4xl font-black ${isP1 ? "text-sky-600" : "text-pink-600"}`}
      >
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

function SettingsScreen({
  level,
  setLevel,
  onHome,
}: {
  level: number;
  setLevel: (n: number) => void;
  onHome: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--dojo-bg)] px-6 py-8">
      <h2 className="text-3xl font-black text-[var(--dojo-primary)]">Settings</h2>
      <p className="mt-1 text-sm text-foreground/70">Pick a starting level.</p>

      <div className="mt-6 w-full max-w-sm rounded-3xl bg-white/70 p-6 shadow-inner">
        <div className="text-center text-2xl font-black text-[var(--dojo-primary)]">
          Level {level}
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="mt-4 w-full"
        />
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

      <div className="mt-6 w-full max-w-sm">
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

  const startBattle = () => {
    setBattleKey((k) => k + 1);
    setScreen("battle");
  };
  const startTwoPlayer = () => {
    setBattleKey((k) => k + 1);
    setScreen("two-player");
  };

  return (
    <div className="mx-auto max-w-md">
      {screen === "home" && (
        <HomeScreen
          onPlay={startBattle}
          onTwoPlayer={startTwoPlayer}
          onTrain={() => setScreen("training")}
          onSettings={() => setScreen("settings")}
        />
      )}
      {screen === "battle" && (
        <BattleScreen
          key={battleKey}
          level={currentLevel}
          onVictory={() => {
            setCurrentLevel((l) => Math.min(20, l + 1));
            setScreen("victory");
          }}
          onDefeat={() => setScreen("defeat")}
          onHome={() => setScreen("home")}
        />
      )}
      {screen === "two-player" && (
        <TwoPlayerBattleScreen
          key={battleKey}
          level={currentLevel}
          onFinish={(w) => {
            setTpWinner(w);
            setScreen("two-player-result");
          }}
          onHome={() => setScreen("home")}
        />
      )}
      {screen === "training" && <TrainingScreen onHome={() => setScreen("home")} />}
      {screen === "settings" && (
        <SettingsScreen
          level={currentLevel}
          setLevel={setCurrentLevel}
          onHome={() => setScreen("home")}
        />
      )}
      {screen === "victory" && (
        <ResultScreen kind="victory" onRetry={startBattle} onHome={() => setScreen("home")} />
      )}
      {screen === "defeat" && (
        <ResultScreen kind="defeat" onRetry={startBattle} onHome={() => setScreen("home")} />
      )}
      {screen === "two-player-result" && (
        <TwoPlayerResultScreen
          winner={tpWinner}
          onRetry={startTwoPlayer}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  );
}
