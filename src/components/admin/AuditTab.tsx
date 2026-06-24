'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, XCircle, ThumbsUp, Tag,
  Image as ImageIcon, FolderOpen, Pencil, Trash2, RotateCcw,
  ChevronRight, Camera, Loader2, Clock,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueItem {
  stl_id: string
  title: string
  photo: string | null
  marked_for_removal: boolean
  removal_reason: string | null
  pending_suggestions: number
  top_suggestion_upvotes: number
  photo_mismatch_pct: number
  photo_votes_total: number
  tag_irrelevant_count: number
  category_votes_total: number
}

interface Signals {
  stl: {
    id: string; title: string; description: string; photos: string[]
    tags: string[]; categories: string[]; file_name: string
    marked_for_removal: boolean; removal_reason: string | null
  }
  photo: { total: number; correct: number; mismatch_pct: number }
  tags: { tag: string; total: number; irrelevant: number; irrelevant_pct: number }[]
  categories: {
    total_voters: number
    votes: { category: string; count: number }[]
    suggestions: { category: string; count: number }[]
  }
  suggestions: {
    id: string; suggested_title: string | null; suggested_description: string | null
    suggested_tags: string[]; suggested_categories: string[]
    flagged_issues: string | null; upvote_count: number; created_at: string
  }[]
}

type FilterType = 'all' | 'removal' | 'suggestions' | 'photo' | 'tags'

const THRESHOLD = 0.75

// ─── Queue Item Card ──────────────────────────────────────────────────────────

function QueueCard({ item, selected, onClick }: {
  item: QueueItem
  selected: boolean
  onClick: () => void
}) {
  const signals = [
    item.marked_for_removal && { icon: Trash2, label: 'Remoção', color: 'text-destructive' },
    item.pending_suggestions > 0 && { icon: Pencil, label: `${item.pending_suggestions} sugestões`, color: 'text-primary' },
    item.photo_mismatch_pct >= 0.60 && { icon: Camera, label: `${Math.round(item.photo_mismatch_pct * 100)}% diverge`, color: 'text-warning' },
    item.tag_irrelevant_count > 0 && { icon: Tag, label: `${item.tag_irrelevant_count} tag(s)`, color: 'text-orange-400' },
  ].filter(Boolean) as { icon: any; label: string; color: string }[]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
        selected
          ? 'border-primary bg-primary/8'
          : 'border-border hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden shrink-0">
        {item.photo
          ? <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground/40" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          {signals.map((s, i) => (
            <span key={i} className={cn('flex items-center gap-0.5 text-xs', s.color)}>
              <s.icon size={10} />{s.label}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </button>
  )
}

// ─── Signal Sections ──────────────────────────────────────────────────────────

