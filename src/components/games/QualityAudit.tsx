'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Image as ImageIcon, Tag, AlignLeft,
  AlertTriangle, ChevronDown, ChevronUp, ThumbsUp, Pencil, Plus, X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { loadAuditQuestions } from '@/lib/gameDataLoader'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/store'
import { STL_CATEGORIES } from '@/types/games'
import type { AuditQuestion, AuditSuggestion } from '@/types/games'
import { GameHeader } from './shared/GameHeader'
import { SessionProgress } from './shared/SessionProgress'
import { CreditsPopup } from './shared/CreditsPopup'
import { SessionResult } from './shared/SessionResult'
import { cn } from '@/lib/utils'

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

// ─── Community Suggestions Panel ─────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  token,
  onUpvoteChange,
}: {
  suggestion: AuditSuggestion
  token: string | null
  onUpvoteChange: (id: string, newCount: number, hasUpvoted: boolean) => void
}) {
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (loading || !token) return
    setLoading(true)
    const action = suggestion.has_upvoted ? 'remove' : 'upvote'
    try {
      const res = await fetch('/api/games/audit-suggestion-upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suggestion_id: suggestion.id, action }),
      })
      const data = await res.json()
      if (data.success) {
        onUpvoteChange(suggestion.id, data.upvote_count, action === 'upvote')
      }
    } finally {
      setLoading(false)
    }
  }

  const hasAnyContent =
    suggestion.suggested_title ||
    suggestion.suggested_description ||
    suggestion.suggested_tags.length > 0 ||
    suggestion.suggested_categories.length > 0 ||
    suggestion.flagged_issues

  if (!hasAnyContent) return null

  return (
    <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-2 border border-border/50">
      {suggestion.flagged_issues && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1">
          <AlertTriangle size={11} /> {suggestion.flagged_issues}
        </p>
      )}
      {suggestion.suggested_title && (
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Título sugerido</p>
          <p className="text-sm text-foreground">{suggestion.suggested_title}</p>
        </div>
      )}
      {suggestion.suggested_description && (
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Descrição sugerida</p>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{suggestion.suggested_description}</p>
        </div>
      )}
      {suggestion.suggested_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide w-full mb-0.5">Tags sugeridas</p>
          {suggestion.suggested_tags.map((t) => (
            <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}
      {suggestion.suggested_categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide w-full mb-0.5">Categorias sugeridas</p>
          {suggestion.suggested_categories.map((c) => (
            <span key={c} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground">
          {new Date(suggestion.created_at).toLocaleDateString('pt-BR')}
        </p>
        <button
          onClick={toggle}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all',
            suggestion.has_upvoted
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-muted text-muted-foreground border border-border hover:border-primary/30 hover:text-primary',
            loading && 'opacity-50 cursor-not-allowed',
          )}
        >
          <ThumbsUp size={11} />
          {suggestion.upvote_count} {suggestion.has_upvoted ? 'votado' : 'apoiar'}
        </button>
      </div>
    </div>
  )
}

// ─── Edit/Suggest Modal ───────────────────────────────────────────────────────

function SuggestModal({
  question,
  onClose,
  onSubmit,
  submitting,
}: {
  question: AuditQuestion
  onClose: () => void
  onSubmit: (payload: {
    suggested_title: string
    suggested_description: string
    suggested_tags: string[]
    suggested_categories: string[]
    flagged_issues: string
    approved: boolean
  }) => Promise<void>
  submitting: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([...question.tags])
  const [tagInput, setTagInput] = useState('')
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set())
  const [otherReason, setOtherReason] = useState('')
  const [verdict, setVerdict] = useState<'approve' | 'reject' | null>(null)

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, '')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  const flaggedIssues = [
    ...[...selectedReasons].filter((r) => r !== 'Outro'),
    ...(selectedReasons.has('Outro') && otherReason ? [otherReason] : []),
  ].join('; ')

  const hasChanges = title || description || tags.join() !== question.tags.join() ||
    categories.size > 0 || flaggedIssues

  const canSubmit = verdict !== null && !submitting

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h3 className="text-heading text-base font-bold">Sugerir melhorias</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Preencha apenas os campos que precisam de correção</p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={question.title}
              className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={question.description || 'Descrição do modelo...'}
              rows={3}
              className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Tags</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-muted min-h-[40px]">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  #{t}
                  <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-destructive">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="add tag..."
                  className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none w-20"
                />
                <button onClick={addTag} className="text-muted-foreground hover:text-primary">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Categorias</label>
            <div className="grid grid-cols-2 gap-1.5">
              {STL_CATEGORIES.map((cat) => {
                const sel = categories.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => setCategories((prev) => {
                      const next = new Set(prev)
                      sel ? next.delete(cat) : next.add(cat)
                      return next
                    })}
                    className={cn(
                      'text-left px-2.5 py-2 rounded-lg border text-xs font-medium transition-all',
                      sel
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Problems */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Problemas identificados</label>
            {REJECTION_REASONS.filter((r) => r !== 'Outro').map((reason) => (
              <label key={reason} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedReasons.has(reason)}
                  onChange={(e) => {
                    const next = new Set(selectedReasons)
                    e.target.checked ? next.add(reason) : next.delete(reason)
                    setSelectedReasons(next)
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{reason}</span>
              </label>
            ))}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedReasons.has('Outro')}
                onChange={(e) => {
                  const next = new Set(selectedReasons)
                  e.target.checked ? next.add('Outro') : next.delete('Outro')
                  setSelectedReasons(next)
                }}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Outro</span>
            </label>
            {selectedReasons.has('Outro') && (
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Descreva o problema..."
                className="px-3 py-2 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/40"
              />
            )}
          </div>

          {/* Verdict */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            <p className="text-sm font-medium text-foreground">Seu veredito sobre o STL</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVerdict('approve')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                  verdict === 'approve'
                    ? 'border-success bg-success/15 text-success'
                    : 'border-border text-muted-foreground hover:border-success/40 hover:text-success',
                )}
              >
                <CheckCircle2 size={15} /> Aprovar
              </button>
              <button
                onClick={() => setVerdict('reject')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                  verdict === 'reject'
                    ? 'border-destructive bg-destructive/15 text-destructive'
                    : 'border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive',
                )}
              >
                <XCircle size={15} /> Rejeitar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border shrink-0 flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit({
              suggested_title: title,
              suggested_description: description,
              suggested_tags: tags,
              suggested_categories: [...categories],
              flagged_issues: flaggedIssues,
              approved: verdict === 'approve',
            })}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Enviando...' : 'Enviar sugestões'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QualityAudit() {
  const router = useRouter()
  const accessTokenRef = useRef<string | null>(null)

  const [questions, setQuestions]         = useState<AuditQuestion[]>([])
  const [loading, setLoading]             = useState(true)
  const [currentIdx, setCurrentIdx]       = useState(0)
  const [pointsEarned, setPointsEarned]   = useState(0)
  const [actionsCount, setActionsCount]   = useState(0)
  const [submitting, setSubmitting]       = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [showPointsPopup, setShowPointsPopup] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [showSuggestModal, setShowSuggestModal] = useState(false)

  // Community suggestions
  const [suggestions, setSuggestions]         = useState<AuditSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  useEffect(() => {
    loadAuditQuestions(SESSION_SIZE).then((data) => {
      setQuestions(data.sort(() => Math.random() - 0.5))
      setLoading(false)
    })
    getSupabaseBrowser().auth.getSession().then((res: { data: { session: { access_token: string } | null } }) => {
      accessTokenRef.current = res.data.session?.access_token ?? null
    })
  }, [])

  // Load suggestions whenever STL changes
  useEffect(() => {
    if (!questions[currentIdx]) return
    const stlId = questions[currentIdx].id
    setSuggestions([])
    setSuggestionsOpen(false)
    setSuggestionsLoading(true)

    fetch(`/api/games/audit-suggestions?stl_id=${stlId}`, {
      headers: { Authorization: `Bearer ${accessTokenRef.current}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions || [])
        if ((data.suggestions || []).length > 0) setSuggestionsOpen(true)
      })
      .catch(console.error)
      .finally(() => setSuggestionsLoading(false))
  }, [currentIdx, questions])

  const advance = useCallback(() => {
    setPointsEarned((p) => p + POINTS_PER_AUDIT)
    setActionsCount((a) => a + 1)
    setShowPointsPopup(true)
    setTimeout(() => setShowPointsPopup(false), 1600)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitError(null)
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessTokenRef.current}` },
        body: JSON.stringify({ stl_id: questions[currentIdx]?.id, approved: true, game_type: 'quality-audit' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.level_up) {
        try {
          const { refreshXpSummary, refreshCredits } = useAppStore.getState()
          refreshXpSummary()
          const { data: profileData } = await getSupabaseBrowser()
            .from('profiles')
            .select('credits')
            .single()
          if (profileData) refreshCredits(profileData.credits)
        } catch (_) { /* non-fatal */ }
      }
      advance()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erro ao votar')
      setSubmitting(false)
    }
  }, [submitting, currentIdx, questions, advance])

  const handleSuggestSubmit = useCallback(async (payload: {
    suggested_title: string
    suggested_description: string
    suggested_tags: string[]
    suggested_categories: string[]
    flagged_issues: string
    approved: boolean
  }) => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    setShowSuggestModal(false)

    const stlId = questions[currentIdx]?.id

    try {
      // 1. Record the vote (approve or reject)
      const voteRes = await fetch('/api/games/audit-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessTokenRef.current}` },
        body: JSON.stringify({
          stl_id: stlId,
          approved: payload.approved,
          rejection_reason: payload.flagged_issues || null,
          game_type: 'quality-audit',
        }),
      })
      const voteData = await voteRes.json()
      if (!voteRes.ok) throw new Error(voteData.error)
      if (voteData.level_up) {
        try {
          const { refreshXpSummary, refreshCredits } = useAppStore.getState()
          refreshXpSummary()
          const { data: profileData } = await getSupabaseBrowser()
            .from('profiles')
            .select('credits')
            .single()
          if (profileData) refreshCredits(profileData.credits)
        } catch (_) { /* non-fatal */ }
      }

      // 2. Save suggestion if anything was changed
      const hasChanges = payload.suggested_title || payload.suggested_description ||
        payload.flagged_issues || payload.suggested_tags.length > 0 ||
        payload.suggested_categories.length > 0

      if (hasChanges) {
        await fetch('/api/games/audit-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessTokenRef.current}` },
          body: JSON.stringify({
            stl_id: stlId,
            suggested_title:       payload.suggested_title       || null,
            suggested_description: payload.suggested_description || null,
            suggested_tags:        payload.suggested_tags,
            suggested_categories:  payload.suggested_categories,
            flagged_issues:        payload.flagged_issues        || null,
          }),
        })
      }

      advance()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Erro ao enviar')
      setSubmitting(false)
    }
  }, [submitting, currentIdx, questions, advance])

  const handleUpvoteChange = useCallback((id: string, newCount: number, hasUpvoted: boolean) => {
    setSuggestions((prev) =>
      prev.map((s) => s.id === id ? { ...s, upvote_count: newCount, has_upvoted: hasUpvoted } : s)
    )
  }, [])

  const handleSkip = useCallback(() => {
    if (submitting) return
    setSubmitError(null)
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
          setCurrentIdx(0); setPointsEarned(0); setActionsCount(0)
          setSessionComplete(false); setSubmitError(null)
          loadAuditQuestions(SESSION_SIZE).then((data) => setQuestions(data.sort(() => Math.random() - 0.5)))
        }}
        onExit={() => router.push('/dashboard/games')}
      />
    )
  }

  const q = questions[currentIdx]
  const wordCount = q.description.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col h-full">
      <GameHeader title="Quality Audit" pointsPerAction={POINTS_PER_AUDIT} onBack={() => router.push('/dashboard/games')} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            {/* Photo */}
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
              {q.imageUrl ? (
                <img src={q.imageUrl} alt="STL" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                  <ImageIcon size={40} />
                  <span className="text-xs">Preview não disponível</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-heading text-lg text-foreground">{q.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{q.fileName}</p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 flex flex-col gap-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlignLeft size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground leading-relaxed">{q.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {q.tags.length > 0 ? (
                      q.tags.map((t) => (
                        <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                      ))
                    ) : (
                      <span className="text-xs text-destructive">Sem tags</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quality checklist */}
              <div className="flex flex-col gap-1.5">
                <p className="text-label text-muted-foreground">Critérios</p>
                {[
                  { label: 'Imagem representativa', ok: !!q.imageUrl },
                  { label: 'Nome descritivo', ok: q.title.split(' ').length >= 3 },
                  { label: 'Descrição com 20+ palavras', ok: wordCount >= 20 },
                  { label: 'Pelo menos 2 tags', ok: q.tags.length >= 2 },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {ok
                      ? <CheckCircle2 size={14} className="text-success shrink-0" />
                      : <XCircle size={14} className="text-destructive shrink-0" />}
                    <span className={ok ? 'text-foreground' : 'text-destructive'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Suggestions */}
            {(suggestionsLoading || suggestions.length > 0) && (
              <div className="border border-border/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setSuggestionsOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <ThumbsUp size={14} className="text-primary" />
                    <span>
                      {suggestionsLoading
                        ? 'Carregando sugestões...'
                        : `${suggestions.length} sugestão${suggestions.length !== 1 ? 'ões' : ''} da comunidade`}
                    </span>
                  </span>
                  {suggestionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <AnimatePresence>
                  {suggestionsOpen && !suggestionsLoading && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 flex flex-col gap-2">
                        {suggestions.map((s) => (
                          <SuggestionCard
                            key={s.id}
                            suggestion={s}
                            token={accessTokenRef.current}
                            onUpvoteChange={handleUpvoteChange}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{submitError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-success/30 text-success bg-success/5 hover:bg-success/12 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={18} />
              Aprovar
            </button>
            <button
              onClick={() => setShowSuggestModal(true)}
              disabled={submitting}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-primary/30 text-primary bg-primary/5 hover:bg-primary/12 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pencil size={18} />
              Sugerir edições
            </button>
          </div>

          <motion.button
            onClick={handleSkip}
            disabled={submitting}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground bg-transparent hover:bg-muted/40 font-medium text-sm transition-all disabled:opacity-40"
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
        {showSuggestModal && (
          <SuggestModal
            question={q}
            onClose={() => !submitting && setShowSuggestModal(false)}
            onSubmit={handleSuggestSubmit}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
