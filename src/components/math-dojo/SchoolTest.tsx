import { useState } from "react";
import { BigButton } from "./MathFightingDojo";
import { WritingPad } from "./WritingPad";

/**
 * School Test — practice problems in the same format as the Grade 2 Unit 2
 * Mid-Unit Assessment: same nine problem types, same paper look (numbered
 * problems, "Show your work.", "Solution ___"), new numbers every test.
 * The handwriting pad is scratch work, like the margin of a test — the app
 * grades the checkable part (the answer / the Yes-No choices) and shows the
 * model explanation so the child can compare it with what they wrote.
 */

// ---------- helpers ----------

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const tens = (n: number) => Math.floor(n / 10) * 10;
const tensDigit = (n: number) => Math.floor(n / 10);
const ones = (n: number) => n % 10;

const KIDS = ["Alan", "Bayan", "Mia", "Noah", "Leo", "Emma", "Sam", "Ava"] as const;
const kid = () => pick(KIDS);

// ---------- problem model ----------

type DecomposeOption = { text: string; correct: boolean };
type YesNoRow = { text: string; canUse: boolean };

type SchoolProblem =
  | { kind: "decompose"; a: number; b: number; itemA: string; itemB: string; options: DecomposeOption[] }
  | { kind: "sum-work"; a: number; b: number }
  | { kind: "tyler"; name: string; a: number; b: number; wrong: number }
  | { kind: "yesno"; name1: string; name2: string; item: string; a: number; b: number; rows: YesNoRow[] }
  | { kind: "numberline"; name: string; start: number; end: number; jumps: number[]; claimed: number }
  | { kind: "word-sub"; name: string; item: string; a: number; b: number }
  | { kind: "missing"; start: number; end: number; item: string }
  | { kind: "word-mc"; a: number; b: number; options: number[] }
  | { kind: "strategy"; a: number; b: number };

type AnswerState =
  | { kind: "decompose"; selected: number[] }
  | { kind: "number"; value: string }
  | { kind: "yesno"; answer: boolean | null }
  | { kind: "table"; answers: (boolean | null)[] };

function defaultAnswer(p: SchoolProblem): AnswerState {
  switch (p.kind) {
    case "decompose":
      return { kind: "decompose", selected: [] };
    case "tyler":
      return { kind: "yesno", answer: null };
    case "yesno":
      return { kind: "table", answers: p.rows.map(() => null) };
    default:
      return { kind: "number", value: "" };
  }
}

// ---------- generators (same ranges as the school test) ----------

function twoDigitRegroupSum(): { a: number; b: number } {
  for (;;) {
    const a = ri(12, 68);
    const b = ri(12, 99 - a);
    if (ones(a) + ones(b) > 9 && ones(a) >= 2 && ones(b) >= 2) return { a, b };
  }
}

function genDecompose(): SchoolProblem {
  const { a, b } = twoDigitRegroupSum();
  const need = 10 - ones(a); // to make a a round ten
  const correct: string[] = [
    `${tens(a)} + ${tens(b)} + ${ones(a)} + ${ones(b)}`,
    `${tens(a) + tens(b)} + ${ones(a)} + ${ones(b)}`,
    `${a + need} + ${b - need}`,
  ];
  const traps: string[] = [
    `${tens(a)} + ${tens(b)} + 1 + 1`,
    `${tens(a) + tens(b)} + 1`,
    `${tens(a)} + ${ones(a)} + ${ones(b)}`,
  ];
  const options = shuffle([
    ...correct.map((text) => ({ text, correct: true })),
    ...traps.map((text) => ({ text, correct: false })),
  ]);
  return { kind: "decompose", a, b, itemA: pick(["T-shirts", "Red pens", "Blue cups"] as const), itemB: pick(["Sweatshirts", "Black pens", "Red cups"] as const), options };
}

function genSumWork(): SchoolProblem {
  const { a, b } = twoDigitRegroupSum();
  return { kind: "sum-work", a, b };
}

function genTyler(): SchoolProblem {
  for (;;) {
    const a = ri(42, 95);
    const b = ri(16, a - 5);
    if (ones(a) >= ones(b) || ones(a) === 0) continue;
    const wrong = (tensDigit(a) - tensDigit(b)) * 10 + (ones(b) - ones(a));
    const right = a - b;
    if (wrong > 0 && wrong !== right) return { kind: "tyler", name: kid(), a, b, wrong };
  }
}

