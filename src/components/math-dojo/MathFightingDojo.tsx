import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Screen = "home" | "battle" | "training" | "victory" | "defeat";
type Operator = "+" | "-";

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
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Placeholder animation hooks ----------
function playHitAnimation(target: "npc" | "player") {
  // Placeholder for future visual improvements
  console.log(`hit anim on ${target}`);
}
function playUltimateAnimation() {
  console.log("ULTIMATE!");
}

// ---------- Components ----------

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

function Stickman({ pose, flipped }: { pose: "idle" | "hit" | "attack"; flipped?: boolean }) {
  const color = "currentColor";
  const armAngle = pose === "attack" ? -40 : pose === "hit" ? 20 : 0;
  return (
    <svg
      viewBox="0 0 100 140"
      className={`h-32 w-24 ${pose === "hit" ? "animate-pulse" : ""}`}
      style={{ transform: flipped ? "scaleX(-1)" : undefined }}
    >
      <circle cx="50" cy="20" r="14" stroke={color} strokeWidth="4" fill="none" />
      <line x1="50" y1="34" x2="50" y2="80" stroke={color} strokeWidth="4" />
      <line
        x1="50"
        y1="50"
        x2={50 - 25}
        y2={50 + armAngle}
        stroke={color}
        strokeWidth="4"
      />
      <line
        x1="50"
        y1="50"
        x2={50 + 25}
        y2={50 + armAngle}
        stroke={color}
        strokeWidth="4"
      />
      <line x1="50" y1="80" x2="30" y2="120" stroke={color} strokeWidth="4" />
      <line x1="50" y1="80" x2="70" y2="120" stroke={color} strokeWidth="4" />
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
  variant?: "primary" | "secondary" | "answer";
  disabled?: boolean;
}) {
  const base =
    "w-full rounded-2xl px-6 py-5 text-2xl font-black shadow-lg active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100";
  const styles: Record<string, string> = {
    primary: "bg-[var(--dojo-primary)] text-[var(--dojo-primary-foreground)]",
    secondary: "bg-[var(--dojo-secondary)] text-[var(--dojo-secondary-foreground)] border-4 border-[var(--dojo-primary)]",
    answer: "bg-[var(--dojo-accent)] text-[var(--dojo-accent-foreground)]",
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

function HomeScreen({
  onPlay,
  onTrain,
}: {
  onPlay: () => void;
  onTrain: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[var(--dojo-bg)] px-6 py-10">
      <div className="flex flex-col items-center gap-2 pt-8">
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

      <div className="flex w-full justify-center gap-6 py-8 text-[var(--dojo-primary)]">
        <Stickman pose="idle" />
        <div className="self-center text-4xl">⚔️</div>
        <Stickman pose="idle" flipped />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <BigButton onClick={onPlay} variant="primary">
          ▶ Play Battle
        </BigButton>
        <BigButton onClick={onTrain} variant="secondary">
          🧠 Training
        </BigButton>
      </div>
    </div>
  );
}

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
  const [playerPose, setPlayerPose] = useState<"idle" | "hit" | "attack">("idle");
  const [npcPose, setNpcPose] = useState<"idle" | "hit" | "attack">("idle");
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

  // countdown timer
  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const remaining = QUESTION_TIME - elapsed;
      if (remaining <= 0) {
        setTimeRemaining(0);
        setLocked(true);
        // timeout = npc hits player
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

  // check win/lose
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
        // ULTIMATE
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

  const timerPct = (timeRemaining / QUESTION_TIME) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--dojo-bg)] px-4 py-4">
      {/* NPC */}
      <div className="flex flex-col items-center gap-2">
        <HealthBar
          value={npcHealth}
          max={START_NPC_HEALTH}
          color="var(--dojo-danger)"
          label="👹 Boss"
        />
        <div className="text-[var(--dojo-danger)]">
          <Stickman pose={npcPose} />
        </div>
      </div>

      {/* Center: question + timer + answers */}
      <div className="relative my-4 flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-white/70 p-4 shadow-inner">
        {flash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[var(--dojo-accent)]/90 text-3xl font-black text-[var(--dojo-accent-foreground)]">
            {flash}
          </div>
        )}
        <div className="w-full">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[var(--dojo-primary)] transition-all"
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <div className="mt-1 text-center text-xs font-bold text-foreground/70">
            {timeRemaining.toFixed(1)}s • Level {level}
          </div>
        </div>

        <div className="text-5xl font-black text-[var(--dojo-primary)]">
          {currentQuestion.a} {currentQuestion.operator} {currentQuestion.b} = ?
        </div>

        <div className="flex w-full flex-col gap-3">
          {answerOptions.map((opt) => (
            <BigButton key={opt} variant="answer" onClick={() => handleAnswer(opt)} disabled={locked}>
              {opt}
            </BigButton>
          ))}
        </div>
      </div>

      {/* Player */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-[var(--dojo-primary)]">
          <Stickman pose={playerPose} flipped />
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

      <div className="mt-8 w-full max-w-sm rounded-3xl bg-white/70 p-6 shadow-inner">
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

export function MathFightingDojo() {
  const [screen, setScreen] = useState<Screen>("home");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [battleKey, setBattleKey] = useState(0);

  const startBattle = () => {
    setBattleKey((k) => k + 1);
    setScreen("battle");
  };

  return (
    <div className="mx-auto max-w-md">
      {screen === "home" && (
        <HomeScreen onPlay={startBattle} onTrain={() => setScreen("training")} />
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
      {screen === "training" && <TrainingScreen onHome={() => setScreen("home")} />}
      {screen === "victory" && (
        <ResultScreen kind="victory" onRetry={startBattle} onHome={() => setScreen("home")} />
      )}
      {screen === "defeat" && (
        <ResultScreen kind="defeat" onRetry={startBattle} onHome={() => setScreen("home")} />
      )}
    </div>
  );
}
