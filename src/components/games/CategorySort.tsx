'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadCategorySortItems } from '@/lib/gameDataLoader'
import { STL_CATEGORIES } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'

const POINTS_PER_ROUND = 20

export function CategorySort() {
  const router = useRouter()

  const [rounds, setRounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [roundIdx, setRoundIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [actionsCount, setActionsCount] = useState(0)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [selectedStlId, setSelectedStlId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    loadCategorySortItems(15).then((items) => {
      const newRounds = []
      for (let i = 0; i < 5; i++) {
        const batch = items.slice(i * 3, i * 3 + 3)
        const categories = [...new Set(batch.map((s) => s.correctCategory))]
        const extras = STL_CATEGORIES.filter((c) => !categories.includes(c))
        while (categories.length < 4) categories.push(extras.shift()!)
        newRounds.push({ items: batch, categories: categories.sort(() => Math.random() - 0.5) })
      }
      setRounds(newRounds)
      setLoading(false)
    })
  }, [])

  const handleSelectStl = useCallback((id: string) => {
    if (confirmed) return
    setSelectedStlId((prev) => (prev === id ? null : id))
  }, [confirmed])

  const handleSelectCategory = useCallback((cat: string) => {
    if (confirmed) return
    setSelectedStlId((prev) => {
      if (!prev) return prev
      setAssignments((a) => ({ ...a, [prev]: cat }))
      return null
    })
  }, [confirmed])

  const handleConfirm = useCallback(() => {
    const currentRound = rounds[roundIdx]
    if (!currentRound) return
    const allAssigned = currentRound.items.every((item: any) => assignments[item.id])
    if (!allAssigned || confirmed) return

    setConfirmed(true)
    setPointsEarned((p) => p + POINTS_PER_ROUND)
    setActionsCount((a) => a + 1)
    setShowPointsPopup(true)
    setTimeout(() => setShowPointsPopup(false), 1600)

    setTimeout(() => {
      setConfirmed(false)
      setAssignments({})
      setSelectedStlId(null)
      if (roundIdx + 1 >= rounds.length) {
        setSessionComplete(true)
      } else {
        setRoundIdx((i) => i + 1)
      }
    }, 1200)
  }, [confirmed, assignments, rounds, roundIdx])

  const handleSkip = useCallback(() => {
    if (confirmed) return
    setConfirmed(true)
    setTimeout(() => {
      setConfirmed(false)
      setAssignments({})
      setSelectedStlId(null)
      if (roundIdx + 1 >= rounds.length) {
        setSessionComplete(true)
      } else {
        setRoundIdx((i) => i + 1)
      }
    }, 400)
  }, [confirmed, roundIdx, rounds])

  if (loading || rounds.length === 0) {
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

  const currentRound = rounds[roundIdx]
  const allAssigned = currentRound.items.every((item: any) => assignments[item.id])

  return (
    <div className="flex flex-col h-full">
      <GameHeader
        title="Category Sort"
        pointsPerAction={POINTS_PER_ROUND}
        onBack={() => router.push('/dashboard/games')}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <p className="text-sm text-muted-foreground text-center">
          {selectedStlId
            ? 'Agora toque na categoria que melhor descreve este modelo ↓'
            : 'Toque em um modelo para selecioná-lo →'}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={roundIdx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
          >
            {currentRound.items.map((item: any) => {
              const isSelected = selectedStlId === item.id
              const assigned = assignments[item.id]

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectStl(item.id)}
                  disabled={confirmed}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-center',
                    isSelected && 'border-primary bg-primary/8 scale-[1.02]',
                    !isSelected && assigned && 'border-success/40 bg-success/5 opacity-70',
                    !isSelected && !assigned && 'border-border bg-card hover:border-primary/40 hover:bg-primary/4',
                  )}
                >
                  <div className="w-full aspect-square rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground leading-tight">{item.title}</p>

                  {assigned && (
                    <span className="text-[10px] text-success font-semibold bg-success/10 px-2 py-0.5 rounded-full">
                      {assigned}
                    </span>
                  )}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>

        <div>
          <p className="text-label text-muted-foreground mb-2">Categorias</p>
          <div className="grid grid-cols-2 gap-2">
            {currentRound.categories.map((cat: string) => {
              const itemsInCat = Object.entries(assignments).filter(([, c]) => c === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  disabled={!selectedStlId || confirmed}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                    selectedStlId && !confirmed
                      ? 'border-primary/40 bg-primary/5 text-foreground hover:bg-primary/12 hover:border-primary cursor-pointer'
                      : 'border-border bg-card text-muted-foreground cursor-default opacity-60',
                  )}
                >
                  <span>{cat}</span>
                  {itemsInCat > 0 && (
                    <span className="text-xs bg-primary/15 text-primary font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {itemsInCat}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={!allAssigned || confirmed}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmed ? 'Registrando...' : 'Confirmar categorias'}
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
        <SessionProgress current={roundIdx} total={rounds.length} />
      </div>

      <AnimatePresence>{showPointsPopup && <CreditsPopup credits={POINTS_PER_ROUND} />}</AnimatePresence>
    </div>
  )
}
