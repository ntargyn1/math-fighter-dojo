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

export type CharacterId = "alan" | "bayan" | "mateo" | "kash";
export type SpriteAnim = "idle" | "intro" | "jab" | "kick" | "booger" | "block" | "hit" | "ko";

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
}

export const CHARACTERS: Record<CharacterId, CharacterSprites> = {
  alan: {
    idle: strip("/sprites/alan-idle-v6.png", 12, true, 12),
    intro: strip("/sprites/alan-intro-v2.png", 10, false, 10),
    jab: strip("/sprites/alan-jab-v7.png", 28, false, 12),
    kick: strip("/sprites/alan-kick-v2.png", 12, false, 12),
    booger: strip("/sprites/alan-booger-v5.png", 12, false, 28),
    block: strip("/sprites/alan-block-v4.png", 20, true, 12),
  },
  bayan: {
    idle: strip("/sprites/bayan-idle-v6.png", 12, true, 12),
    intro: strip("/sprites/bayan-intro-v1.png", 10, false, 14),
    jab: strip("/sprites/bayan-jab-v6.png", 28, false, 12),
    kick: strip("/sprites/bayan-jumpkick-v1.png", 12, false, 12),
    booger: strip("/sprites/bayan-cat-v2.png", 12, false, 28),
    block: strip("/sprites/bayan-block-v2.png", 20, true, 12),
  },
  /** Mateo (Alan's friend, Nov 20 2026): same strikes as Alan for now —
   * jab / kick / booger (monster) / block. v8: v7 body + v5 face +
   * lighter skin. v9 (Nov 20): v8 + slightly snub nose. Alan's exact
   * body and limbs, Mateo's curly hair, v5 face, snub nose, white
   * shirt, dark blue shorts, light skin. Scaled 0.80 about the feet
   * (Alan's height). No intro strip yet (idle plays at battle start). */
  mateo: {
    idle: strip("/sprites/mateo-idle-v9.png", 12, true, 12),
    jab: strip("/sprites/mateo-jab-v9.png", 28, false, 12),
    kick: strip("/sprites/mateo-kick-v9.png", 12, false, 12),
    booger: strip("/sprites/mateo-booger-v9.png", 12, false, 28),
    block: strip("/sprites/mateo-block-v9.png", 20, true, 12),
  },
  /** Kash (Alan's friend, Nov 20 2026): same scheme as Mateo — Alan's
   * body with Kash's face and clothes. Short light-brown hair, dark
   * glasses, dark grey Happy Halloween Pikachu shirt, grey-blue shorts.
   * Heavy is NOT a booger: the "booger" slot holds the Roblox
   * sledgehammer strip (28f) — Kash glows, transforms into a blocky
   * Roblox avatar, and slams a huge red sledgehammer. Scaled 0.80
   * about the feet (Alan's height). No intro strip yet. */
  kash: {
    idle: strip("/sprites/kash-idle-v1.png", 12, true, 12),
    jab: strip("/sprites/kash-jab-v1.png", 28, false, 12),
    kick: strip("/sprites/kash-kick-v1.png", 12, false, 12),
    booger: strip("/sprites/kash-roblox-v1.png", 12, false, 28),
    block: strip("/sprites/kash-block-v1.png", 20, true, 12),
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
