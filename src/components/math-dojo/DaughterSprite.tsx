import React, { useEffect, useRef, useState } from "react";
import { SPRITE_CONFIG, useSpriteMetadata, type AnimationType } from "./spriteConfig";

interface DaughterSpriteProps {
  animationType: AnimationType;
  isAnimating: boolean;
  onAnimationComplete?: () => void;
  spriteUrl: string;
  className?: string;
  flipped?: boolean;
}

export const DaughterSprite: React.FC<DaughterSpriteProps> = ({
  animationType,
  isAnimating,
  onAnimationComplete,
  spriteUrl,
  className = "",
  flipped = false,
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const config = useSpriteMetadata(animationType);

  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    frameRef.current = 0;
    setCurrentFrame(0);
    lastFrameTimeRef.current = performance.now();
  }, [animationType]);

  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const frameDuration = 1000 / config.fps;

    const renderLoop = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameDuration) {
        lastFrameTimeRef.current = timestamp - (elapsed % frameDuration);
        let nextFrame = frameRef.current + 1;

        if (nextFrame >= config.frameCount) {
          if (config.loop) {
            nextFrame = 0;
          } else {
            if (onAnimationComplete) {
              setTimeout(() => onAnimationComplete(), 0);
            }
            return;
          }
        }

        frameRef.current = nextFrame;
        setCurrentFrame(nextFrame);
      }

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    animationRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animationType, isAnimating, config, onAnimationComplete]);

  const bgX = `-${currentFrame * SPRITE_CONFIG.frameWidth}px`;
  const bgY = `-${config.rowIndex * SPRITE_CONFIG.frameHeight}px`;

  return (
    <div
      className={`daughter-game-sprite ${className}`}
      style={{
        width: `${SPRITE_CONFIG.frameWidth}px`,
        height: `${SPRITE_CONFIG.frameHeight}px`,
        backgroundImage: `url(${spriteUrl})`,
        backgroundPosition: `${bgX} ${bgY}`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        transform: flipped ? "scaleX(-1)" : undefined,
      }}
    />
  );
};
