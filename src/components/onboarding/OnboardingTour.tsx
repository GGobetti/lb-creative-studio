'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/store'
import { useShallow } from 'zustand/react/shallow'
import { getSupabaseBrowser } from '@/lib/supabase'

interface TourStep {
  target: string       // seletor data-tour="..."
  title: string
  description: string
  placement: 'bottom' | 'right' | 'left' | 'top'
}

const STEPS: TourStep[] = [
  {
    target: 'credits',
    title: 'Seu saldo de créditos',
    description: 'Cada download de STL gasta créditos. Ganhe mais jogando no Gaming Lab XP ou comprando pacotes.',
    placement: 'bottom',
  },
  {
    target: 'stl-search',
    title: 'Garimpo 3D',
    description: 'Explore milhares de arquivos STL extraídos de canais do Telegram. Filtre, favorite e baixe.',
    placement: 'right',
  },
  {
    target: 'games',
    title: 'Gaming Lab XP',
    description: 'Valide o catálogo jogando mini-games e ganhe créditos + XP por cada contribuição.',
    placement: 'right',
  },
  {
    target: 'profile',
    title: 'Seu perfil & XP',
    description: 'Acompanhe seu nível, badges conquistados e histórico de atividade.',
    placement: 'bottom',
  },
]

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const PAD = 8

export function OnboardingTour() {
  const { profile, setProfile } = useAppStore(
    useShallow((s) => ({ profile: s.profile, setProfile: s.setProfile }))
  )
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [visible, setVisible] = useState(false)

  const updateRect = useCallback(() => {
    const r = getTargetRect(STEPS[step]?.target ?? '')
    setRect(r)
  }, [step])

  useEffect(() => {
    if (!profile || profile.onboarding_completed) return
    // Pequeno delay para o DOM estar pronto
    const t = setTimeout(() => {
      updateRect()
      setVisible(true)
    }, 600)
    return () => clearTimeout(t)
  }, [profile, updateRect])

  useEffect(() => {
    updateRect()
  }, [step, updateRect])

  useEffect(() => {
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [updateRect])

  const markCompleted = useCallback(async () => {
    setVisible(false)
    if (!profile) return
    const supabase = getSupabaseBrowser()
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', profile.id)
    setProfile({ ...profile, onboarding_completed: true })
  }, [profile, setProfile])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      markCompleted()
    }
  }

  if (!profile || profile.onboarding_completed || !visible || !rect) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  // Posição do tooltip
  const tooltipStyle: React.CSSProperties = (() => {
    const margin = 14
    if (current.placement === 'right') {
      return { top: rect.top + rect.height / 2 - 70, left: rect.left + rect.width + margin }
    }
    if (current.placement === 'bottom') {
      return { top: rect.top + rect.height + margin, left: Math.max(12, rect.left - 60) }
    }
    if (current.placement === 'top') {
      return { top: rect.top - 160 - margin, left: Math.max(12, rect.left - 60) }
    }
    return { top: rect.top + rect.height / 2 - 70, left: rect.left - 300 - margin }
  })()

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Overlay escuro com buraco no elemento alvo */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${rect.width + PAD * 2}px ${rect.height + PAD * 2}px
                at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px,
                transparent 100%,
                rgba(0,0,0,0.72) 100%
              )`,
            }}
          />

          {/* Ring de destaque */}
          <motion.div
            key={`ring-${step}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[61] rounded-xl pointer-events-none"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: '0 0 0 2px rgba(6,182,212,0.8), 0 0 24px rgba(6,182,212,0.3)',
            }}
          />

          {/* Tooltip card */}
          <motion.div
            key={`tooltip-${step}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[62] w-72 bg-card border border-border rounded-2xl shadow-xl p-4 pointer-events-auto"
            style={tooltipStyle}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-foreground leading-snug">{current.title}</p>
              <button
                onClick={markCompleted}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Pular tour"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {current.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {isLast ? (
                  <>
                    Começar <CheckCircle2 size={14} />
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
