// WebAudio-only synthesized sound effects. No audio files.
const MUTE_KEY = "mfd-muted";
let ctx: AudioContext | null = null;
let muted = false;
let loaded = false;

function loadMute() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  muted = window.localStorage.getItem(MUTE_KEY) === "1";
}

export function isMuted() {
  loadMute();
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  loaded = true;
  if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, v ? "1" : "0");
}

function ac(): AudioContext | null {
  loadMute();
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  endFreq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  vol: number,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(c: AudioContext, start: number, dur: number, f0: number, f1: number, vol: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, start);
  f.frequency.exponentialRampToValueAtTime(f1, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(vol, start + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(start);
  src.stop(start + dur);
}

export const sfx = {
  punch(heavy = false) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    tone(c, heavy ? 110 : 180, heavy ? 30 : 50, t, heavy ? 0.35 : 0.18, "sine", heavy ? 0.9 : 0.6);
    noise(c, t, 0.08, 1500, 300, heavy ? 0.5 : 0.3);
  },
  whoosh() {
    const c = ac();
    if (!c) return;
    noise(c, c.currentTime, 0.3, 400, 2500, 0.35);
  },
  click() {
    const c = ac();
    if (!c) return;
    tone(c, 900, 700, c.currentTime, 0.04, "square", 0.08);
  },
  victory() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, f, f, t + i * 0.13, i === 3 ? 0.45 : 0.14, "triangle", 0.3),
    );
  },
  defeat() {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    [392, 330, 262].forEach((f, i) => tone(c, f, f * 0.95, t + i * 0.22, 0.25, "triangle", 0.25));
  },
};
