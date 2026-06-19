"use client";

import { cn } from "@/lib/utils";

interface DotMatrixLoaderProps {
  className?: string;
  dotSize?: number;
  color?: string;
  rows?: number;
  cols?: number;
  text?: string;
}

export function DotMatrixLoader({
  className,
  dotSize = 6,
  color = "bg-primary",
  rows = 5,
  cols = 5,
  text = "Carregando modelo 3D...",
}: DotMatrixLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <div 
        className="grid gap-2 mb-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            // Calculate delay based on wave distance from center
            const centerR = (rows - 1) / 2;
            const centerC = (cols - 1) / 2;
            const dist = Math.sqrt(Math.pow(r - centerR, 2) + Math.pow(c - centerC, 2));
            const delay = dist * 0.15;
            
            return (
              <div
                key={`${r}-${c}`}
                className={cn("rounded-full animate-pulse opacity-20", color)}
                style={{
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                  animationDelay: `${delay}s`,
                  animationDuration: "1.2s",
                }}
              />
            );
          })
        )}
      </div>
      {text && (
        <span className="text-xs font-black tracking-widest text-muted-foreground/80 uppercase animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
}