function genYesNo(): SchoolProblem {
  const a = ri(34, 92);
  const b = ri(11, 29);
  const rows = shuffle([
    { text: `${a} − ${b} = ?`, canUse: true },
    { text: `${b} + ? = ${a}`, canUse: true },
    { text: `${a} + ${b} = ?`, canUse: false },
    { text: `${a} − ? = ${b}`, canUse: true },
  ]);
  const n1 = kid();
  let n2 = kid();
  while (n2 === n1) n2 = kid();
  return { kind: "yesno", name1: n1, name2: n2, item: pick(["coins", "stickers", "marbles", "shells"] as const), a, b, rows };
}

function genNumberline(): SchoolProblem {
  const start = ri(21, 38);
  const j1 = 10 - ones(start);
  const j2 = 10;
  const j3 = ri(2, 8);
  const end = start + j1 + j2 + j3;
  return { kind: "numberline", name: pick(["Eliza", "Mia", "Emma"] as const), start, end, jumps: [j1, j2, j3], claimed: j2 + j3 };
}

function genWordSub(): SchoolProblem {
  for (;;) {
    const a = ri(42, 92);
    const b = ri(15, 35);
    if (ones(a) < ones(b) && a - b > 0) {
      return { kind: "word-sub", name: kid(), item: pick(["beads", "stickers", "crayons", "buttons"] as const), a, b };
    }
  }
}

function genMissing(): SchoolProblem {
  const start = ri(38, 74);
  const end = start + ri(11, 29);
  return { kind: "missing", start, end, item: pick(["flowers", "apples", "books", "balloons"] as const) };
}

function genWordMc(): SchoolProblem {
  const a = ri(24, 46);
  const b = ri(18, 36);
  const sum = a + b;
  const options = shuffle([sum, sum - 10, sum + 10, Math.abs(a - b)].filter((v, i, arr) => v >= 0 && arr.indexOf(v) === i));
  while (options.length < 4) options.push(sum + 20 + options.length);
  return { kind: "word-mc", a, b, options: shuffle(options) };
}

function genStrategy(): SchoolProblem {
  const { a, b } = twoDigitRegroupSum();
  return { kind: "strategy", a, b };
}

function genTest(): SchoolProblem[] {
  return [genDecompose(), genSumWork(), genTyler(), genYesNo(), genNumberline(), genWordSub(), genMissing(), genWordMc(), genStrategy()];
}

// ---------- grading ----------

