import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfx } from "./sound";
import { Fighter, type FighterState } from "./Fighter";
import { BigButton, generateOptions, generateQuestion, type Operator, type Question } from "./MathFightingDojo";

const SESSION = 10;

function tipFor(q: Question): string {
  const { a, b, operator: op, correctAnswer: c } = q;
  if (op === "+") {
    if (a < 10 && a + b > 10) return `Make ten first: ${a} + ${10 - a} + ${b - (10 - a)} = ${c}.`;
    return `Start at the bigger number and count up: ${Math.max(a, b)} → ${c}.`;
  }
  if (op === "-") return `Count up from the smaller number: ${b} + ? = ${a}. It's ${c}!`;
  if (op === "×") {
    const n = Math.min(a, b), m = Math.max(a, b);
    if (n === 2) return `x2 means double: ${m} + ${m} = ${c}.`;
    if (n === 4) return `x4 means double twice: ${m} → ${m * 2} → ${c}.`;
    if (n === 5) return `x5 is half of x10: ${m * 10} → half is ${c}.`;
    if (n === 9 || m === 9) { const k = n === 9 ? m : n; return `x9 is x10 minus the number: ${k * 10} - ${k} = ${c}.`; }
    if (n === 10) return `x10 just adds a zero: ${m} → ${c}.`;
    return `Count by ${m}s, ${n} times: ${c}.`;
  }
  return `Think backwards: ${b} times what makes ${a}? ${b} × ${c} = ${a}.`;
}

function similar(q: Question): Question {
  const d = Math.random() < 0.5 ? -1 : 1;
  const { operator: op, level } = q;
  if (op === "+") { const a = Math.max(0, q.a + d); return { a, b: q.b, operator: op, correctAnswer: a + q.b, level }; }
  if (op === "-") { const a = Math.max(q.b, q.a + d); return { a, b: q.b, operator: op, correctAnswer: a - q.b, level }; }
  if (op === "×") { const a = Math.max(2, q.a + d); return { a, b: q.b, operator: op, correctAnswer: a * q.b, level }; }
  const ans = Math.max(1, q.correctAnswer + d);
  return { a: ans * q.b, b: q.b, operator: op, correctAnswer: ans, level };
}

const Dot = ({ delay, color, size = 18, crossed, from }: { delay: number; color: string; size?: number; crossed?: number; from?: { x: number; y: number } }) => (
  <motion.div
    className="relative rounded-full"
    style={{ width: size, height: size, background: color }}
    initial={{ opacity: 0, scale: 0, x: from?.x ?? 0, y: from?.y ?? 0 }}
    animate={{ opacity: crossed !== undefined ? [0, 1, 1, 0.25] : 1, scale: 1, x: 0, y: 0 }}
    transition={crossed !== undefined ? { delay, duration: crossed - delay + 0.4, times: [0, 0.1, 0.8, 1] } : { delay, type: "spring", stiffness: 260, damping: 18 }}
  >
    {crossed !== undefined && (
      <motion.span className="absolute inset-0 flex items-center justify-center text-xs font-black text-[var(--dojo-danger)]"
        initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: crossed }}>✕</motion.span>
    )}
  </motion.div>
);

const Caption = ({ delay, children }: { delay: number; children: React.ReactNode }) => (
  <motion.div className="mt-3 rounded-xl bg-[var(--dojo-accent)] px-3 py-2 text-center text-lg font-black text-[var(--dojo-accent-foreground)]"
    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, type: "spring" }}>
    {children}
  </motion.div>
);

const A = "var(--dojo-primary)", B = "var(--dojo-accent)", HI = "var(--dojo-danger)";

