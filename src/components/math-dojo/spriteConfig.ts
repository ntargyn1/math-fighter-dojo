/**
 * Sprite strips: one horizontal row of frames, every frame the same size,
 * character drawn facing RIGHT with feet planted at the same spot in every frame.
 * Strips were re-aligned (feet anchored, centered) from the original uploads.
 */
export interface StripConfig {
  src: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
}

export type CharacterId = "alan" | "bayan" | "mateo" | "kash" | "luca";
export type SpriteAnim = "idle" | "intro" | "jab" | "kick" | "booger" | "block" | "hit" | "ko" | "victory";

const FRAME = { frames: 6, frameWidth: 326, frameHeight: 348 } as const;
const strip = (src: string, fps: number, loop: boolean, frames: number = FRAME.frames): StripConfig => ({ src, fps, loop, frames, frameWidth: FRAME.frameWidth, frameHeight: FRAME.frameHeight });

export interface CharacterSprites {
  idle: StripConfig;
  /** Optional walk-in intro: plays once at battle start, then idle takes over. */
  intro?: StripConfig;
  jab: StripConfig;
  kick: StripConfig;
  booger: StripConfig;
  block: StripConfig;
  /** Optional real strips. When missing, hit/ko are procedural on top of the current strip. */
  hit?: StripConfig;
  ko?: StripConfig; // drop-in slot: alan-ko.png / bayan-ko.png
  /** Optional victory celebration: plays once for the battle winner. */
  victory?: StripConfig;
}