function grade(p: SchoolProblem, ans: AnswerState): { correct: boolean; feedback: string } {
  switch (p.kind) {
    case "decompose": {
      if (ans.kind !== "decompose") return { correct: false, feedback: "" };
      const correctIdx = p.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
      const ok = ans.selected.length === correctIdx.length && correctIdx.every((i) => ans.selected.includes(i));
      const sum = p.a + p.b;
      const list = p.options.filter((o) => o.correct).map((o) => o.text).join("  •  ");
      return ok
        ? { correct: true, feedback: `Correct! ${p.a} + ${p.b} = ${sum}. The ways that work: ${list}.` }
        : { correct: false, feedback: `${p.a} + ${p.b} = ${sum}. Add up each choice — only the ones that make ${sum} count: ${list}.` };
    }
    case "sum-work": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const ok = Number(ans.value) === p.a + p.b;
      return ok
        ? { correct: true, feedback: `Correct! ${p.a} + ${p.b} = ${p.a + p.b}.` }
        : { correct: false, feedback: `${p.a} + ${p.b} = ${p.a + p.b}. Add the ones first (${ones(p.a)} + ${ones(p.b)} = ${ones(p.a) + ones(p.b)}), then the tens.` };
    }
    case "tyler": {
      if (ans.kind !== "yesno") return { correct: false, feedback: "" };
      const right = p.a - p.b;
      const check = p.b + p.wrong;
      return ans.answer === false
        ? { correct: true, feedback: `Right — ${p.name} is wrong. Check with addition: ${p.b} + ${p.wrong} = ${check}, but it should be ${p.a}. The right answer is ${p.a} − ${p.b} = ${right}.` }
        : { correct: false, feedback: `${p.name} is wrong. Check with addition: ${p.b} + ${p.wrong} = ${check}, but it should be ${p.a}. The right answer is ${p.a} − ${p.b} = ${right}.` };
    }
    case "yesno": {
      if (ans.kind !== "table") return { correct: false, feedback: "" };
      const ok = p.rows.every((r, i) => ans.answers[i] === r.canUse);
      const usable = p.rows.filter((r) => r.canUse).map((r) => r.text).join("  •  ");
      return ok
        ? { correct: true, feedback: `All correct! These find ${p.name2}'s ${p.item}: ${usable}.` }
        : { correct: false, feedback: `Not quite. These find ${p.name2}'s ${p.item}: ${usable}. ${p.a} + ${p.b} does not — ${p.name2} has fewer, not more.` };
    }
    case "numberline": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const total = p.jumps.reduce((s, j) => s + j, 0);
      const ok = Number(ans.value) === total;
      const jumps = p.jumps.join(" + ");
      return ok
        ? { correct: true, feedback: `Correct! ${p.name} forgot the first jump (${p.jumps[0]}). ${jumps} = ${total}, so ${p.end} − ${p.start} = ${total}.` }
        : { correct: false, feedback: `${p.name} forgot the first jump (${p.jumps[0]}). Add all the jumps: ${jumps} = ${total}, so ${p.end} − ${p.start} = ${total}.` };
    }
    case "word-sub": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const ok = Number(ans.value) === p.a - p.b;
      return ok
        ? { correct: true, feedback: `Correct! ${p.a} − ${p.b} = ${p.a - p.b} ${p.item} left.` }
        : { correct: false, feedback: `${p.a} − ${p.b} = ${p.a - p.b}. ${p.name} used ${p.b}, so take them away from ${p.a}.` };
    }
    case "missing": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const ok = Number(ans.value) === p.end - p.start;
      return ok
        ? { correct: true, feedback: `Correct! ${p.start} + ? = ${p.end}, so ? = ${p.end} − ${p.start} = ${p.end - p.start}.` }
        : { correct: false, feedback: `This is a "how many more" problem: ${p.start} + ? = ${p.end}. So ? = ${p.end} − ${p.start} = ${p.end - p.start} — do not add the two numbers.` };
    }
    case "word-mc": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const ok = Number(ans.value) === p.a + p.b;
      return ok
        ? { correct: true, feedback: `Correct! ${p.a} + ${p.b} = ${p.a + p.b} pages in all.` }
        : { correct: false, feedback: `"In all" means add: ${p.a} + ${p.b} = ${p.a + p.b} pages.` };
    }
    case "strategy": {
      if (ans.kind !== "number") return { correct: false, feedback: "" };
      const ok = Number(ans.value) === p.a + p.b;
      const model = `One way: break into tens and ones — ${p.a} = ${tens(p.a)} + ${ones(p.a)}, ${p.b} = ${tens(p.b)} + ${ones(p.b)}. Tens: ${tens(p.a)} + ${tens(p.b)} = ${tens(p.a) + tens(p.b)}. Ones: ${ones(p.a)} + ${ones(p.b)} = ${ones(p.a) + ones(p.b)}. Then ${tens(p.a) + tens(p.b)} + ${ones(p.a) + ones(p.b)} = ${p.a + p.b}.`;
      return ok
        ? { correct: true, feedback: `Correct answer: ${p.a + p.b}. ${model}` }
        : { correct: false, feedback: `${p.a} + ${p.b} = ${p.a + p.b}. ${model}` };
    }
  }
}

// ---------- small pieces ----------

/** Numbered badge like on the school paper. */
function NumBadge({ n }: { n: number }) {
  return (
    <span className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground/60 text-base font-black text-white">
      {n}
    </span>
  );
}

/** The "Solution ___" answer line from the paper. */
function AnswerLine({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="mt-2 flex items-end gap-2">
      <span className="text-lg font-black text-foreground">{label ?? "Solution"}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="?"
        aria-label="Answer"
        className="w-24 border-b-2 border-foreground/50 bg-transparent pb-0 text-center text-3xl font-black text-[var(--dojo-primary)] outline-none placeholder:text-foreground/30 focus:border-[var(--dojo-primary)]"
      />
    </div>
  );
}