export function VisualExplainer({ a, op, b }: { a: number; op: Operator; b: number }) {
  if (op === "+") {
    const total = a + b, makeTen = a < 10 && total > 10, fill = makeTen ? 10 - a : 0;
    const step = 0.12, bStart = a * step + 0.4, end = bStart + b * step + 0.3;
    const dots = Array.from({ length: total }, (_, i) => {
      const fromB = i >= a;
      const toTen = fromB && i - a < fill;
      return { delay: fromB ? bStart + (i - a) * step : i * step, color: fromB ? (toTen ? HI : B) : A, from: fromB ? { x: 0, y: 60 } : undefined };
    });
    const rows = [dots.slice(0, 10), dots.slice(10)].filter((r) => r.length);
    return (
      <div>
        {rows.map((r, ri) => (
          <motion.div key={ri} className="mb-2 flex flex-wrap gap-1.5 rounded-xl p-1.5"
            animate={ri === 0 && total >= 10 ? { backgroundColor: ["rgba(0,0,0,0)", "rgba(255,200,0,0.35)"] } : {}}
            transition={{ delay: end }}>
            {r.map((d, i) => <Dot key={i} {...d} />)}
          </motion.div>
        ))}
        <Caption delay={end + 0.2}>
          {makeTen ? <>{a} + {fill} = 10, then 10 + {total - 10} = {total}</> : <>{a} + {b} = {total}</>}
        </Caption>
      </div>
    );
  }
  if (op === "-") {
    const step = 0.1, crossStart = a * step + 0.4, end = crossStart + b * 0.15 + 0.4;
    return (
      <div>
        <div className="flex max-w-[260px] flex-wrap gap-1.5">
          {Array.from({ length: a }, (_, i) => {
            const gone = i >= a - b;
            return <Dot key={i} delay={i * step} color={gone ? B : A} crossed={gone ? crossStart + (i - (a - b)) * 0.15 : undefined} />;
          })}
        </div>
        <Caption delay={end}>{a} take away {b} leaves {a - b}</Caption>
      </div>
    );
  }
  if (op === "×") {
    const size = a * b > 60 ? 12 : 18, rowStep = 0.35, end = a * rowStep + 0.3;
    return (
      <div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: a }, (_, r) => (
            <motion.div key={r} className="flex gap-1 rounded-lg px-1"
              animate={{ backgroundColor: ["rgba(0,0,0,0)", "rgba(255,200,0,0.35)"] }} transition={{ delay: end + r * 0.08 }}>
              {Array.from({ length: b }, (_, c) => <Dot key={c} size={size} delay={r * rowStep + c * 0.03} color={r % 2 ? B : A} from={{ x: -30, y: 0 }} />)}
            </motion.div>
          ))}
        </div>
        <Caption delay={end + a * 0.08}>{a} rows of {b} = {a * b}</Caption>
      </div>
    );
  }
  // division: deal a dots into b circles
  const ans = Math.floor(a / b), step = Math.min(0.15, 4 / a), end = a * step + 0.4, size = a > 60 ? 10 : 14;
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: b }, (_, g) => (
          <motion.div key={g} className="flex min-h-14 w-[70px] flex-wrap content-start justify-center gap-1 rounded-full border-4 p-2"
            style={{ borderColor: A }}
            animate={g === 0 ? { borderColor: HI, scale: [1, 1.12, 1] } : {}} transition={{ delay: end }}>
            {Array.from({ length: ans }, (_, k) => <Dot key={k} size={size} delay={(k * b + g) * step} color={g === 0 ? HI : A} from={{ x: 0, y: -50 }} />)}
          </motion.div>
        ))}
      </div>
      <Caption delay={end + 0.3}>{a} shared into {b} groups → {ans} in each</Caption>
    </div>
  );
}

