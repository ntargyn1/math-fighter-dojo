const WINS_KEY = "mfd-wins";

export const BELTS = [
  { name: "White", min: 0, color: "#f8fafc", text: "#334155" },
  { name: "Yellow", min: 3, color: "#facc15", text: "#422006" },
  { name: "Orange", min: 6, color: "#fb923c", text: "#431407" },
  { name: "Green", min: 10, color: "#22c55e", text: "#052e16" },
  { name: "Blue", min: 15, color: "#3b82f6", text: "#ffffff" },
  { name: "Brown", min: 20, color: "#92400e", text: "#ffffff" },
  { name: "Black", min: 30, color: "#111827", text: "#ffffff" },
] as const;

export function getBelt(wins: number) {
  let b: (typeof BELTS)[number] = BELTS[0];
  for (const belt of BELTS) if (wins >= belt.min) b = belt;
  return b;
}

export function loadWins(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(WINS_KEY) ?? 0) || 0;
}

export function saveWins(n: number) {
  window.localStorage.setItem(WINS_KEY, String(n));
}
