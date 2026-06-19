'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

interface CreditsPopupProps {
  credits: number
}

export function CreditsPopup({ credits }: CreditsPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="flex items-center gap-2 bg-card border border-primary/30 shadow-overlay rounded-2xl px-5 py-3">
        <Star size={18} className="text-primary" />
        <span className="text-primary font-black text-lg">+{credits}</span>
        <span className="text-muted-foreground text-sm">pontos</span>
      </div>
    </motion.div>
  )
}
