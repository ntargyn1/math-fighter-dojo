/**
 * Boss campaign for single player, aligned with 2nd grade Common Core
 * (Illinois / Wesclin): the four key areas are fluent +/- within 20,
 * place value & counting, measurement (time, money), and fractions.
 *
 * Five bosses of increasing difficulty. Correct answer = you hit the boss,
 * wrong answer (or timeout) = the boss hits you. Timer starts at boss 3.
 * Progress (highest unlocked boss) persists in localStorage.
 */
import type { Question, Operator } from "./MathFightingDojo";

export type BossId = "slime" | "zombie" | "golem" | "witch" | "dragon";

export interface BossDef {
  id: BossId;
  name: string;
  emoji: string;
  tagline: string;
  /** Boss HP. Player fights with the standard 500 HP. */
  hp: number;
  /** Seconds per question; null = no timer. */
  timerSec: number | null;
  gen: () => Question;
}

// ---------- helpers ----------

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Classic "a op b = ?" question (displayed from a/b/operator). */
function std(a: number, b: number, operator: Operator, correctAnswer: number): Question {
  return { a, b, operator, correctAnswer, level: 0 };
}

/** Free-text prompt question (displayed from `prompt`). */
function txt(prompt: string, correctAnswer: number): Question {
  return { a: 0, b: 0, operator: "+", correctAnswer, level: 0, prompt };
}

