export type AnimationType = "idle" | "punch" | "kick";

export interface AnimationDetails {
  rowIndex: number;
  frameCount: number;
  fps: number;
  loop: boolean;
}

export const SPRITE_CONFIG = {
  frameWidth: 170,
  frameHeight: 170,
  animations: {
    idle: { rowIndex: 0, frameCount: 6, fps: 8, loop: true },
    punch: { rowIndex: 1, frameCount: 6, fps: 12, loop: false },
    kick: { rowIndex: 2, frameCount: 6, fps: 12, loop: false },
  } as Record<AnimationType, AnimationDetails>,
};

export const useSpriteMetadata = (type: AnimationType): AnimationDetails => {
  return SPRITE_CONFIG.animations[type];
};
