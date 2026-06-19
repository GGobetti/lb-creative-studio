'use client'

import { ArrowLeft, Star } from 'lucide-react'
import { motion } from 'framer-motion'

interface GameHeaderProps {
  title: string
  pointsPerAction: number
  onBack: () => void
}

export function GameHeader({ title, pointsPerAction, onBack }: GameHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Sair
      </button>

      <h1 className="text-heading text-base font-bold text-foreground">{title}</h1>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1.5 rounded-full"
      >
        <Star size={12} />
        +{pointsPerAction} pts/ação
      </motion.div>
    </div>
  )
}
