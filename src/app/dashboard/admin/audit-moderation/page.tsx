'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/translations'

interface AuditResult {
  id: string
  stl_id: string
  stl_title: string
  stl_image_url: string
  total_votes: number
  approved_votes: number
  approval_rate: number
  final_status: 'pending' | 'approved' | 'rejected' | 'contested'
  moderated_at: string | null
}

interface Vote {
  id: string
  auditor_id: string
  approved: boolean
  rejection_reason: string | null
  created_at: string
}

export default function AuditModerationPage() {
  const { t } = useTranslation()
  const supabase = getSupabaseBrowser()
  const [results, setResults] = useState<AuditResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStl, setSelectedStl] = useState<AuditResult | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [moderatingId, setModeratingId] = useState<string | null>(null)
  const [stlDetails, setStlDetails] = useState<{ description?: string; tags?: string[] } | null>(null)
  const [activeTab, setActiveTab] = useState<'audits' | 'suggestions'>('audits')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null)
  const [suggestionDetails, setSuggestionDetails] = useState<any | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)

  useEffect(() => {
    loadResults()
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('stl_audit_suggestions')
        .select(`
          *,
          stl:telegram_indexed_stls(id, title, description, photos)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSuggestions(data || [])
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from('stl_audit_results')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setResults(data || [])
    } catch (error) {
      console.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVotes = async (stlId: string) => {
    try {
      const { data, error } = await supabase
        .from('quality_audit_votes')
        .select('*')
        .eq('stl_id', stlId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVotes(data || [])
    } catch (error) {
      console.error('Error loading votes:', error)
    }
  }

  const loadStlDetails = async (stlId: string) => {
    try {
      const { data, error } = await supabase
        .from('telegram_indexed_stls')
        .select('description, tags')
        .eq('id', stlId)
        .single()

      if (error) throw error
      setStlDetails(data || {})
    } catch (error) {
      console.error('Error loading STL details:', error)
      setStlDetails({})
    }
  }

  const handleSelectStl = (result: AuditResult) => {
    setSelectedStl(result)
    loadVotes(result.stl_id)
    loadStlDetails(result.stl_id)
    setShowAuditModal(true)
  }

  const handleSelectSuggestion = (suggestion: any) => {
    setSelectedSuggestion(suggestion)
    // Load full STL details to show original info
    const loadDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('telegram_indexed_stls')
          .select('*')
          .eq('id', suggestion.stl_id)
          .single()

        if (error) throw error
        setSuggestionDetails(data)
      } catch (error) {
        console.error('Error loading suggestion details:', error)
      }
    }
    loadDetails()
  }

  const handleModerate = async (stlId: string, approved: boolean) => {
    setModeratingId(stlId)
    try {
      const { error } = await supabase
        .from('stl_audit_results')
        .update({
          final_status: approved ? 'approved' : 'rejected',
          moderated_by: (await supabase.auth.getUser()).data.user?.id,
          moderated_at: new Date().toISOString(),
        })
        .eq('stl_id', stlId)

      if (error) throw error
      await loadResults()
      setSelectedStl(null)
    } catch (error) {
      console.error('Error moderating:', error)
    } finally {
      setModeratingId(null)
    }
  }

  const handleApproveSuggestion = async (suggestionId: string, suggestion: any) => {
    setModeratingId(suggestionId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update suggestion status
      const { error: updateError } = await supabase
        .from('stl_audit_suggestions')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', suggestionId)

      if (updateError) throw updateError

      // Apply changes to STL
      const updates: any = { updated_at: new Date().toISOString() }
      if (suggestion.suggested_title) updates.title = suggestion.suggested_title
      if (suggestion.suggested_description) updates.description = suggestion.suggested_description

      const { error: stlError } = await supabase
        .from('telegram_indexed_stls')
        .update(updates)
        .eq('id', suggestion.stl_id)

      if (stlError) throw stlError

      await loadSuggestions()
      setSelectedSuggestion(null)
    } catch (error) {
      console.error('Error approving suggestion:', error)
    } finally {
      setModeratingId(null)
    }
  }

  const handleRejectSuggestion = async (suggestionId: string, reason: string = '') => {
    setModeratingId(suggestionId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('stl_audit_suggestions')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', suggestionId)

      if (error) throw error
      await loadSuggestions()
      setSelectedSuggestion(null)
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
    } finally {
      setModeratingId(null)
    }
  }

  const statusColor = {
    pending: 'text-muted-foreground',
    approved: 'text-success',
    rejected: 'text-destructive',
    contested: 'text-warning',
  }

  const statusBg = {
    pending: 'bg-muted',
    approved: 'bg-success/10',
    rejected: 'bg-destructive/10',
    contested: 'bg-warning/10',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    )
  }

  const contested = results.filter((r) => r.final_status === 'contested')
  const pending = results.filter((r) => r.final_status === 'pending')

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-heading text-2xl">{t('adminAuditModeration.title', 'Moderação de Auditorias')}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('audits')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'audits'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('adminAuditModeration.tabAudits', 'Auditorias')} {results.length > 0 && `(${results.length})`}
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'suggestions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t('adminAuditModeration.tabSuggestions', 'Sugestões')} {suggestions.length > 0 && `(${suggestions.length})`}
        </button>
      </div>

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="flex-1 overflow-y-auto p-4">
          {suggestions.length > 0 ? (
            <div className="grid gap-4 max-w-6xl mx-auto">
              {suggestions.map((suggestion) => (
                <motion.div
                  key={suggestion.id}
                  layout
                  className="border-2 border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <div className="p-4 space-y-4">
                    {/* Header com thumbnail + nome */}
                    <div className="flex gap-4 items-start">
                      <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                        {suggestion.stl?.photos?.[0] ? (
                          <img
                            src={suggestion.stl.photos[0]}
                            alt={suggestion.stl.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">{t('adminAuditModeration.noPreview', 'Sem preview')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-label text-muted-foreground text-xs">{t('adminAuditModeration.originalStl', 'STL Original')}</p>
                        <p className="text-heading text-lg font-bold truncate">
                          {suggestion.stl?.title || suggestion.stl_id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {suggestion.stl?.description || t('adminAuditModeration.noDescription', 'Sem descrição')}
                        </p>
                      </div>
                    </div>

                    {selectedSuggestion?.id === suggestion.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-border pt-4 space-y-3"
                      >
                        {/* Sugestões */}
                        {suggestion.suggested_title && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                                📝 {t('adminAuditModeration.suggestedTitle', 'Título sugerido')}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">{t('adminAuditModeration.original', 'Original')}</p>
                                <p className="text-sm font-medium text-foreground">
                                  {suggestionDetails?.title || 'N/A'}
                                </p>
                              </div>
                              <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                                <p className="text-xs text-success mb-1">{t('adminAuditModeration.suggestion', 'Sugestão')}</p>
                                <p className="text-sm font-medium text-foreground">
                                  {suggestion.suggested_title}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {suggestion.suggested_description && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                                📄 {t('adminAuditModeration.suggestedDescription', 'Descrição sugerida')}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                                <p className="text-xs text-muted-foreground mb-1">{t('adminAuditModeration.original', 'Original')}</p>
                                <p className="text-xs text-foreground leading-relaxed">
                                  {suggestionDetails?.description || 'N/A'}
                                </p>
                              </div>
                              <div className="bg-success/10 border border-success/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                                <p className="text-xs text-success mb-1">{t('adminAuditModeration.suggestion', 'Sugestão')}</p>
                                <p className="text-xs text-foreground leading-relaxed">
                                  {suggestion.suggested_description}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {suggestion.flagged_issues && (
                          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-destructive mb-1">⚠️ {t('adminAuditModeration.suggestionReason', 'Motivo da sugestão')}</p>
                            <p className="text-sm text-destructive">
                              {suggestion.flagged_issues}
                            </p>
                          </div>
                        )}

                        {/* Botões de ação */}
                        <div className="flex gap-2 pt-2 border-t border-border">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApproveSuggestion(suggestion.id, suggestion)
                            }}
                            disabled={moderatingId === suggestion.id}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/10 text-success hover:bg-success/20 font-semibold text-sm transition-all disabled:opacity-40"
                          >
                            <CheckCircle2 size={16} />
                            {t('adminAuditModeration.approve', 'Aprovar')}
                          </motion.button>
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRejectSuggestion(suggestion.id)
                            }}
                            disabled={moderatingId === suggestion.id}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold text-sm transition-all disabled:opacity-40"
                          >
                            <XCircle size={16} />
                            {t('adminAuditModeration.reject', 'Rejeitar')}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">✅ {t('adminAuditModeration.noPendingSuggestions', 'Nenhuma sugestão pendente')}</p>
            </div>
          )}
        </div>
      )}

      {/* Audits Tab */}
      {activeTab === 'audits' && (
        <div className="flex-1 overflow-y-auto p-4">
          {results.length > 0 ? (
            <div className="grid gap-3 max-w-4xl mx-auto">
              {results.map((result) => (
                <motion.button
                  key={result.id}
                  onClick={() => handleSelectStl(result)}
                  layout
                  className={cn(
                    'flex gap-4 items-start p-3 rounded-xl border-2 transition-all text-left hover:border-primary/50',
                    result.final_status === 'contested'
                      ? 'border-warning/50 bg-warning/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-muted border border-border shrink-0 overflow-hidden">
                    {result.stl_image_url ? (
                      <img
                        src={result.stl_image_url}
                        alt={result.stl_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        {t('adminAuditModeration.noPreview', 'Sem preview')}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{result.stl_title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.approved_votes}/{result.total_votes} {t('adminAuditModeration.votes', 'votos')} • {result.approval_rate?.toFixed(0)}% {t('adminAuditModeration.approvalRate', 'aprovação')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold px-2 py-1 rounded shrink-0',
                          result.final_status === 'contested'
                            ? 'bg-warning/20 text-warning'
                            : result.final_status === 'pending'
                              ? 'bg-muted text-muted-foreground'
                              : result.final_status === 'approved'
                                ? 'bg-success/20 text-success'
                                : 'bg-destructive/20 text-destructive',
                        )}
                      >
                        {result.final_status === 'contested' && `⚠️ ${t('adminAuditModeration.statusContested', 'Contestada')}`}
                        {result.final_status === 'pending' && `⏳ ${t('adminAuditModeration.statusPending', 'Pendente')}`}
                        {result.final_status === 'approved' && `✓ ${t('adminAuditModeration.statusApproved', 'Aprovada')}`}
                        {result.final_status === 'rejected' && `✗ ${t('adminAuditModeration.statusRejected', 'Rejeitada')}`}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">✅ {t('adminAuditModeration.noAuditsToModerate', 'Nenhuma auditoria para moderar')}</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes da Auditoria */}
      <AnimatePresence>
        {showAuditModal && selectedStl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowAuditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                <h2 className="text-heading text-xl font-bold truncate">{selectedStl.stl_title}</h2>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Preview */}
                {selectedStl.stl_image_url && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border">
                    <img
                      src={selectedStl.stl_image_url}
                      alt={selectedStl.stl_title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Status */}
                <div className={cn(
                  'px-3 py-2 rounded-lg text-sm font-semibold',
                  statusBg[selectedStl.final_status],
                  statusColor[selectedStl.final_status]
                )}>
                  {selectedStl.final_status === 'contested' && `⚠️ ${t('adminAuditModeration.statusContestedFull', 'Contestada - Aprove ou Rejeite')}`}
                  {selectedStl.final_status === 'pending' && `⏳ ${t('adminAuditModeration.statusPendingFull', 'Aguardando mais votos')}`}
                  {selectedStl.final_status === 'approved' && `✓ ${t('adminAuditModeration.statusApproved', 'Aprovada')}`}
                  {selectedStl.final_status === 'rejected' && `✗ ${t('adminAuditModeration.statusRejected', 'Rejeitada')}`}
                </div>

                {/* Description e Tags */}
                {stlDetails?.description && (
                  <div>
                    <p className="text-label text-muted-foreground mb-2">{t('adminAuditModeration.description', 'Descrição')}</p>
                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                      {stlDetails.description}
                    </p>
                  </div>
                )}

                {stlDetails?.tags && stlDetails.tags.length > 0 && (
                  <div>
                    <p className="text-label text-muted-foreground mb-2">{t('adminAuditModeration.tags', 'Tags')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stlDetails.tags.map((tag: string) => (
                        <span key={tag} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Votos */}
                <div className="border-t border-border pt-4">
                  <p className="text-label text-muted-foreground mb-3">{t('adminAuditModeration.voting', 'Votação')}</p>
                  <div className="bg-muted/50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">{t('adminAuditModeration.approvals', 'Aprovações')}</span>
                      <span className="text-sm font-semibold text-success">
                        {selectedStl.approved_votes}/{selectedStl.total_votes}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full"
                        style={{ width: `${selectedStl.approval_rate || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedStl.approval_rate?.toFixed(1)}% {t('adminAuditModeration.consensus', 'de consenso (70% = aprovado)')}
                    </p>
                  </div>

                  <p className="text-label text-muted-foreground mb-2">{t('adminAuditModeration.auditorVotes', 'Votos dos Auditores')}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {votes.length > 0 ? (
                      votes.map((vote) => (
                        <div key={vote.id} className="text-xs p-3 bg-muted/50 border border-border/50 rounded-lg">
                          <div className="flex items-start gap-2">
                            {vote.approved ? (
                              <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                            ) : (
                              <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <span className="font-medium text-foreground">
                                {vote.approved ? t('adminAuditModeration.approved', 'Aprovou') : t('adminAuditModeration.rejected', 'Rejeitou')}
                              </span>
                              {vote.rejection_reason && (
                                <p className="text-muted-foreground mt-1">{vote.rejection_reason}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('adminAuditModeration.noVotesRegistered', 'Nenhum voto registrado')}</p>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                {selectedStl.final_status === 'contested' && !selectedStl.moderated_at && (
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border">
                    <motion.button
                      onClick={() => {
                        handleModerate(selectedStl.stl_id, true)
                        setShowAuditModal(false)
                      }}
                      disabled={moderatingId === selectedStl.stl_id}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/10 text-success hover:bg-success/20 font-semibold text-sm transition-all disabled:opacity-40"
                    >
                      <CheckCircle2 size={16} />
                      {t('adminAuditModeration.approve', 'Aprovar')}
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        handleModerate(selectedStl.stl_id, false)
                        setShowAuditModal(false)
                      }}
                      disabled={moderatingId === selectedStl.stl_id}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold text-sm transition-all disabled:opacity-40"
                    >
                      <XCircle size={16} />
                      {t('adminAuditModeration.reject', 'Rejeitar')}
                    </motion.button>
                  </div>
                )}

                {selectedStl.moderated_at && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded-lg">
                    ✓ {t('adminAuditModeration.alreadyModerated', 'Já foi moderado')}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