/** English plural: 1 apple, 3 apples. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// ---------- Boss 1: Slime — fluent +/- within 20, no timer ----------

function genSlime(): Question {
  const r = Math.random();
  if (r < 0.4) {
    const a = ri(2, 18);
    const b = ri(2, 20 - a);
    return std(a, b, "+", a + b);
  }
  if (r < 0.75) {
    const a = ri(5, 20);
    const b = ri(1, a);
    return std(a, b, "-", a - b);
  }
  // missing addend: 4 + ? = 10
  const a = ri(2, 12);
  const c = ri(a + 2, 20);
  return txt(`${a} + ? = ${c}`, c - a);
}

// ---------- Boss 2: Zombie — counting within 100, no timer ----------

function genZombie(): Question {
  const r = Math.random();
  if (r < 0.22) {
    // tens + tens, sum <= 100
    const a = ri(1, 8) * 10;
    const b = ri(1, 10 - a / 10) * 10;
    return std(a, b, "+", a + b);
  }
  if (r < 0.44) {
    // two-digit + tens, sum <= 99
    const a = ri(11, 80);
    const b = ri(1, Math.floor((99 - a) / 10)) * 10;
    return std(a, b, "+", a + b);
  }
  if (r < 0.64) {
    // two-digit + one-digit crossing tens: 28 + 5
    const tens = ri(1, 8);
    const ones = ri(1, 9);
    const a = tens * 10 + ones;
    const b = ri(10 - ones, 9);
    return std(a, b, "+", a + b);
  }
  if (r < 0.82) {
    // two-digit - tens
    const a = ri(21, 99);
    const b = ri(1, Math.floor((a - 1) / 10)) * 10;
    return std(a, b, "-", a - b);
  }
  // two-digit - one-digit, no borrowing: 47 - 6
  const tens = ri(2, 9);
  const ones = ri(2, 9);
  const a = tens * 10 + ones;
  const b = ri(1, ones);
  return std(a, b, "-", a - b);
}

// ---------- Boss 3: Golem — place value, timer 20s ----------

function genGolem(): Question {
  const r = Math.random();
  if (r < 0.3) {
    // how many tens in N?
    const k = ri(12, 95);
    const n = k * 10 + ri(0, 9);
    return txt(`How many tens are in ${n}?`, k);
  }
  if (r < 0.55) {
    // how many hundreds in N?
    const k = ri(3, 25);
    const n = k * 100 + ri(0, 99);
    return txt(`How many hundreds are in ${n}?`, k);
  }
  if (r < 0.8) {
    // count by 5s
    const s = ri(1, 6) * 5;
    return txt(`${s}, ${s + 5}, ${s + 10}, ?`, s + 15);
  }
  // count by 10s, sometimes reaching 1000
  const s = pick([10, 20, 30, 40, 50, 60, 70, 80, 90, 960, 970, 980] as const);
  return txt(`${s}, ${s + 10}, ?`, s + 20);
}

// ---------- Boss 4: Witch — 1-2 step word problems within 100, timer 30s ----------

function genWitch(): Question {
  const isAlan = Math.random() < 0.5;
  const kid = isAlan ? "Alan" : "Bayan";
  const heShe = isAlan ? "He" : "She";
  const r = Math.random();
  if (r < 0.3) {
    const a = ri(15, 60);
    const b = ri(5, a - 3);
    return txt(`${kid} had ${a} ${plural(a, "apple", "apples")}. ${heShe} ate ${b}. How many are left?`, a - b);
  }
  if (r < 0.55) {
    const a = ri(12, 50);
    const b = ri(8, 40);
    return txt(`Alan picked ${a} ${plural(a, "mushroom", "mushrooms")} and Bayan picked ${b} ${plural(b, "mushroom", "mushrooms")}. How many in all?`, a + b);
  }
  if (r < 0.8) {
    const a = ri(20, 60);
    const b = ri(5, 25);
    const c = ri(3, 15);
    const total = a + b - c;
    if (total < 0 || total > 100) return genWitch();
    return txt(`There ${a === 1 ? "was" : "were"} ${a} ${plural(a, "ball", "balls")} in the basket. They brought ${b} more, then took ${c} away. How many are there now?`, total);
  }
  const a = ri(15, 70);
  const b = ri(6, 30);
  return txt(`${kid} had ${a} ${plural(a, "sticker", "stickers")}. ${heShe} was given ${b} more. How many ${heShe === "He" ? "does he have" : "does she have"} now?`, a + b);
}

// ---------- Boss 5: Dragon — everything mixed + time & money, timer 20s ----------

const SUB_GENS = [genSlime, genZombie, genGolem, genWitch];

function genTime(): Question {
  const r = Math.random();
  if (r < 0.4) {
    const h = ri(2, 5);
    return txt(`How many minutes are in ${h} ${plural(h, "hour", "hours")}?`, h * 60);
  }
  if (r < 0.75) {
    const h = ri(1, 3);
    const m = pick([15, 30, 45] as const);
    return txt(`${h} ${plural(h, "hour", "hours")} ${m} minutes — how many minutes is that?`, h * 60 + m);
  }
  return txt(`How many minutes are in an hour and a half?`, 90);
}

function genMoney(): Question {
  const r = Math.random();
  if (r < 0.35) {
    const n = ri(2, 4);
    return txt(`How many cents are in ${n} ${plural(n, "quarter", "quarters")}?`, n * 25);
  }
  if (r < 0.65) {
    const n = ri(2, 9);
    return txt(`How many cents are in ${n} ${plural(n, "dime", "dimes")}?`, n * 10);
  }
  const a = ri(2, 6);
  const b = ri(1, 9);
  return txt(`${a} ${plural(a, "nickel", "nickels")} and ${b} ${plural(b, "penny", "pennies")} — how many cents is that?`, a * 5 + b);
}

function genDragon(): Question {
  const r = Math.random();
  if (r < 0.4) return pick(SUB_GENS)();
  if (r < 0.7) return genTime();
  return genMoney();
}

// ---------- boss roster ----------

export const BOSSES: BossDef[] = [
  { id: "slime", name: "Slime", emoji: "🟢", tagline: "Quick math to 20", hp: 300, timerSec: null, gen: genSlime },
  { id: "zombie", name: "Zombie", emoji: "🧟", tagline: "Counting to 100", hp: 450, timerSec: null, gen: genZombie },
  { id: "golem", name: "Golem", emoji: "🗿", tagline: "Place value: tens and hundreds", hp: 600, timerSec: 20, gen: genGolem },
  { id: "witch", name: "Witch", emoji: "🧙", tagline: "1–2 step word problems", hp: 750, timerSec: 30, gen: genWitch },
  { id: "dragon", name: "Dragon", emoji: "🐉", tagline: "Final: everything + time & money", hp: 1000, timerSec: 20, gen: genDragon },
];

export function getBoss(id: BossId): BossDef {
  return BOSSES.find((b) => b.id === id) ?? BOSSES[0];
}

// ---------- progress: highest unlocked boss index (0-based) ----------

const CAMPAIGN_KEY = "mfd-campaign";

export function loadUnlocked(): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.localStorage.getItem(CAMPAIGN_KEY) ?? 0) || 0;
  return Math.max(0, Math.min(BOSSES.length - 1, n));
}

export function saveUnlocked(i: number): void {
  window.localStorage.setItem(CAMPAIGN_KEY, String(Math.max(0, Math.min(BOSSES.length - 1, i))));
}

/** Call when boss i is defeated; returns the new unlocked index. */
export function defeatBoss(i: number): number {
  const next = Math.min(BOSSES.length - 1, Math.max(loadUnlocked(), i + 1));
  saveUnlocked(next);
  return next;
}