function Wall({ bricks }: { bricks: number }) {
  return (
    <div className="grid w-full grid-cols-5 gap-1 rounded-xl border-4 border-dashed border-[var(--dojo-primary)]/30 p-2" style={{ direction: "ltr" }}>
      {Array.from({ length: SESSION }, (_, i) => {
        const idx = SESSION - 1 - i; // bottom row fills first
        const filled = idx < bricks;
        return (
          <div key={i} className="h-7 rounded-md bg-[var(--dojo-primary)]/10">
            {filled && (
              <motion.div className="h-full w-full rounded-md bg-[var(--dojo-danger)] shadow-md"
                initial={{ y: -120, opacity: 0, rotate: -15 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Confetti() {
  const colors = ["var(--dojo-primary)", "var(--dojo-accent)", "var(--dojo-danger)", "var(--dojo-success)"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 50 }, (_, i) => (
        <motion.div key={i} className="absolute h-3 w-2 rounded-sm"
          style={{ left: `${Math.random() * 100}%`, top: -20, background: colors[i % 4] }}
          animate={{ y: "110vh", rotate: Math.random() * 720, x: (Math.random() - 0.5) * 120 }}
          transition={{ duration: 2 + Math.random() * 1.5, delay: Math.random() * 0.5, ease: "easeIn" }} />
      ))}
    </div>
  );
}

const cheer = (s: number) => (s === 3 ? "🔥 3 in a row — nice!" : s === 5 ? "⭐ 5 in a row — amazing!" : s === 8 ? "🏆 8 in a row — dojo master!" : null);

type Phase = "ask" | "right" | "wrong" | "done";

export function TrainingScreen({ level, onHome }: { level: number; onHome: () => void }) {
  const fresh = (q: Question) => ({ q, opts: generateOptions(q.correctAnswer, q) });
  const [cur, setCur] = useState(() => fresh(generateQuestion(level)));
  const [phase, setPhase] = useState<Phase>("ask");
  const [bricks, setBricks] = useState(0);
  const [asked, setAsked] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [missed, setMissed] = useState(false);
  const [fighter, setFighter] = useState<FighterState>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const restart = () => {
    setCur(fresh(generateQuestion(level))); setPhase("ask"); setBricks(0); setAsked(0);
    setFirstTry(0); setStreak(0); setBest(0); setMissed(false); setMsg(null);
  };

  const answer = (v: number) => {
    if (phase !== "ask") return;
    if (v === cur.q.correctAnswer) {
      const s = streak + 1;
      setStreak(s); setBest((b) => Math.max(b, s)); setMsg(cheer(s));
      if (!missed) setFirstTry((n) => n + 1);
      setAsked((n) => n + 1);
      const nb = bricks + 1;
      setBricks(nb); setFighter("block"); sfx.punch();
      if (nb >= SESSION) { setTimeout(() => { sfx.victory(); setPhase("done"); }, 700); }
      setPhase("right");
    } else {
      sfx.whoosh(); setStreak(0); setMsg(null);
      if (!missed) setAsked((n) => n + 1);
      setMissed(true); setPhase("wrong");
    }
  };

  const next = (q?: Question) => {
    setCur(fresh(q ?? generateQuestion(level))); setMissed(false); setPhase("ask"); setMsg(null);
  };

  const { q } = cur;
  const accuracy = asked ? Math.round((firstTry / asked) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--dojo-bg)] px-5 py-5">
      {phase === "done" && <Confetti />}
      <div className="flex w-full max-w-sm items-center justify-between">
        <button type="button" onClick={onHome} className="text-sm font-bold text-[var(--dojo-primary)]">← Home</button>
        <h2 className="text-2xl font-black text-[var(--dojo-primary)]">🏯 Build the Dojo</h2>
        <span className="text-sm font-bold text-foreground/70">🔥 {streak}</span>
      </div>

      <div className="mt-3 flex w-full max-w-sm items-end gap-3">
        <motion.div className="h-24 w-16 shrink-0 text-[var(--dojo-primary)]"
          animate={phase === "right" ? { y: [0, -24, 0, -10, 0] } : { y: 0 }} transition={{ duration: 0.6 }}>
          <Fighter state={fighter} facing="right" onAnimationEnd={() => setFighter("idle")} />
        </motion.div>
        <div className="flex-1">
          <div className="mb-1 text-xs font-bold text-foreground/60">Bricks {bricks}/{SESSION}</div>
          <Wall bricks={bricks} />
        </div>
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div key={msg} className="mt-2 rounded-full bg-[var(--dojo-accent)] px-4 py-1 text-base font-black text-[var(--dojo-accent-foreground)]"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring" }}>{msg}</motion.div>
        )}
      </AnimatePresence>

      {phase === "done" ? (
        <motion.div className="mt-6 w-full max-w-sm rounded-3xl bg-white/80 p-6 text-center shadow-lg"
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
          <div className="text-4xl">🏯🎉</div>
          <div className="mt-2 text-3xl font-black text-[var(--dojo-primary)]">Dojo complete!</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-lg font-bold">
            <div className="rounded-2xl bg-[var(--dojo-secondary)] p-3">🎯 {accuracy}%<div className="text-xs font-semibold opacity-70">first-try right</div></div>
            <div className="rounded-2xl bg-[var(--dojo-secondary)] p-3">🔥 {best}<div className="text-xs font-semibold opacity-70">best streak</div></div>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <BigButton onClick={restart}>Build another 🧱</BigButton>
            <BigButton variant="secondary" onClick={onHome}>← Back to home</BigButton>
          </div>
        </motion.div>
      ) : (
        <div className="mt-4 w-full max-w-sm rounded-3xl bg-white/70 p-5 shadow-inner">
          <div className="text-center text-5xl font-black text-[var(--dojo-primary)]">{q.a} {q.operator} {q.b} = ?</div>

          {phase === "ask" && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              {cur.opts.map((o) => <BigButton key={o} variant="answer" onClick={() => answer(o)}>{o}</BigButton>)}
            </div>
          )}

          {phase === "right" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
              <div className="text-2xl font-black text-[var(--dojo-success)]">✅ Yes! {q.correctAnswer}</div>
              <div className="mt-2 text-base font-semibold text-foreground/80">💡 {tipFor(q)}</div>
              {bricks < SESSION && <div className="mt-4"><BigButton onClick={() => next()}>Next brick →</BigButton></div>}
            </motion.div>
          )}

          {phase === "wrong" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <div className="mb-3 text-center text-xl font-black text-[var(--dojo-primary)]">Almost! Watch how it works:</div>
              <div className="flex justify-center"><VisualExplainer key={`${q.a}${q.operator}${q.b}`} a={q.a} op={q.operator} b={q.b} /></div>
              <div className="mt-3 text-center text-2xl font-black">{q.a} {q.operator} {q.b} = <span className="text-[var(--dojo-success)]">{q.correctAnswer}</span></div>
              <div className="mt-4 flex flex-col gap-3">
                <BigButton onClick={() => next()}>Got it — next</BigButton>
                <BigButton variant="secondary" small onClick={() => next(similar(q))}>Try a similar one</BigButton>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
