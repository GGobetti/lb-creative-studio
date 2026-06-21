"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { getSupabaseBrowser } from "@/lib/supabase"
import { RefreshCw, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function ScraperMonitor() {
  const [scraperJobs, setScraperJobs] = useState<any[]>([])
  const [scraperSettings, setScraperSettings] = useState<any>(null)
  const [scraperHeartbeat, setScraperHeartbeat] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"approvals" | "photos">("approvals")
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null)
  const [actingJobId, setActingJobId] = useState<string | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [selectedBans, setSelectedBans] = useState<string[]>([])
  const [dismissedPhotos, setDismissedPhotosState] = useState<string[]>([])
  const [isBanningPhotos, setIsBanningPhotos] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_scraper_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300)
      if (error) throw error
      setScraperJobs(data || [])
    } catch (err) {
      console.error("Erro ao carregar jobs:", err)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_scraper_settings")
        .select("*")
        .eq("id", "default")
        .single()
      if (error) throw error
      setScraperSettings(data)
      setScraperHeartbeat(data?.last_heartbeat || null)
    } catch (err) {
      console.error("Erro ao carregar configurações:", err)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem("dismissedAdminPhotos")
    if (saved) {
      try {
        setDismissedPhotosState(JSON.parse(saved))
      } catch {}
    }
  }, [])

  const persistDismissed = (next: string[]) => {
    setDismissedPhotosState(next)
    if (typeof window !== "undefined") localStorage.setItem("dismissedAdminPhotos", JSON.stringify(next))
  }

  useEffect(() => {
    fetchJobs()
    fetchSettings()

    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel("scraper-monitor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_scraper_jobs" }, () => fetchJobs())
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_scraper_settings" }, () => fetchSettings())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchJobs, fetchSettings])

  useEffect(() => {
    const interval = setInterval(async () => {
      const downloadingJobs = scraperJobs.filter(j => j.status === "downloading_file")
      if (downloadingJobs.length === 0) return
      let updated = false
      const newJobs = [...scraperJobs]
      for (const job of downloadingJobs) {
        try {
          const res = await fetch(`/api/telegram/progress?job_id=${job.id}`)
          if (res.ok) {
            const data = await res.json()
            if (data.progress !== undefined && data.progress !== job.progress) {
              const idx = newJobs.findIndex(j => j.id === job.id)
              if (idx > -1) { newJobs[idx] = { ...newJobs[idx], progress: data.progress }; updated = true }
            }
          }
        } catch {}
      }
      if (updated) setScraperJobs(newJobs)
    }, 3000)
    return () => clearInterval(interval)
  }, [scraperJobs])

  const getScraperStatus = (): "healthy" | "warning" | "offline" | "unknown" => {
    if (!scraperHeartbeat) return "unknown"
    const diff = (Date.now() - new Date(scraperHeartbeat).getTime()) / 1000
    if (diff < 120) return "healthy"
    if (diff < 300) return "warning"
    return "offline"
  }

  const scraperStatus = getScraperStatus()

  const getTimeText = () => {
    if (!scraperHeartbeat) return ""
    const diff = Math.max(0, Math.floor((Date.now() - new Date(scraperHeartbeat).getTime()) / 1000))
    if (diff < 60) return `há ${diff}s`
    return `há ${Math.floor(diff / 60)}m`
  }

  const summaryBadges = {
    pending: scraperJobs.filter(j => j.status === "pending").length,
    inProgress: scraperJobs.filter(j => ["downloading_file", "uploading_vault", "indexing"].includes(j.status)).length,
    failed: scraperJobs.filter(j => j.status === "failed").length,
    completed: scraperJobs.filter(j => j.status === "completed").length,
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "downloading_file": return "Baixando"
      case "uploading_vault": return "Salvando"
      case "indexing": return "Indexando"
      case "completed": return "Concluído"
      case "failed": return "Falhou"
      case "pending": return "Na Fila"
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "downloading_file": return "bg-blue-500/10 border-blue-500/20 text-blue-400"
      case "uploading_vault": return "bg-purple-500/10 border-purple-500/20 text-purple-400"
      case "indexing": return "bg-amber-500/10 border-amber-500/20 text-amber-400"
      case "completed": return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      case "failed": return "bg-rose-500/10 border-rose-500/20 text-rose-400"
      default: return "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
    }
  }

  const handleApproveJob = useCallback(async (jobId: string) => {
    setActingJobId(jobId)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada")
      const res = await fetch("/api/telegram/jobs", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", jobId })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erro ${res.status}`)
      }
      await fetchJobs()
    } catch (err: any) {
      alert(`Erro ao aprovar: ${err.message}`)
    } finally {
      setActingJobId(null)
    }
  }, [fetchJobs])

  const handleRejectJob = useCallback(async (jobId: string) => {
    setActingJobId(jobId)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada")
      const res = await fetch("/api/telegram/jobs", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", jobId })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erro ${res.status}`)
      }
      await fetchJobs()
    } catch (err: any) {
      alert(`Erro ao rejeitar: ${err.message}`)
    } finally {
      setActingJobId(null)
    }
  }, [fetchJobs])

  const handleBanPhotos = useCallback(async () => {
    if (selectedBans.length === 0) return
    if (!confirm(`Banir ${selectedBans.length} imagem(ns)?`)) return
    setIsBanningPhotos(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada")

      const { getPerceptualHash } = await import("@/lib/imageHash")

      for (const key of selectedBans) {
        const pipeIdx = key.indexOf("|")
        const url = key.slice(pipeIdx + 1)
        try {
          const hash = await getPerceptualHash(url)
          await fetch("/api/telegram/banned-images", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ image_hash: hash, image_url: url })
          })
        } catch (err) {
          console.error("Erro ao banir imagem:", err)
        }
      }
      persistDismissed([...dismissedPhotos, ...selectedBans])
      setSelectedBans([])
      alert("Fotos banidas com sucesso!")
    } catch (err: any) {
      alert(`Erro ao banir: ${err.message}`)
    } finally {
      setIsBanningPhotos(false)
    }
  }, [selectedBans, dismissedPhotos])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          {/* Status Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-foreground">Status do Scraper</h3>
              <button
                onClick={() => { fetchJobs(); fetchSettings() }}
                className="p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                aria-label="Atualizar"
              >
                <RefreshCw size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full shrink-0 ${
                scraperStatus === "healthy" ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"
                : scraperStatus === "warning" ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
                : scraperStatus === "offline" ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                : "bg-zinc-500"
              }`} />
              <p className={`text-sm font-bold ${
                scraperStatus === "healthy" ? "text-emerald-400"
                : scraperStatus === "warning" ? "text-amber-400"
                : scraperStatus === "offline" ? "text-rose-400"
                : "text-zinc-400"
              }`}>
                {scraperStatus === "healthy" && `Servidor Ativo (${getTimeText()})`}
                {scraperStatus === "warning" && `Instável (${getTimeText()})`}
                {scraperStatus === "offline" && `Fora do Ar (${getTimeText()})`}
                {scraperStatus === "unknown" && "Status Desconhecido"}
              </p>
            </div>
          </div>

          {/* Summary Badges */}
          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">{summaryBadges.pending} pendentes</div>
            <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">{summaryBadges.inProgress} em progresso</div>
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">{summaryBadges.failed} falhas</div>
            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">{summaryBadges.completed} completados</div>
          </div>

          {/* Jobs em Progresso */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-sm text-foreground mb-3">Em Progresso</h3>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {scraperJobs
                .filter(j => ["pending", "downloading_file", "uploading_vault", "indexing"].includes(j.status))
                .slice(0, 10)
                .map(job => (
                  <div key={job.id} className={`p-3 rounded-lg border text-xs ${getStatusColor(job.status)}`}>
                    <div className="font-mono truncate mb-1">{job.file_name}</div>
                    <div className="flex items-center justify-between">
                      <span>{getStatusLabel(job.status)}</span>
                      {typeof job.progress === "number" && job.progress > 0 && (
                        <span className="font-bold">{job.progress}%</span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-70 mt-1 truncate">{job.chat_title}</div>
                  </div>
                ))}
              {scraperJobs.filter(j => ["pending", "downloading_file", "uploading_vault", "indexing"].includes(j.status)).length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhum job em progresso</p>
              )}
            </div>
          </div>

          {/* Histórico Recente */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-sm text-foreground mb-3">Histórico Recente</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {scraperJobs
                .filter(j => ["completed", "failed"].includes(j.status))
                .slice(0, 5)
                .map(job => (
                  <div key={job.id} className="p-2 rounded-lg border border-border bg-muted/20 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono truncate flex-1">{job.file_name}</span>
                      <span className={`ml-2 shrink-0 font-bold ${job.status === "completed" ? "text-emerald-400" : "text-rose-400"}`}>
                        {job.status === "completed" ? "✅" : "❌"}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(job.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              {scraperJobs.filter(j => ["completed", "failed"].includes(j.status)).length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhum histórico recente</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="bg-card border border-border rounded-xl p-1 flex gap-1">
            {([
              { key: "approvals" as const, label: "Fila de Aprovação" },
              { key: "photos" as const, label: "Moderação de Fotos" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">

            {/* APPROVALS TAB */}
            {activeTab === "approvals" && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Arquivos Aguardando Aprovação</h3>
                  <p className="text-xs text-muted-foreground">
                    Arquivos acima do limite de {scraperSettings?.size_limit_mb || 750} MB
                  </p>
                </div>

                {(() => {
                  const pendingJobs = scraperJobs.filter(j => j.status === "pending_approval")
                  if (pendingJobs.length === 0) {
                    return (
                      <div className="p-8 text-center text-sm border border-dashed border-border bg-muted/20 rounded-2xl text-muted-foreground">
                        Nenhum arquivo aguardando aprovação no momento.
                      </div>
                    )
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pendingJobs.map(job => {
                        const hasPhotos = job.photos && job.photos.length > 0
                        const thumbUrl = hasPhotos ? job.photos[0] : null
                        const formattedSize = job.file_size_bytes
                          ? `${(job.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : "---"

                        return (
                          <div key={job.id} className="group relative bg-muted border border-border rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col shadow-sm">
                            <div className="relative aspect-video w-full bg-muted/50 overflow-hidden">
                              {thumbUrl ? (
                                <img src={thumbUrl} alt={job.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-bold uppercase opacity-50">
                                  Sem Foto
                                </div>
                              )}
                              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-amber-400">
                                {formattedSize}
                              </div>
                              <button
                                onClick={() => { setSelectedJobDetails(job); setActivePhotoIndex(0) }}
                                className="absolute inset-0 z-10 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm cursor-pointer"
                              >
                                Ver Detalhes {hasPhotos && `(${job.photos.length})`}
                              </button>
                            </div>
                            <div className="p-5 flex flex-col gap-4">
                              <div>
                                <h4 className="font-bold text-sm text-foreground line-clamp-2 mb-1">{job.file_name}</h4>
                                <div className="text-[11px] text-muted-foreground space-y-0.5">
                                  <div>Origem: <span className="font-medium text-foreground">{job.chat_title}</span></div>
                                  <div>{new Date(job.created_at).toLocaleString("pt-BR")}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => handleApproveJob(job.id)}
                                  disabled={actingJobId === job.id}
                                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  {actingJobId === job.id ? <Loader2 size={12} className="animate-spin" /> : "✅"} Aprovar
                                </button>
                                <button
                                  onClick={() => handleRejectJob(job.id)}
                                  disabled={actingJobId === job.id}
                                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  ❌ Rejeitar
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* PHOTOS TAB */}
            {activeTab === "photos" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Moderação de Fotos</h3>
                  <p className="text-xs text-muted-foreground">Selecione fotos indesejadas e bana para a blacklist</p>
                </div>

                {(() => {
                  const seen = new Set<string>()
                  let allPhotos: { jobId: string; url: string; jobTitle: string }[] = []
                  scraperJobs.forEach(job => {
                    (job.photos || []).forEach((url: string) => {
                      const key = `${job.id}|${url}`
                      if (!seen.has(key)) {
                        seen.add(key)
                        allPhotos.push({ jobId: job.id, url, jobTitle: job.file_name })
                      }
                    })
                  })
                  allPhotos = allPhotos.filter(p => !dismissedPhotos.includes(`${p.jobId}|${p.url}`))

                  if (allPhotos.length === 0) {
                    return (
                      <div className="p-8 text-center text-sm border border-dashed border-border bg-muted/20 rounded-2xl text-muted-foreground">
                        Nenhuma foto aguardando moderação.
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedBans(
                            selectedBans.length === allPhotos.length ? [] : allPhotos.map(p => `${p.jobId}|${p.url}`)
                          )}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[11px] font-bold rounded-lg border border-border cursor-pointer"
                        >
                          {selectedBans.length === allPhotos.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </button>
                        {selectedBans.length > 0 && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { persistDismissed([...dismissedPhotos, ...selectedBans]); setSelectedBans([]) }}
                              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Ignorar ({selectedBans.length})
                            </button>
                            <button
                              onClick={handleBanPhotos}
                              disabled={isBanningPhotos}
                              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
                            >
                              {isBanningPhotos ? <Loader2 size={14} className="animate-spin" /> : "🚫"}
                              Banir ({selectedBans.length})
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                        {allPhotos.map((p, idx) => {
                          const key = `${p.jobId}|${p.url}`
                          const isSelected = selectedBans.includes(key)
                          return (
                            <div
                              key={`${p.jobId}-${idx}`}
                              onClick={() => setSelectedBans(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                              className={`group relative aspect-square rounded-xl overflow-hidden bg-muted border-2 cursor-pointer transition-all ${
                                isSelected ? "border-red-500 scale-95" : "border-border hover:border-red-500/50"
                              }`}
                            >
                              <img
                                src={p.url}
                                alt={p.jobTitle}
                                className={`w-full h-full object-cover ${isSelected ? "opacity-80" : ""}`}
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none"
                                  const el = document.createElement("span")
                                  el.className = "text-xs text-red-400 font-bold p-2 text-center"
                                  el.innerText = "Foto Expirada"
                                  e.currentTarget.parentElement?.classList.add("flex", "items-center", "justify-center", "bg-red-500/10")
                                  e.currentTarget.parentElement?.appendChild(el)
                                }}
                              />
                              <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                                isSelected ? "bg-red-500 border-red-500 text-white" : "bg-black/50 border-white/50 opacity-0 group-hover:opacity-100"
                              }`}>
                                {isSelected && "✓"}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Job Details Modal Portal */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedJobDetails && (
            <div key="job-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setSelectedJobDetails(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              >
                {/* Left: Gallery */}
                <div className="w-full md:w-3/5 bg-muted/50 relative flex items-center justify-center min-h-[300px]">
                  {selectedJobDetails.photos?.length > 0 ? (
                    <>
                      <img
                        src={selectedJobDetails.photos[activePhotoIndex]}
                        alt={`Foto ${activePhotoIndex + 1}`}
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                      {selectedJobDetails.photos.length > 1 && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); setActivePhotoIndex(p => p > 0 ? p - 1 : selectedJobDetails.photos.length - 1) }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 cursor-pointer"
                          >❮</button>
                          <button
                            onClick={e => { e.stopPropagation(); setActivePhotoIndex(p => p < selectedJobDetails.photos.length - 1 ? p + 1 : 0) }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 cursor-pointer"
                          >❯</button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-full bg-black/30">
                            {selectedJobDetails.photos.map((_: any, idx: number) => (
                              <button key={idx} onClick={e => { e.stopPropagation(); setActivePhotoIndex(idx) }}
                                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === activePhotoIndex ? "bg-white scale-125" : "bg-white/50"}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <span className="text-sm">Nenhuma foto disponível</span>
                    </div>
                  )}
                </div>

                {/* Right: Info */}
                <div className="w-full md:w-2/5 p-6 flex flex-col bg-card">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-foreground">Detalhes do Arquivo</h3>
                    <button onClick={() => setSelectedJobDetails(null)} className="p-1 rounded-md text-muted-foreground hover:bg-muted cursor-pointer">✕</button>
                  </div>
                  <div className="space-y-5 flex-1 overflow-y-auto">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Nome Original</p>
                      <p className="text-sm font-medium break-all">{selectedJobDetails.file_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Origem</p>
                      <p className="text-sm">{selectedJobDetails.chat_title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Tamanho</p>
                        <p className="text-sm font-mono">
                          {selectedJobDetails.file_size_bytes
                            ? `${(selectedJobDetails.file_size_bytes / (1024 ** 3)).toFixed(2)} GB`
                            : "---"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Fotos</p>
                        <p className="text-sm">{selectedJobDetails.photos?.length || 0}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Criado em</p>
                      <p className="text-sm">{new Date(selectedJobDetails.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-border mt-6 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { handleApproveJob(selectedJobDetails.id); setSelectedJobDetails(null) }}
                      disabled={actingJobId !== null}
                      className="py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      ✅ Aprovar
                    </button>
                    <button
                      onClick={() => { handleRejectJob(selectedJobDetails.id); setSelectedJobDetails(null) }}
                      disabled={actingJobId !== null}
                      className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      ❌ Rejeitar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
