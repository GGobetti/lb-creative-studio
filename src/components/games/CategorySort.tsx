'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadCategorySortItems } from '@/lib/gameDataLoader'
import { getSupabaseBrowser } from '@/lib/supabase'
import { STL_CATEGORIES } from '@/types/games'
import type { SortableStl } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'

const POINTS_PER_ROUND = 25
const SESSION_SIZE = 8

export function CategorySort() {
  const router = useRouter()
  const accessTokenRef = useRef<string | null>(null)

  const [stls, setStls] = useState<SortableStl[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [actionsCount, setActionsCount] = useState(0)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [suggestion, setSuggestion] = useState('')
  const [showSuggestionInput, setShowSuggestionInput] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)

  useEffect(() => {
    loadCategorySortItems(SESSION_SIZE).then((data) => {
      setStls(data)
      setLoading(false)
    })
    getSupabaseBrowser().auth.getSession().then((res: { data: { session: { access_token: string } | null } }) => {
      accessTokenRef.current = res.data.session?.access_token ?? null
    })
  }, [])

  const toggleCategory = useCallback((cat: string) => {
    if (confirmed) return
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }, [confirmed])

  const handleAddSuggestion = useCallback(() => {
    const trimmed = suggestion.trim()
    if (!trimmed || confirmed) return
    setSelectedCategories((prev) => new Set(prev).add(trimmed))
    setSuggestion('')
    setShowSuggestionInput(false)
  }, [suggestion, confirmed])

  const handleRemoveSuggestion = useCallback((cat: string) => {
    if (confirmed) return
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      next.delete(cat)
      return next
    })
  }, [confirmed])

  const advance = useCallback(() => {
    setConfirmed(false)
    setSelectedCategories(new Set())
    setSuggestion('')
    setShowSuggestionInput(false)
    if (currentIdx + 1 >= SESSION_SIZE) {
      setSessionComplete(true)
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }, [currentIdx])

  const handleConfirm = useCallback(() => {
    if (confirmed || selectedCategories.size === 0) return
    setConfirmed(true)

    const currentStl = stls[currentIdx]
    const categories = [...selectedCategories]
    const standardCategories = categories.filter((c) => STL_CATEGORIES.includes(c))
    const suggestedCategories = categories.filter((c) => !STL_CATEGORIES.includes(c))

    fetch('/api/games/category-vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessTokenRef.current}`,
      },
      body: JSON.stringify({
        stl_id: currentStl.id,
        categories: standardCategories,
        suggested_categories: suggestedCategories,
      }),
    }).catch(console.error)

    setPointsEarned((p) => p + POINTS_PER_ROUND)
    setActionsCount((a) => a + 1)
    setShowPointsPopup(true)
    setTimeout(() => setShowPointsPopup(false), 1600)
    setTimeout(advance, 1000)
  }, [confirmed, selectedCategories, stls, currentIdx, advance])

  const handleSkip = useCallback(() => {
    if (confirmed) return
    setConfirmed(true)
    setTimeout(advance, 400)
  }, [confirmed, advance])

  if (loading || stls.length === 0) {
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

  const currentStl = stls[currentIdx]
  const userSuggestions = [...selectedCategories].filter((c) => !STL_CATEGORIES.includes(c))

  return (
    <div className="flex flex-col h-full">
      <GameHeader
        title="Category Sort"
        pointsPerAction={POINTS_PER_ROUND}
        onBack={() => router.push('/dashboard/games')}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStl.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3"
          >
            <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center">
              {currentStl.imageUrl ? (
                <img src={currentStl.imageUrl} alt={currentStl.title} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-label text-muted-foreground mb-0.5">Modelo</p>
              <h2 className="text-heading text-base text-foreground leading-snug line-clamp-2">{currentStl.title}</h2>
              {currentStl.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{currentStl.description}</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="text-sm text-muted-foreground">
          Selecione <span className="text-foreground font-semibold">uma ou mais categorias</span> que descrevem este modelo:
        </p>

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-2">
          {STL_CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.has(cat)
            return (
              <motion.button
                key={cat}
                onClick={() => toggleCategory(cat)}
                whileTap={{ scale: 0.97 }}
                disabled={confirmed}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/4',
                  confirmed && 'cursor-default',
                )}
              >
                <span>{cat}</span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-primary-foreground font-bold">✓</span>
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* User suggestions */}
        {userSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {userSuggestions.map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-accent/40 bg-accent/10 text-accent text-sm font-medium"
              >
                {cat}
                <button
                  onClick={() => handleRemoveSuggestion(cat)}
                  disabled={confirmed}
                  className="hover:text-destructive transition-colors disabled:pointer-events-none"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Suggest new category */}
        {showSuggestionInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
              placeholder="Ex: Cosplay, Peças de Carro..."
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl border-2 border-primary/40 bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
            <button
              onClick={handleAddSuggestion}
              disabled={!suggestion.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
            >
              Adicionar
            </button>
            <button
              onClick={() => { setShowSuggestionInput(false); setSuggestion('') }}
              className="px-3 py-2 rounded-xl border-2 border-border text-muted-foreground text-sm"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSuggestionInput(true)}
            disabled={confirmed}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors disabled:pointer-events-none"
          >
            <Plus size={14} />
            Sugerir outra categoria
          </button>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={selectedCategories.size === 0 || confirmed}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {confirmed
              ? 'Registrando...'
              : selectedCategories.size === 0
                ? 'Selecione ao menos uma categoria'
                : `Confirmar (${selectedCategories.size} categoria${selectedCategories.size > 1 ? 's' : ''})`}
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

      <AnimatePresence>{showPointsPopup && <CreditsPopup credits={POINTS_PER_ROUND} />}</AnimatePresence>
    </div>
  )
}
