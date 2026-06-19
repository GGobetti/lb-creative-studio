'use client'

import { motion } from 'framer-motion'
import { Star, RotateCcw, LayoutGrid } from 'lucide-react'

interface SessionResultProps {
  actionsCount: number
  pointsEarned: number
  onReplay: () => void
  onExit: () => void
}

export function SessionResult({ actionsCount, pointsEarned, onReplay, onExit }: SessionResultProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-6xl"
      >
        🏅
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-display text-2xl text-foreground">Sessão completa!</h2>
        <p className="text-muted-foreground mt-1">
          {actionsCount} {actionsCount === 1 ? 'avaliação' : 'avaliações'} registradas
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-primary/10 border border-primary/20 rounded-2xl px-10 py-5"
      >
        <div className="flex items-center justify-center gap-2">
          <Star size={22} className="text-primary" />
          <span className="text-4xl font-black text-primary">+{pointsEarned}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">pontos de gamificação</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">convertidos em créditos futuramente</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex gap-3 w-full max-w-xs"
      >
        <button
          onClick={onReplay}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw size={15} />
          Jogar novamente
        </button>
        <button
          onClick={onExit}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <LayoutGrid size={15} />
          Hub de jogos
        </button>
      </motion.div>
    </div>
  )
}
