'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadTagDetectiveQuestions } from '@/lib/gameDataLoader'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/store'
import type { TagDetectiveQuestion } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'

const POINTS_PER_ACTION = 5

export function TagDetective() {
  const router = useRouter()
  const accessTokenRef = useRef<string | null>(null)

  const [questions, setQuestions] = useState<TagDetectiveQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [actionsCount, setActionsCount] = useState(0)
  const [markedIndices, setMarkedIndices] = useState<Set<number>>(new Set())
  const [confirmed, setConfirmed] = useState(false)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    loadTagDetectiveQuestions(8).then((data) => {
      setQuestions(data.sort(() => Math.random() - 0.5))
      setLoading(false)
    })
    getSupabaseBrowser().auth.getSession().then((res: { data: { session: { access_token: string } | null } }) => {
      accessTokenRef.current = res.data.session?.access_token ?? null
    })
  }, [])

  const SESSION_SIZE = questions.length || 8

  const advance = useCallback((earnedPoints: number) => {
    if (earnedPoints > 0) {
      setPointsEarned((p) => p + earnedPoints)
      setActionsCount((a) => a + 1)
      setShowPointsPopup(true)
      setTimeout(() => setShowPointsPopup(false), 1600)
    }

    setTimeout(() => {
      setConfirmed(false)
      setMarkedIndices(new Set())
      if (currentIdx + 1 >= SESSION_SIZE) {
        setSessionComplete(true)
      } else {
        setCurrentIdx((i) => i + 1)
      }
    }, 1000)
  }, [currentIdx, SESSION_SIZE])

  const handleConfirm = useCallback(() => {
    if (confirmed || markedIndices.size === 0) return
    setConfirmed(true)

    const currentQuestion = questions[currentIdx]
    const allTags = currentQuestion.tags
    const markedTags = [...markedIndices].map((i) => allTags[i].text)

    // Post votes asynchronously
    fetch('/api/games/tag-detective-vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessTokenRef.current}`,
      },
      body: JSON.stringify({
        stl_id: currentQuestion.id,
        irrelevant_tags: markedTags,
        all_tags: allTags.map((t) => t.text),
      }),
    }).then(async (res) => {
      try {
        const data = await res.json()
        if (data.level_up) {
          const { refreshXpSummary, refreshCredits } = useAppStore.getState()
          refreshXpSummary()
          const { data: profileData } = await getSupabaseBrowser()
            .from('profiles')
            .select('credits')
            .single()
          if (profileData) refreshCredits(profileData.credits)
        }
      } catch (_) { /* non-fatal */ }
    }).catch(console.error)

    advance(POINTS_PER_ACTION)
  }, [confirmed, markedIndices, advance, questions, currentIdx])

  const handleSkip = useCallback(() => {
    if (confirmed) return
    setConfirmed(true)
    setTimeout(() => {
      setConfirmed(false)
      setMarkedIndices(new Set())
      if (currentIdx + 1 >= SESSION_SIZE) {
        setSessionComplete(true)
      } else {
        setCurrentIdx((i) => i + 1)
      }
    }, 400)
  }, [confirmed, currentIdx, SESSION_SIZE])

  if (loading || questions.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando STLs...</p>
      </div>
    )
  }

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

  const currentQuestion = questions[currentIdx]

  const toggleMark = (i: number) => {
    if (confirmed) return
    setMarkedIndices((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <GameHeader
        title="Tag Detective"
        pointsPerAction={POINTS_PER_ACTION}
        onBack={() => router.push('/dashboard/games')}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                {currentQuestion.imageUrl ? (
                  <img src={currentQuestion.imageUrl} alt="STL" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-muted-foreground/40" />
                )}
              </div>
              <div>
                <p className="text-label text-muted-foreground mb-0.5">Modelo</p>
                <h2 className="text-heading text-base text-foreground">{currentQuestion.title}</h2>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Marque as tags que <span className="text-destructive font-semibold">não fazem sentido</span> para este modelo:
              </p>

              <div className="flex flex-wrap gap-2">
                {currentQuestion.tags.map((tag, i) => {
                  const isMarked = markedIndices.has(i)
                  return (
                    <motion.button
                      key={i}
                      onClick={() => toggleMark(i)}
                      whileTap={{ scale: 0.95 }}
                      disabled={confirmed}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                        isMarked
                          ? 'border-destructive bg-destructive/10 text-destructive line-through'
                          : 'border-border bg-muted text-foreground hover:border-primary/40',
                        confirmed && 'cursor-default',
                      )}
                    >
                      {tag.text}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={confirmed || markedIndices.size === 0}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmed ? 'Registrando...' : 'Confirmar seleção'}
          </button>

          <motion.button
            onClick={handleSkip}
            disabled={confirmed}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground bg-transparent hover:bg-muted/40 font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pular (sem pontos)
          </motion.button>
        </div>
      </div>

      <div className="px-4 pb-4 shrink-0">
        <SessionProgress current={currentIdx} total={SESSION_SIZE} />
      </div>

      <AnimatePresence>{showPointsPopup && <CreditsPopup credits={POINTS_PER_ACTION} />}</AnimatePresence>
    </div>
  )
}
