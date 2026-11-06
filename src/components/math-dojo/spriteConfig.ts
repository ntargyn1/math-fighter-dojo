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

export type CharacterId = "alan" | "bayan";
export type SpriteAnim = "idle" | "jab" | "cross" | "uppercut" | "block" | "hit" | "ko";

const FRAME = { frames: 6, frameWidth: 326, frameHeight: 348 } as const;
const strip = (src: string, fps: number, loop: boolean, frames = FRAME.frames): StripConfig => ({ src, fps, loop, frames, frameWidth: FRAME.frameWidth, frameHeight: FRAME.frameHeight });

export interface CharacterSprites {
  idle: StripConfig;
  jab: StripConfig;
  cross: StripConfig;
  uppercut: StripConfig;
  block: StripConfig;
  /** Optional real strips. When missing, hit/ko are procedural on top of the current strip. */
  hit?: StripConfig;
  ko?: StripConfig; // drop-in slot: alan-ko.png / bayan-ko.png
}

export const CHARACTERS: Record<CharacterId, CharacterSprites> = {
  alan: {
    idle: strip("/sprites/alan-idle-v3.png", 12, true, 12),
    jab: strip("/sprites/alan-jab-v3.png", 28, false, 12),
    cross: strip("/sprites/alan-cross-v3.png", 24, false, 12),
    uppercut: strip("/sprites/alan-uppercut-v3.png", 22, false, 12),
    block: strip("/sprites/alan-block-v2.png", 20, true, 12),
  },
  bayan: {
    idle: strip("/sprites/bayan-idle-v3.png", 12, true, 12),
    jab: strip("/sprites/bayan-jab-v3.png", 28, false, 12),
    cross: strip("/sprites/bayan-cross-v3.png", 24, false, 12),
    uppercut: strip("/sprites/bayan-uppercut-v3.png", 22, false, 12),
    block: strip("/sprites/bayan-block-v2.png", 20, true, 12),
  },
};