export const CHARACTERS: Record<CharacterId, CharacterSprites> = {
  alan: {
    idle: strip("/sprites/alan-idle-v6.png", 12, true, 12),
    intro: strip("/sprites/alan-intro-v2.png", 10, false, 10),
    jab: strip("/sprites/alan-jab-v7.png", 28, false, 12),
    kick: strip("/sprites/alan-kick-v2.png", 12, false, 12),
    booger: strip("/sprites/alan-booger-v5.png", 12, false, 28),
    block: strip("/sprites/alan-block-v4.png", 20, true, 12),
    // Nov 21 2026 (FlexFox hero-animator prompts): real hit + KO strips.
    // Hit: guard -> recoil (eyes shut, pained grimace, fists up) -> guard.
    // KO: stagger, knees buckle, falls to a sitting position, holds.
    hit: strip("/sprites/alan-hit-v1.png", 28, false, 12),
    ko: strip("/sprites/alan-ko-v1.png", 12, false, 28),
    // Nov 21 2026: victory celebration — big smile, arms raised, small hop.
    victory: strip("/sprites/alan-victory-v1.png", 12, false, 12),
  },
  bayan: {
    idle: strip("/sprites/bayan-idle-v7.png", 12, true, 12),
    intro: strip("/sprites/bayan-intro-v1.png", 10, false, 14),
    jab: strip("/sprites/bayan-jab-v6.png", 28, false, 12),
    kick: strip("/sprites/bayan-jumpkick-v1.png", 12, false, 12),
    booger: strip("/sprites/bayan-cat-v2.png", 12, false, 28),
    block: strip("/sprites/bayan-block-v2.png", 20, true, 12),
    // Nov 21 2026 (FlexFox prompts): real hit + KO strips.
    // Hit: guard -> flinch -> recoil (eyes shut, pained) -> guard.
    // KO: stagger, lean back, falls FLAT on her back, lies still.
    hit: strip("/sprites/bayan-hit-v1.png", 28, false, 12),
    ko: strip("/sprites/bayan-ko-v1.png", 12, false, 28),
  },
  /** Mateo (Alan's friend, Nov 20 2026): same strikes as Alan for now —
   * jab / kick / booger (monster) / block. v8: v7 body + v5 face +
   * lighter skin. v9 (Nov 20): v8 + slightly snub nose. Alan's exact
   * body and limbs, Mateo's curly hair, v5 face, snub nose, white
   * shirt, dark blue shorts, light skin. Scaled 0.80 about the feet
   * (Alan's height). No intro strip yet (idle plays at battle start).
   * v10 (Nov 20): idle rebuilt — stable stance like Alan's (only
   * frames 1-6, no sideways lean; feet and left edge steady). v11
   * (Nov 20): idle rebuilt again — only frames 1-4, the single
   * outlier frame removed; now as steady as Alan (1px spans). */
  mateo: {
    idle: strip("/sprites/mateo-idle-v11.png", 12, true, 12),
    jab: strip("/sprites/mateo-jab-v9.png", 28, false, 12),
    kick: strip("/sprites/mateo-kick-v9.png", 12, false, 12),
    booger: strip("/sprites/mateo-booger-v9.png", 12, false, 28),
    block: strip("/sprites/mateo-block-v9.png", 20, true, 12),
    // Nov 21 2026 (FlexFox prompts): real hit strip. Guard -> impact
    // (white star at the cheek) -> recoil (eyes shut, pained) -> guard.
    // KO v2 (Nov 21): the v1 video never fell (only leaned back); v2 with
    // the stronger "topples over backwards and lands flat" wording falls
    // flat on his back and lies still. Note: his KO guard is ~195px (the
    // video drew him small and the lying body is wide), vs 255px idle.
    hit: strip("/sprites/mateo-hit-v1.png", 28, false, 12),
    ko: strip("/sprites/mateo-ko-v2.png", 12, false, 28),
  },
  /** Kash (Alan's friend, Nov 20 2026): same scheme as Mateo — Alan's
   * body with Kash's face and clothes. Short light-brown hair, dark
   * glasses, dark grey Happy Halloween Pikachu shirt, grey-blue shorts.
   * Heavy is NOT a booger: the "booger" slot holds the Roblox
   * sledgehammer strip (28f). v1: full Roblox body. v2 (Nov 20): Kash's
   * OWN body kept — only the head becomes the Roblox box head and the
   * huge red sledgehammer is added; he slams it down. Scaled 0.80
   * about the feet (Alan's height). No intro strip yet. Idle v2
   * (Nov 20): rebuilt — stable stance like Alan's (only frames 1-6,
   * no sideways lean; feet and left edge steady). Idle v3 (Nov 20):
   * rebuilt again — only frames 1-4, the single outlier frame
   * removed; now as steady as Alan. Heavy v3 (Nov 20): hammer
   * draw/raise/slam slowed down — 6 frames each (was 4), ending
   * guard cut to 4; impact ~1.8s. Heavy v4 (Nov 20): REAL down-swing
   * — the v3 slam frames were just blurred wind-up, no hit; new
   * video generated of the hammer actually slamming down with a
   * dust impact; impact ~1.9s. */
  kash: {
    idle: strip("/sprites/kash-idle-v3.png", 12, true, 12),
    jab: strip("/sprites/kash-jab-v1.png", 28, false, 12),
    kick: strip("/sprites/kash-kick-v1.png", 12, false, 12),
    booger: strip("/sprites/kash-roblox-v4.png", 12, false, 28),
    block: strip("/sprites/kash-block-v1.png", 20, true, 12),
    // Nov 21 2026 (FlexFox prompts): real hit + KO strips.
    // Hit: guard -> flinch -> recoil (eyes shut, pained) -> guard.
    // KO: stagger, lean back, falls FLAT on his back, lies still.
    hit: strip("/sprites/kash-hit-v1.png", 28, false, 12),
    ko: strip("/sprites/kash-ko-v1.png", 12, false, 28),
  },
  /** Luca (Kash's brother, Nov 20 2026): Bayan's body/height/limbs —
   * built on Bayan's idle strip, NOT scaled 0.80 (stays ~320px tall
   * like Bayan — measured 320 vs her 319). BLOND hair (light yellow
   * under the cap). Black cap, glasses, grey t-shirt, black shorts
   * with red trim, black sneakers. Heavy is NOT a booger: the "booger"
   * slot holds the Grim Reaper scythe strip (28f) — Luca glows purple,
   * transforms into the Grim Reaper (black hooded robe, scythe),
   * swings the scythe down. v2 (Nov 20): blond hair — all strips
   * rebuilt from the blond guard. v3 (Nov 20): boyish face — the v2
   * face looked like Bayan's; new face with strong straight eyebrows,
   * narrower eyes, more angular jaw. Idle rebuilt from eyes-open
   * stable frames 8-10 only (frame 7 had closed eyes). No intro
   * strip yet. */
  luca: {
    idle: strip("/sprites/luca-idle-v3.png", 12, true, 12),
    jab: strip("/sprites/luca-jab-v3.png", 28, false, 12),
    kick: strip("/sprites/luca-kick-v3.png", 12, false, 12),
    booger: strip("/sprites/luca-reaper-v3.png", 12, false, 28),
    block: strip("/sprites/luca-block-v3.png", 20, true, 12),
    // Nov 21 2026 (FlexFox prompts): real hit strip. Guard -> recoil
    // (eyes shut, pained grimace, fists up) -> guard. No real KO strip:
    // his KO video never fell (only leans back further and further, still
    // standing at f48), so he keeps the procedural fall.
    hit: strip("/sprites/luca-hit-v1.png", 28, false, 12),
  },
};

/**
 * The booger monster, separated from Alan's strip: Alan's old booger strip
 * (v4) had him vanish for frames 11-27 (only the booger/monster was drawn),
 * so he looked like he turned into the monster. Now Alan's strip (v5) shows
 * only Alan (throw, then guard), and the monster is its own strip that runs
 * across the arena to the defender. 17 frames: booger flies, lands, grows
 * into the monster, runs, slaps (last frames = the impact).
 */
export const MONSTER_BOOGER: StripConfig = strip("/sprites/monster-booger.png", 12, false, 17);