function PhotoSignal({ data, threshold }: { data: Signals['photo']; threshold: number }) {
  if (data.total === 0) return null
  const pct = Math.round(data.mismatch_pct * 100)
  const flagged = data.mismatch_pct >= threshold

  return (
    <div className={cn('rounded-xl p-4 border', flagged ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30')}>
      <div className="flex items-center gap-2 mb-2">
        <Camera size={14} className={flagged ? 'text-destructive' : 'text-muted-foreground'} />
        <p className="text-sm font-semibold">PhotoMatch</p>
        <span className={cn('ml-auto text-xs font-bold', flagged ? 'text-destructive' : 'text-muted-foreground')}>
          {pct}% divergência
        </span>
      </div>
      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-destructive rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{data.total} votos · {data.correct} corretos</p>
      {flagged && (
        <p className="text-xs text-destructive mt-1 font-medium">⚠️ Acima do limite de {Math.round(threshold * 100)}% — a foto pode estar errada</p>
      )}
    </div>
  )
}

function TagSignals({ tags, threshold, onRemoveTag, loading }: {
  tags: Signals['tags']
  threshold: number
  onRemoveTag: (tag: string) => void
  loading: string | null
}) {
  const flagged = tags.filter((t) => t.irrelevant_pct >= threshold)
  const ok = tags.filter((t) => t.irrelevant_pct < threshold)
  if (tags.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={14} className="text-muted-foreground" />
        <p className="text-sm font-semibold">TagDetective</p>
        <span className="ml-auto text-xs text-muted-foreground">{tags.length} tags analisadas</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {[...flagged, ...ok].map((t) => {
          const pct = Math.round(t.irrelevant_pct * 100)
          const bad = t.irrelevant_pct >= threshold
          return (
            <div key={t.tag} className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium',
                bad ? 'border-destructive/40 bg-destructive/10 text-destructive line-through' : 'border-border bg-muted text-foreground'
              )}>
                {t.tag}
              </span>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', bad ? 'bg-destructive' : 'bg-muted-foreground/30')}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
              {bad && (
                <button
                  onClick={() => onRemoveTag(t.tag)}
                  disabled={loading === t.tag}
                  className="text-xs text-destructive hover:underline disabled:opacity-40 shrink-0"
                >
                  {loading === t.tag ? <Loader2 size={10} className="animate-spin" /> : 'remover'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CategorySignals({ data }: { data: Signals['categories'] }) {
  if (data.total_voters === 0) return null
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen size={14} className="text-muted-foreground" />
        <p className="text-sm font-semibold">CategorySort</p>
        <span className="ml-auto text-xs text-muted-foreground">{data.total_voters} votos</span>
      </div>
      <div className="flex flex-col gap-1">
        {data.votes.slice(0, 6).map(({ category, count }) => (
          <div key={category} className="flex items-center gap-2">
            <span className="text-xs text-foreground w-36 truncate">{category}</span>
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round((count / data.total_voters) * 100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
          </div>
        ))}
        {data.suggestions.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Sugeridas: {data.suggestions.slice(0, 3).map((s) => `${s.category} (${s.count})`).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}

function SuggestionCards({ suggestions, onApply, onReject, loading }: {
  suggestions: Signals['suggestions']
  onApply: (id: string) => void
  onReject: (id: string) => void
  loading: string | null
}) {
  if (suggestions.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold flex items-center gap-2">
        <ThumbsUp size={14} className="text-primary" />
        Sugestões da comunidade ({suggestions.length})
      </p>
      {suggestions.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
          {s.flagged_issues && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle size={10} />{s.flagged_issues}
            </p>
          )}
          {s.suggested_title && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Título</p>
              <p className="text-sm text-foreground">{s.suggested_title}</p>
            </div>
          )}
          {s.suggested_description && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Descrição</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{s.suggested_description}</p>
            </div>
          )}
          {s.suggested_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold w-full mb-0.5">Tags</p>
              {s.suggested_tags.map((t) => (
                <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
          {s.suggested_categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold w-full mb-0.5">Categorias</p>
              {s.suggested_categories.map((c) => (
                <span key={c} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThumbsUp size={10} />{s.upvote_count} apoios
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onReject(s.id)}
                disabled={loading === s.id}
                className="px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40"
              >
                Recusar
              </button>
              <button
                onClick={() => onApply(s.id)}
                disabled={loading === s.id}
                className="px-2.5 py-1 rounded-lg bg-success/10 text-success border border-success/30 text-xs font-semibold hover:bg-success/20 transition-colors disabled:opacity-40"
              >
                {loading === s.id ? <Loader2 size={10} className="animate-spin" /> : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Types ─── (Pre-approved title queue) ────────────────────────────────────

interface PreApprovedSuggestion {
  id: string
  stl_id: string
  suggested_title: string
  upvote_count: number
  created_at: string
  stl: {
    id: string
    title: string
    photos: string[]
  } | null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditTab() {
  const accessTokenRef = useRef<string | null>(null)
  const [queue, setQueue]             = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [filter, setFilter]           = useState<FilterType>('all')
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [signals, setSignals]         = useState<Signals | null>(null)
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [actionLoading, setActionLoading]   = useState<string | null>(null)
  const [preTitleQueue, setPreTitleQueue]   = useState<PreApprovedSuggestion[]>([])
  const [titleActionLoading, setTitleActionLoading] = useState<string | null>(null)
  const [pendingValidation, setPendingValidation] = useState<{ id: string; title: string; photos: string[] | null; thumbnail_url: string | null }[]>([])

  useEffect(() => {
    getSupabaseBrowser().auth.getSession().then((res: any) => {
      accessTokenRef.current = res.data.session?.access_token ?? null
      loadQueue()
      loadPreTitleQueue()
      loadPendingValidation()
    })
  }, [])

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessTokenRef.current}`,
  })

  const loadPreTitleQueue = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    const { data } = await supabase
      .from('stl_audit_suggestions')
      .select(`
        id,
        stl_id,
        suggested_title,
        upvote_count,
        created_at,
        stl:telegram_indexed_stls!inner(id, title, photos)
      `)
      .eq('status', 'pre_approved')
      .order('upvote_count', { ascending: false })
      .limit(50)
    setPreTitleQueue((data as unknown as PreApprovedSuggestion[]) || [])
  }, [])

  const handleTitleAction = useCallback(async (suggestionId: string, action: 'apply' | 'reject') => {
    setTitleActionLoading(suggestionId)
    try {
      // Optimistic removal
      setPreTitleQueue((prev) => prev.filter((i) => i.id !== suggestionId))

      const res = await fetch('/api/admin/apply-title-suggestion', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ suggestion_id: suggestionId, action }),
      })

      if (!res.ok) {
        // Rollback on failure — re-fetch
        loadPreTitleQueue()
        console.error('[TITLE-ACTION] Failed:', await res.json())
      } else {
        // Background refresh to sync any other changes
        loadPreTitleQueue()
      }
    } catch (e) {
      console.error('[TITLE-ACTION]', e)
      loadPreTitleQueue()
    } finally {
      setTitleActionLoading(null)
    }
  }, [loadPreTitleQueue])

  const loadPendingValidation = useCallback(async () => {
    const supabase = getSupabaseBrowser()
    const { data } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title, photos, thumbnail_url')
      .eq('needs_validation', true)
      .order('updated_at', { ascending: false })
      .limit(50)
    setPendingValidation(data || [])
  }, [])

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const res = await fetch('/api/admin/audit-queue', { headers: authHeaders() })
      const data = await res.json()
      setQueue(data.items || [])
    } finally {
      setQueueLoading(false)
    }
  }, [])

  const loadSignals = useCallback(async (stlId: string) => {
    setSignalsLoading(true)
    setSignals(null)
    try {
      const res = await fetch(`/api/admin/stl-signals?stl_id=${stlId}`, { headers: authHeaders() })
      const data = await res.json()
      setSignals(data)
    } finally {
      setSignalsLoading(false)
    }
  }, [])

  const handleSelect = (stlId: string) => {
    setSelectedId(stlId)
    loadSignals(stlId)
  }

  const doAction = useCallback(async (body: Record<string, any>) => {
    const key = body.tag || body.suggestion_id || body.action
    setActionLoading(key)
    try {
      const res = await fetch('/api/admin/stl-action', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ stl_id: selectedId, ...body }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      // Refresh queue, signals, and pending validation list
      const refreshes: Promise<any>[] = [
        loadQueue(),
        selectedId ? loadSignals(selectedId) : Promise.resolve(),
      ]
      if (body.action === 'needs_validation' || body.action === 'clear_validation') {
        refreshes.push(loadPendingValidation())
      }
      await Promise.all(refreshes)
    } catch (e) {
      console.error('[ADMIN-ACTION]', e)
    } finally {
      setActionLoading(null)
    }
  }, [selectedId, loadQueue, loadSignals, loadPendingValidation])

  const filteredQueue = queue.filter((item) => {
    if (filter === 'removal') return item.marked_for_removal
    if (filter === 'suggestions') return item.pending_suggestions > 0
    if (filter === 'photo') return item.photo_mismatch_pct >= 0.60
    if (filter === 'tags') return item.tag_irrelevant_count > 0
    return true
  })

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: queue.length },
    { key: 'removal', label: 'Remoção', count: queue.filter((i) => i.marked_for_removal).length },
    { key: 'suggestions', label: 'Sugestões', count: queue.filter((i) => i.pending_suggestions > 0).length },
    { key: 'photo', label: 'Foto', count: queue.filter((i) => i.photo_mismatch_pct >= 0.60).length },
    { key: 'tags', label: 'Tags', count: queue.filter((i) => i.tag_irrelevant_count > 0).length },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── Pre-approved Title Queue ── */}
      {preTitleQueue.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <ThumbsUp size={14} className="text-primary" />
            Títulos Pré-Aprovados pela Comunidade ({preTitleQueue.length})
          </h3>
          <div className="space-y-2">
            {preTitleQueue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden shrink-0">
                  {item.stl?.photos?.[0]
                    ? <img src={item.stl.photos[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground/40" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    Atual: <span className="text-foreground">{item.stl?.title}</span>
                  </p>
                  <p className="text-sm font-medium truncate">
                    Novo: <span className="text-primary">{item.suggested_title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <ThumbsUp size={10} />{item.upvote_count} apoios
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleTitleAction(item.id, 'apply')}
                    disabled={titleActionLoading === item.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/30 text-xs font-semibold hover:bg-success/20 transition-colors disabled:opacity-40"
                  >
                    {titleActionLoading === item.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Aplicar
                  </button>
                  <button
                    onClick={() => handleTitleAction(item.id, 'reject')}
                    disabled={titleActionLoading === item.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40"
                  >
                    <XCircle size={12} />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Validation Queue ── */}
      {pendingValidation.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock size={14} />
            Aguardando Validação ({pendingValidation.length})
          </h3>
          <div className="space-y-2">
            {pendingValidation.map((stl) => (
              <div key={stl.id} className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/30 bg-card">
                <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden shrink-0">
                  {(stl.thumbnail_url || stl.photos?.[0])
                    ? <img src={stl.thumbnail_url || stl.photos![0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground/40" /></div>}
                </div>
                <p className="flex-1 text-sm truncate text-foreground">{stl.title}</p>
                <button
                  onClick={() => doAction({ action: 'clear_validation', stl_id: stl.id })}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/30 text-xs font-semibold hover:bg-success/20 transition-colors disabled:opacity-40 shrink-0"
                >
                  <CheckCircle2 size={12} /> Validado — Publicar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">

      {/* ── Left: Queue ── */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
            </button>
          ))}
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {queueLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={32} className="text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum item nesta fila</p>
            </div>
          ) : (
            filteredQueue.map((item) => (
              <QueueCard
                key={item.stl_id}
                item={item}
                selected={selectedId === item.stl_id}
                onClick={() => handleSelect(item.stl_id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Detail ── */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-4">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <AlertTriangle size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Selecione um STL para ver os sinais</p>
          </div>
        ) : signalsLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        ) : signals ? (
          <>
            {/* STL Header */}
            <div className="flex gap-4 items-start">
              <div className="w-32 h-32 shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                {signals.stl.photos?.[0]
                  ? <img src={signals.stl.photos[0]} alt={signals.stl.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={28} className="text-muted-foreground/30" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{signals.stl.file_name}</p>
                <h2 className="text-lg font-bold text-foreground leading-snug">{signals.stl.title}</h2>
                {signals.stl.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{signals.stl.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {signals.stl.tags.map((t) => (
                    <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                {signals.stl.marked_for_removal && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive font-semibold">
                    <AlertTriangle size={12} /> Marcado para remoção: {signals.stl.removal_reason}
                  </div>
                )}
              </div>
            </div>

            {/* Signals */}
            <PhotoSignal data={signals.photo} threshold={THRESHOLD} />
            <TagSignals
              tags={signals.tags}
              threshold={THRESHOLD}
              onRemoveTag={(tag) => doAction({ action: 'remove_tag', tag })}
              loading={actionLoading}
            />
            <CategorySignals data={signals.categories} />
            <SuggestionCards
              suggestions={signals.suggestions}
              onApply={(id) => doAction({ action: 'apply_suggestion', suggestion_id: id })}
              onReject={(id) => doAction({ action: 'reject_suggestion', suggestion_id: id })}
              loading={actionLoading}
            />

            {/* Action bar */}
            <div className="border-t border-border pt-4 flex flex-wrap gap-2 sticky bottom-0 bg-background/95 pb-2">
              <button
                onClick={() => doAction({ action: 'keep_stl' })}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-success/10 text-success border border-success/30 text-sm font-semibold hover:bg-success/20 transition-colors disabled:opacity-40"
              >
                <CheckCircle2 size={15} /> Manter STL
              </button>
              <button
                onClick={() => doAction({ action: 'needs_validation' })}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-600/10 text-yellow-500 border border-yellow-600/30 text-sm font-semibold hover:bg-yellow-600/20 transition-colors disabled:opacity-40"
                title="Ocultar da busca até revisão"
              >
                <Clock size={15} /> Validar Mais Tarde
              </button>
              <button
                onClick={() => doAction({ action: 'remove_stl' })}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/30 text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-40"
              >
                <Trash2 size={15} /> Remover STL
              </button>
              <button
                onClick={() => { loadQueue(); loadSignals(selectedId) }}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition-colors disabled:opacity-40 ml-auto"
              >
                <RotateCcw size={14} /> Recarregar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
    </div>
  )
}
