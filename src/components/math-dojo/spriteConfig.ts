import alanIdle from "@/assets/fighters/alan-idle.png.asset.json";
import alanJab from "@/assets/fighters/alan-jab.png.asset.json";
import alanCross from "@/assets/fighters/alan-cross.png.asset.json";
import alanUppercut from "@/assets/fighters/alan-uppercut.png.asset.json";
import alanBlock from "@/assets/fighters/alan-block.png.asset.json";
import bayanIdle from "@/assets/fighters/bayan-idle.png.asset.json";
import bayanJab from "@/assets/fighters/bayan-jab.png.asset.json";
import bayanCross from "@/assets/fighters/bayan-cross.png.asset.json";
import bayanUppercut from "@/assets/fighters/bayan-uppercut.png.asset.json";
import bayanBlock from "@/assets/fighters/bayan-block.png.asset.json";

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
const strip = (src: string, fps: number, loop: boolean): StripConfig => ({ src, fps, loop, ...FRAME });

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
    idle: strip(alanIdle.url, 2, true),
    jab: strip(alanJab.url, 14, false),
    cross: strip(alanCross.url, 12, false),
    uppercut: strip(alanUppercut.url, 11, false),
    block: strip(alanBlock.url, 10, true),
  },
  bayan: {
    idle: strip(bayanIdle.url, 2, true),
    jab: strip(bayanJab.url, 14, false),
    cross: strip(bayanCross.url, 12, false),
    uppercut: strip(bayanUppercut.url, 11, false),
    block: strip(bayanBlock.url, 10, true),
  },
};

const preloaded: HTMLImageElement[] = [];
/** Fetch every strip once so none is blank on first display. */
export function preloadSprites() {
  if (preloaded.length || typeof window === "undefined") return;
  for (const c of Object.values(CHARACTERS)) {
    for (const s of Object.values(c)) {
      if (!s) continue;
      const img = new Image();
      img.src = s.src;
      preloaded.push(img);
    }
  }
}
