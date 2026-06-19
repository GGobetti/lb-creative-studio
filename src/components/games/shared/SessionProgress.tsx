'use client'

import { cn } from '@/lib/utils'

interface SessionProgressProps {
  current: number
  total: number
}

export function SessionProgress({ current, total }: SessionProgressProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-1.5 rounded-full transition-all duration-300',
              i < current ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {current}/{total}
      </span>
    </div>
  )
}