/** Number line with jump arcs, like Eliza's model on the test. */
function NumberLine({ start, jumps }: { start: number; jumps: number[] }) {
  const points = [start];
  jumps.forEach((j) => points.push(points[points.length - 1] + j));
  const end = points[points.length - 1];
  const W = 340;
  const H = 96;
  const pad = 24;
  const x = (v: number) => pad + ((v - start) / (end - start)) * (W - pad * 2);
  const y = 66;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full max-w-md">
      <line x1={8} y1={y} x2={W - 8} y2={y} stroke="#334155" strokeWidth={2} markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="#334155" strokeWidth={1.5} />
        </marker>
      </defs>
      {points.map((p, i) => (
        <g key={i}>
          <line x1={x(p)} y1={y - 6} x2={x(p)} y2={y + 6} stroke="#334155" strokeWidth={2} />
          <text x={x(p)} y={y + 22} textAnchor="middle" fontSize={14} fontWeight={700} fill="#334155">
            {p}
          </text>
        </g>
      ))}
      {jumps.map((j, i) => {
        const x1 = x(points[i]);
        const x2 = x(points[i + 1]);
        const mx = (x1 + x2) / 2;
        return (
          <g key={i}>
            <path d={`M ${x1} ${y - 4} Q ${mx} ${y - 44} ${x2} ${y - 4}`} fill="none" stroke="#334155" strokeWidth={1.5} markerEnd="url(#arrow)" />
            <text x={mx} y={y - 34} textAnchor="middle" fontSize={14} fontWeight={700} fill="#334155">
              {j}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- problem view ----------

function ProblemView({
  problem,
  index,
  answer,
  onAnswer,
}: {
  problem: SchoolProblem;
  index: number;
  answer: AnswerState;
  onAnswer: (a: AnswerState) => void;
}) {
  const n = index + 1;
  const num = (v: string) => onAnswer({ kind: "number", value: v });
  const numVal = answer.kind === "number" ? answer.value : "";

  switch (problem.kind) {
    case "decompose": {
      const sel = answer.kind === "decompose" ? answer.selected : [];
      const toggle = (i: number) =>
        onAnswer({ kind: "decompose", selected: sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i] });
      const letters = ["A", "B", "C", "D", "E", "F"];
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            The table shows the number of shirts in a store.
          </p>
          <table className="my-3 w-56 border-2 border-foreground/40 text-center text-lg">
            <tbody>
              <tr className="border-b-2 border-foreground/40">
                <td className="border-r-2 border-foreground/40 px-3 py-1 text-left font-bold">{problem.itemA}</td>
                <td className="px-3 py-1">{problem.a}</td>
              </tr>
              <tr>
                <td className="border-r-2 border-foreground/40 px-3 py-1 text-left font-bold">{problem.itemB}</td>
                <td className="px-3 py-1">{problem.b}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-lg leading-snug text-foreground">
            The manager wants to know the total number of shirts. Which addition problems show a way to find {problem.a} + {problem.b}?
            Choose all the correct answers.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {problem.options.map((o, i) => {
              const on = sel.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-left text-xl font-bold transition-transform active:scale-95 ${
                    on ? "border-[var(--dojo-primary)] bg-[var(--dojo-primary)]/10" : "border-foreground/20 bg-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-base font-black ${
                      on ? "border-[var(--dojo-primary)] bg-[var(--dojo-primary)] text-white" : "border-foreground/40 text-foreground"
                    }`}
                  >
                    {letters[i]}
                  </span>
                  <span className="text-foreground">{o.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "sum-work":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            What is the sum of {problem.a} and {problem.b}? Show your work.
          </p>
          <p className="mt-2 text-3xl font-black text-[var(--dojo-primary)]">
            {problem.a} + {problem.b} = ___
          </p>
          <div className="mt-3">
            <WritingPad label="Show your work." />
          </div>
          <AnswerLine value={numVal} onChange={num} />
        </div>
      );
    case "tyler":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            {problem.name} solved this subtraction problem.
          </p>
          <p className="mt-2 text-center text-2xl font-black leading-snug text-foreground">
            {problem.a}
            <br />− {problem.b}
            <br />
            <span className="inline-block w-24 border-t-2 border-foreground/60" />
            <br />
            {problem.wrong}
          </p>
          <p className="mt-2 text-lg leading-snug text-foreground">
            Is {problem.name}&rsquo;s answer correct? Explain how you can use addition to check the answer.
          </p>
          <div className="mt-3 flex gap-2">
            {(["Yes", "No"] as const).map((label) => {
              const val = label === "Yes";
              const on = answer.kind === "yesno" && answer.answer === val;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onAnswer({ kind: "yesno", answer: val })}
                  className={`flex-1 rounded-2xl border-2 px-4 py-3 text-xl font-black transition-transform active:scale-95 ${
                    on ? "border-[var(--dojo-primary)] bg-[var(--dojo-primary)] text-white" : "border-foreground/20 bg-white text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <WritingPad label="Explain — write how to check with addition." />
          </div>
        </div>
      );
    case "yesno": {
      const vals = answer.kind === "table" ? answer.answers : [null, null, null, null];
      const set = (i: number, v: boolean) => {
        const next = [...vals];
        next[i] = v;
        onAnswer({ kind: "table", answers: next });
      };
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            {problem.name1} has {problem.a} {problem.item}. {problem.name2} has {problem.b} fewer {problem.item} than {problem.name1}. How many{" "}
            {problem.item} does {problem.name2} have?
          </p>
          <p className="mt-2 text-lg leading-snug text-foreground">
            Decide if each equation can be used to find the number of {problem.item} {problem.name2} has. Choose Yes or No for each equation.
          </p>
          <table className="mt-3 w-full border-2 border-foreground/40 text-center">
            <thead>
              <tr className="border-b-2 border-foreground/40 bg-foreground/5">
                <th className="px-2 py-2 text-left text-base">Equation</th>
                <th className="px-2 py-2 text-base">Yes</th>
                <th className="px-2 py-2 text-base">No</th>
              </tr>
            </thead>
            <tbody>
              {problem.rows.map((r, i) => (
                <tr key={i} className="border-b border-foreground/20">
                  <td className="px-2 py-2 text-left text-lg font-bold text-foreground">{r.text}</td>
                  {([true, false] as const).map((v) => (
                    <td key={String(v)} className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => set(i, v)}
                        className={`h-9 w-9 rounded-full border-2 text-base font-black transition-transform active:scale-95 ${
                          vals[i] === v ? "border-[var(--dojo-primary)] bg-[var(--dojo-primary)] text-white" : "border-foreground/40 bg-white text-foreground"
                        }`}
                      >
                        {v ? "✓" : "✕"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "numberline":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            {problem.name} drew this model to solve a subtraction problem. {problem.name} said she solved {problem.end} − {problem.start} ={" "}
            {problem.claimed}. Her teacher says her answer is not correct.
          </p>
          <NumberLine start={problem.start} jumps={problem.jumps} />
          <p className="mt-2 text-lg leading-snug text-foreground">Explain {problem.name}&rsquo;s error and how she can fix it.</p>
          <div className="mt-3">
            <WritingPad label="Explain — what did she forget?" />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-lg font-black text-foreground">The right answer is</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numVal}
              onChange={(e) => num(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="?"
              aria-label="Correct answer"
              className="w-20 border-b-2 border-foreground/50 bg-transparent pb-0 text-center text-3xl font-black text-[var(--dojo-primary)] outline-none placeholder:text-foreground/30 focus:border-[var(--dojo-primary)]"
            />
          </div>
        </div>
      );
    case "word-sub":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            {problem.name} has {problem.a} {problem.item}. {problem.name} uses {problem.b} of them to make a bracelet. How many {problem.item}{" "}
            does {problem.name} have now? Find {problem.a} − {problem.b}. Show your work.
          </p>
          <div className="mt-3">
            <WritingPad label="Show your work." />
          </div>
          <AnswerLine value={numVal} onChange={num} />
        </div>
      );
    case "missing":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />A garden has {problem.start} {problem.item}. Then more {problem.item} are planted. Now there are {problem.end}{" "}
            {problem.item} in the garden. How many more {problem.item} were planted? Show your work.
          </p>
          <div className="mt-3">
            <WritingPad label="Show your work." />
          </div>
          <AnswerLine value={numVal} onChange={num} />
        </div>
      );
    case "word-mc": {
      const letters = ["A", "B", "C", "D"];
      const chosen = numVal === "" ? null : Number(numVal);
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            Mike reads {problem.a} pages of a book on Monday and {problem.b} pages on Tuesday. How many pages does Mike read in all?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {problem.options.map((v, i) => {
              const on = chosen === v;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => num(String(v))}
                  className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left text-xl font-black transition-transform active:scale-95 ${
                    on ? "border-[var(--dojo-primary)] bg-[var(--dojo-primary)] text-white" : "border-foreground/20 bg-white text-foreground"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current text-sm">{letters[i]}</span>
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "strategy":
      return (
        <div>
          <p className="text-lg leading-snug text-foreground">
            <NumBadge n={n} />
            What strategy would you use to solve {problem.a} + {problem.b}? Explain and then solve.
          </p>
          <div className="mt-3">
            <WritingPad label="Explain your strategy." height={150} />
          </div>
          <AnswerLine value={numVal} onChange={num} />
        </div>
      );
  }
}

// ---------- screen ----------

export function SchoolTestScreen({ onHome }: { onHome: () => void }) {
  const [problems, setProblems] = useState<SchoolProblem[]>(() => genTest());
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState(false);

  const problem = problems[idx];
  const answer = answers[idx] ?? defaultAnswer(problem);
  const setAnswer = (a: AnswerState) => setAnswers((m) => ({ ...m, [idx]: a }));

  const check = () => {
    const g = grade(problem, answer);
    setResults((m) => ({ ...m, [idx]: g.correct }));
    setChecked((m) => ({ ...m, [idx]: true }));
  };

  const newTest = () => {
    setProblems(genTest());
    setIdx(0);
    setAnswers({});
    setChecked({});
    setResults({});
    setDone(false);
  };

  const score = Object.values(results).filter(Boolean).length;

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-4 bg-[var(--dojo-bg)] px-4 py-8">
        <div className="text-5xl">📝</div>
        <h2 className="text-center text-3xl font-black text-[var(--dojo-primary)]">
          You got {score} out of {problems.length}!
        </h2>
        <p className="text-center text-base text-foreground/70">
          {score === problems.length ? "Perfect — just like the real test!" : score >= 7 ? "Great work! Look at the ones you missed." : "Good practice! Try again with new numbers."}
        </p>
        <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow">
          {problems.map((p, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-foreground/10 py-2 last:border-0">
              <span className="text-xl">{results[i] ? "✅" : "❌"}</span>
              <span className="text-base font-bold text-foreground">
                Problem {i + 1} — {p.kind === "decompose" ? "Ways to add" : p.kind === "sum-work" ? "Sum" : p.kind === "tyler" ? "Check Tyler" : p.kind === "yesno" ? "Yes or No" : p.kind === "numberline" ? "Number line" : p.kind === "word-sub" ? "Word problem" : p.kind === "missing" ? "How many more" : p.kind === "word-mc" ? "Pages" : "Strategy"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <BigButton variant="primary" onClick={newTest}>
            🔄 New test
          </BigButton>
          <BigButton variant="secondary" onClick={onHome}>
            ← Back to home
          </BigButton>
        </div>
      </div>
    );
  }

  const g = checked[idx] ? grade(problem, answer) : null;

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-[var(--dojo-bg)] px-3 py-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[var(--dojo-primary)]">Unit 2 Practice Test</h2>
          <p className="text-sm font-bold text-foreground/60">Solve the problems. • Form: Practice</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-foreground shadow">
          {idx + 1} / {problems.length}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
        <div className="h-full bg-[var(--dojo-primary)] transition-all" style={{ width: `${((idx + 1) / problems.length) * 100}%` }} />
      </div>

      {/* The paper page */}
      <div className="w-full rounded-3xl bg-white p-4 shadow-lg">
        <ProblemView problem={problem} index={idx} answer={answer} onAnswer={setAnswer} />
        {g && (
          <div
            className={`mt-4 rounded-2xl border-2 p-3 text-base font-bold leading-snug ${
              g.correct ? "border-green-500 bg-green-50 text-green-800" : "border-amber-500 bg-amber-50 text-amber-900"
            }`}
          >
            {g.correct ? "✅ " : "💡 "}
            {g.feedback}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => idx > 0 && setIdx(idx - 1)}
          disabled={idx === 0}
          className="rounded-2xl bg-white/70 px-4 py-3 text-lg font-black text-foreground/70 shadow disabled:opacity-40"
        >
          ← Back
        </button>
        {!checked[idx] ? (
          <div className="flex-1">
            <BigButton variant="primary" small onClick={check}>
              ✓ Check answer
            </BigButton>
          </div>
        ) : idx < problems.length - 1 ? (
          <div className="flex-1">
            <BigButton variant="primary" small onClick={() => setIdx(idx + 1)}>
              Next problem →
            </BigButton>
          </div>
        ) : (
          <div className="flex-1">
            <BigButton variant="primary" small onClick={() => setDone(true)}>
              🏁 See my score
            </BigButton>
          </div>
        )}
      </div>
      <button type="button" onClick={onHome} className="text-sm font-bold text-foreground/60 underline">
        Back to home
      </button>
    </div>
  );
}
