'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadPhotoMatchQuestions } from '@/lib/gameDataLoader'
import type { PhotoMatchQuestion } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { TimerBar } from './shared/TimerBar'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'

const TIMER_SECONDS = 30
const SESSION_SIZE = 10
const POINTS_PER_ACTION = 10

export function PhotoMatch() {
  const router = useRouter()

  const [questions, setQuestions] = useState<PhotoMatchQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [actionsCount, setActionsCount] = useState(0)
  const [timerKey, setTimerKey] = useState(0)
  const [buttonsEnabled, setButtonsEnabled] = useState(false)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    loadPhotoMatchQuestions(SESSION_SIZE).then((data) => {
      setQuestions(data.sort(() => Math.random() - 0.5))
      setLoading(false)
    })
  }, [])

  const advance = useCallback(() => {
    setActionsCount((a) => a + 1)
    setPointsEarned((p) => p + POINTS_PER_ACTION)
    setShowPointsPopup(true)
    setTimeout(() => setShowPointsPopup(false), 1600)

    setTimeout(() => {
      if (currentIdx + 1 >= SESSION_SIZE) {
        setSessionComplete(true)
      } else {
        setCurrentIdx((i) => i + 1)
        setTimerKey((k) => k + 1)
      }
    }, 900)
  }, [currentIdx])

  const handleAnswer = useCallback(() => {
    if (!buttonsEnabled) return
    advance()
  }, [buttonsEnabled, advance])

  const handleTimeout = useCallback(() => {
    advance()
  }, [advance])

  const handleSkip = useCallback(() => {
    if (!buttonsEnabled) return
    if (currentIdx + 1 >= SESSION_SIZE) {
      setSessionComplete(true)
    } else {
      setCurrentIdx((i) => i + 1)
      setTimerKey((k) => k + 1)
    }
  }, [buttonsEnabled, currentIdx])

  // Anti-gaming: mínimo 1.5s antes de habilitar botões
  useEffect(() => {
    setButtonsEnabled(false)
    const t = setTimeout(() => setButtonsEnabled(true), 1500)
    return () => clearTimeout(t)
  }, [currentIdx])

  if (loading || questions.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando STLs...</p>
      </div>
    )
  }

  const currentQuestion = questions[currentIdx]

  if (sessionComplete) {
    return (
      <SessionResult
        actionsCount={actionsCount}
        pointsEarned={pointsEarned}
        onReplay={() => router.refresh()}
        onExit={() => router.push('/dashboard/games')}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <GameHeader
        title="Photo Match"
        pointsPerAction={POINTS_PER_ACTION}
        onBack={() => router.push('/dashboard/games')}
      />

      <TimerBar key={timerKey} seconds={TIMER_SECONDS} onTimeout={handleTimeout} paused={false} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="w-full sm:w-56 shrink-0 aspect-square rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
              {currentQuestion.imageUrl ? (
                <img
                  src={currentQuestion.imageUrl}
                  alt="Preview STL"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                  <ImageIcon size={36} />
                  <span className="text-xs">Preview</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div>
                <p className="text-label text-muted-foreground mb-1">Nome do arquivo</p>
                <h2 className="text-heading text-lg text-foreground leading-snug">
                  {currentQuestion.title}
                </h2>
              </div>
              <div>
                <p className="text-label text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentQuestion.description}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-sm text-center text-muted-foreground">
          A foto representa o modelo descrito?
        </p>

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={handleAnswer}
            disabled={!buttonsEnabled}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all',
              'border-2 border-success/30 text-success bg-success/5 hover:bg-success/12',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Check size={18} />
            Sim, confere
          </motion.button>

          <motion.button
            onClick={handleAnswer}
            disabled={!buttonsEnabled}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all',
              'border-2 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/12',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <X size={18} />
            Não confere
          </motion.button>
        </div>

        <motion.button
          onClick={handleSkip}
          disabled={!buttonsEnabled}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground bg-transparent hover:bg-muted/40 font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Pular (sem pontos)
        </motion.button>
      </div>

      <div className="px-4 pb-4 shrink-0">
        <SessionProgress current={currentIdx} total={SESSION_SIZE} />
      </div>

      <AnimatePresence>{showPointsPopup && <CreditsPopup credits={POINTS_PER_ACTION} />}</AnimatePresence>
    </div>
  )
}
