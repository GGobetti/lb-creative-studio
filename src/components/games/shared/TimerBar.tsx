'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface TimerBarProps {
  seconds: number
  onTimeout: () => void
  paused?: boolean
}

export function TimerBar({ seconds, onTimeout, paused = false }: TimerBarProps) {
  const [remaining, setRemaining] = useState(seconds)
  const calledRef = useRef(false)

  useEffect(() => {
    setRemaining(seconds)
    calledRef.current = false
  }, [seconds])

  useEffect(() => {
    if (paused) return
    if (remaining <= 0) {
      if (!calledRef.current) {
        calledRef.current = true
        onTimeout()
      }
      return
    }
    const tick = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(tick)
  }, [remaining, paused, onTimeout])

  const pct = (remaining / seconds) * 100
  const colorClass =
    pct > 50 ? 'bg-primary' :
    pct > 25 ? 'bg-warning' :
               'bg-destructive'

  return (
    <div className="h-1 w-full bg-border shrink-0">
      <div
        className={cn('h-full transition-all duration-1000 ease-linear', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
