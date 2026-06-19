'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Image as ImageIcon, Tag, AlignLeft, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadAuditQuestions } from '@/lib/gameDataLoader'
import type { AuditQuestion } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'
import { getSupabaseBrowser } from '@/lib/supabase'

const SESSION_SIZE = 5
const POINTS_PER_AUDIT = 15

const REJECTION_REASONS = [
  'Imagem não representa o modelo',
  'Descrição insuficiente ou vazia',
  'Nome não descritivo',
  'Sem tags relevantes',
  'Conteúdo inapropriado',
  'Outro',
]

export function QualityAudit() {
  const router = useRouter()

  const [questions, setQuestions] = useState<AuditQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [actionsCount, setActionsCount] = useState(0)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set())
  const [otherReasonText, setOtherReasonText] = useState('')
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [suggestedTitle, setSuggestedTitle] = useState('')
  const [suggestedDescription, setSuggestedDescription] = useState('')
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    loadAuditQuestions(SESSION_SIZE).then((data) => {
      setQuestions(data.sort(() => Math.random() - 0.5))
      setLoading(false)
    })
    getSupabaseBrowser().auth.getSession().then((res: { data: { session: { access_token: string } | null } }) => {
      accessTokenRef.current = res.data.session?.access_token ?? null
    })
  }, [])

  const advance = useCallback(() => {
    setPointsEarned((p) => p + POINTS_PER_AUDIT)
    setActionsCount((a) => a + 1)
    setShowPointsPopup(true)
    setTimeout(() => setShowPointsPopup(false), 1600)

    setTimeout(() => {
      setSubmitting(false)
      if (currentIdx + 1 >= SESSION_SIZE) {
        setSessionComplete(true)
      } else {
        setCurrentIdx((i) => i + 1)
      }
    }, 1000)
  }, [currentIdx])

  const handleApprove = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/games/audit-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessTokenRef.current}` },
        body: JSON.stringify({
          stl_id: questions[currentIdx]?.id,
          approved: true,
          rejection_reason: null,
          game_type: 'quality-audit',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Erro ao votar (${res.status})`)
      }

      advance()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar voto'
      console.error('[QA] Vote error:', message)
      setSubmitError(message)
      setSubmitting(false)
    }
  }, [submitting, currentIdx, questions, advance])

  const handleRejectConfirm = useCallback(async () => {
    if (selectedReasons.size === 0 || submitting) return
    setShowRejectModal(false)
    setShowSuggestionModal(true)
  }, [selectedReasons, submitting])

  const handleSuggestionSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    const reasons = Array.from(selectedReasons)
    const rejectionReason = reasons.includes('Outro') && otherReasonText
      ? `${reasons.join('; ')} - ${otherReasonText}`
      : reasons.join('; ')

    try {
      const res = await fetch('/api/games/audit-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessTokenRef.current}` },
        body: JSON.stringify({
          stl_id: questions[currentIdx]?.id,
          approved: false,
          rejection_reason: rejectionReason,
          game_type: 'quality-audit',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Erro ao votar (${res.status})`)
      }

      // Se tem sugestões, salva também
      if (suggestedTitle || suggestedDescription) {
        await fetch('/api/games/audit-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessTokenRef.current}` },
          body: JSON.stringify({
            stl_id: questions[currentIdx]?.id,
            suggested_title: suggestedTitle || null,
            suggested_description: suggestedDescription || null,
            flagged_issues: rejectionReason,
          }),
        })
      }

      setSelectedReasons(new Set())
      setOtherReasonText('')
      setSuggestedTitle('')
      setSuggestedDescription('')
      setShowSuggestionModal(false)
      advance()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar voto'
      console.error('[QA] Vote error:', message)
      setSubmitError(message)
      setSubmitting(false)
    }
  }, [selectedReasons, otherReasonText, submitting, currentIdx, questions, suggestedTitle, suggestedDescription, advance])

  const handleSkip = useCallback(() => {
    if (submitting) return
    if (currentIdx + 1 >= SESSION_SIZE) {
      setSessionComplete(true)
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }, [submitting, currentIdx])

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
        onReplay={() => {
          setCurrentIdx(0)
          setPointsEarned(0)
          setActionsCount(0)
          setSessionComplete(false)
          setSubmitError(null)
          setSelectedReasons(new Set())
          setOtherReasonText('')
          loadAuditQuestions(SESSION_SIZE).then((data) => {
            setQuestions(data.sort(() => Math.random() - 0.5))
          })
        }}
        onExit={() => router.push('/dashboard/games')}
      />
    )
  }

  const currentQuestion = questions[currentIdx]
  const wordCount = currentQuestion.description.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col h-full">
      <GameHeader
        title="Quality Audit"
        pointsPerAction={POINTS_PER_AUDIT}
        onBack={() => router.push('/dashboard/games')}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
              {currentQuestion.imageUrl ? (
                <img src={currentQuestion.imageUrl} alt="STL" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                  <ImageIcon size={40} />
                  <span className="text-xs">Preview não disponível</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-heading text-lg text-foreground">{currentQuestion.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{currentQuestion.fileName}</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 flex flex-col gap-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlignLeft size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground leading-relaxed">{currentQuestion.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {currentQuestion.tags.length > 0 ? (
                      currentQuestion.tags.map((t) => (
                        <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-destructive">Sem tags</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-label text-muted-foreground">Critérios de qualidade</p>
                {[
                  { label: 'Imagem representativa', ok: !!currentQuestion.imageUrl },
                  { label: 'Nome descritivo (não genérico)', ok: currentQuestion.title.split(' ').length >= 3 },
                  { label: 'Descrição com 20+ palavras', ok: wordCount >= 20 },
                  { label: 'Pelo menos 2 tags', ok: currentQuestion.tags.length >= 2 },
                  { label: 'Conteúdo apropriado', ok: !currentQuestion.issues?.includes('Conteúdo adulto/inapropriado') },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {ok ? (
                      <CheckCircle2 size={14} className="text-success shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-destructive shrink-0" />
                    )}
                    <span className={ok ? 'text-foreground' : 'text-destructive'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-destructive font-medium">Erro ao registrar voto</p>
              <p className="text-xs text-destructive/80 mt-1">{submitError}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-success/30 text-success bg-success/5 hover:bg-success/12 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={18} />
              Aprovar STL
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={submitting}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/12 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle size={18} />
              Rejeitar STL
            </button>
          </div>

          <motion.button
            onClick={handleSkip}
            disabled={submitting}
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

      <AnimatePresence>{showPointsPopup && <CreditsPopup credits={POINTS_PER_AUDIT} />}</AnimatePresence>

      <AnimatePresence>
        {showSuggestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => !submitting && setShowSuggestionModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            >
              <div>
                <h3 className="text-heading text-base font-bold">Sugerir correções (opcional)</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajude a comunidade sugerindo melhorias para este STL
                </p>
              </div>

              {/* Suggested title */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">Título sugerido</label>
                <input
                  type="text"
                  placeholder={questions[currentIdx]?.title}
                  value={suggestedTitle}
                  onChange={(e) => setSuggestedTitle(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Suggested description */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">Descrição sugerida</label>
                <textarea
                  placeholder={questions[currentIdx]?.description}
                  value={suggestedDescription}
                  onChange={(e) => setSuggestedDescription(e.target.value)}
                  rows={3}
                  className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <p className="text-xs text-muted-foreground italic">
                💡 As sugestões são revisadas pelos moderadores antes de serem aplicadas.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowSuggestionModal(false)
                    setSuggestedTitle('')
                    setSuggestedDescription('')
                  }}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  Pular
                </button>
                <button
                  onClick={handleSuggestionSubmit}
                  disabled={submitting || (!suggestedTitle && !suggestedDescription)}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {submitting ? 'Enviando...' : 'Confirmar e continuar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-heading text-base font-bold">Motivos da rejeição (selecione um ou mais)</h3>
              <div className="flex flex-col gap-2.5">
                {REJECTION_REASONS.filter(r => r !== 'Outro').map((reason) => (
                  <label key={reason} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedReasons.has(reason)}
                      onChange={(e) => {
                        const newReasons = new Set(selectedReasons)
                        if (e.target.checked) {
                          newReasons.add(reason)
                        } else {
                          newReasons.delete(reason)
                        }
                        setSelectedReasons(newReasons)
                      }}
                      className="w-4 h-4 rounded border-border cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {reason}
                    </span>
                  </label>
                ))}
              </div>

              {/* Outro / Custom field */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedReasons.has('Outro')}
                    onChange={(e) => {
                      const newReasons = new Set(selectedReasons)
                      if (e.target.checked) {
                        newReasons.add('Outro')
                      } else {
                        newReasons.delete('Outro')
                      }
                      setSelectedReasons(newReasons)
                    }}
                    className="w-4 h-4 rounded border-border cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Outro (especifique)
                  </span>
                </label>
                {selectedReasons.has('Outro') && (
                  <input
                    type="text"
                    placeholder="Descreva o motivo..."
                    value={otherReasonText}
                    onChange={(e) => setOtherReasonText(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedReasons(new Set())
                    setOtherReasonText('')
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={selectedReasons.size === 0 || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
