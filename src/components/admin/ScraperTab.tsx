"use client"

import React, { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { getSupabaseBrowser } from "@/lib/supabase"
import {
  ShieldAlert, Settings, RefreshCw, Download, AlertTriangle,
  Check, Loader2, X, ImageIcon, Plus, Upload, ChevronLeft, ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { getPerceptualHash, hammingDistance } from "@/lib/imageHash"

interface ScraperTabProps {
  onHeartbeatChange: (heartbeat: string | null) => void
}

export function ScraperTab({ onHeartbeatChange }: ScraperTabProps) {
  const [scraperJobs, setScraperJobs] = useState<any[]>([])
  const [scraperError, setScraperError] = useState<string | null>(null)
  const [actingJobId, setActingJobId] = useState<string | null>(null)
  const [scraperSubTab, setScraperSubTab] = useState<"moderation" | "queue" | "config">("moderation")
  const [showAllPending, setShowAllPending] = useState(false)
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [scraperStatusFilter, setScraperStatusFilter] = useState<string>("all")
  const [selectedBans, setSelectedBans] = useState<string[]>([])
  const [dismissedPhotos, setDismissedPhotosState] = useState<string[]>([])
  const [scraperGroupsConfig, setScraperGroupsConfig] = useState<{ id: string; type: string }[]>([])
  const [scraperSizeLimit, setScraperSizeLimit] = useState<number>(750)
  const [scraperHeartbeat, setScraperHeartbeatLocal] = useState<string | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)
  const [backfillHoursBack, setBackfillHoursBack] = useState<number>(24)
  const [isRunningBackfill, setIsRunningBackfill] = useState<boolean>(false)
  const [backfillResult, setBackfillResult] = useState<{ ok: boolean; message: string; cutoff_date?: string } | null>(null)
  const [isUploadingJobPhoto, setIsUploadingJobPhoto] = useState(false)
  const [isBanningPhoto, setIsBanningPhoto] = useState(false)

  const updateHeartbeat = useCallback((hb: string | null) => {
    setScraperHeartbeatLocal(hb)
    onHeartbeatChange(hb)
  }, [onHeartbeatChange])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dismissedAdminPhotos")
      if (saved) {
        try { setDismissedPhotosState(JSON.parse(saved)) } catch {}
      }
    }
  }, [])

  const setDismissedPhotos = (updater: any) => {
    setDismissedPhotosState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater
      if (typeof window !== "undefined") {
        localStorage.setItem("dismissedAdminPhotos", JSON.stringify(next))
      }
      return next
    })
  }

  const fetchScraperSettings = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_scraper_settings")
        .select("*")
        .eq("id", "default")
        .single()
      if (!error && data) {
        setScraperGroupsConfig(data.groups_config || [])
        setScraperSizeLimit(data.size_limit_mb)
        updateHeartbeat(data.last_heartbeat || null)
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do scraper:", err)
    }
  }, [updateHeartbeat])

  const fetchScraperJobs = useCallback(async () => {
    try {
      setScraperError(null)
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("telegram_scraper_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300)
      if (error) throw error

      const jobs = data || []
      setScraperJobs(jobs)

      const checkAndFilterBanned = async (currentJobs: any[]) => {
        try {
          const res = await fetch("/api/telegram/banned-images")
          if (!res.ok) return
          const { banned_hashes } = await res.json()
          if (!banned_hashes || banned_hashes.length === 0) return

          const pendingWithPhotos = currentJobs.filter(j => j.status === "pending_approval" && j.photos?.length > 0)
          if (pendingWithPhotos.length === 0) return

          let hasModifications = false
          const updatedJobs = [...currentJobs]

          for (const job of pendingWithPhotos) {
            let jobModified = false
            const validPhotos: string[] = []
            for (const url of job.photos) {
              try {
                const hash = await getPerceptualHash(url)
                const isBanned = banned_hashes.some((banned: string) => hammingDistance(hash, banned) <= 10)
                if (!isBanned) {
                  validPhotos.push(url)
                } else {
                  jobModified = true
                  hasModifications = true
                }
              } catch {
                validPhotos.push(url)
              }
            }
            if (jobModified) {
              const idx = updatedJobs.findIndex(j => j.id === job.id)
              if (idx > -1) {
                updatedJobs[idx] = { ...updatedJobs[idx], photos: validPhotos }
                await supabase.from("telegram_scraper_jobs").update({ photos: validPhotos }).eq("id", job.id)
              }
            }
          }
          if (hasModifications) setScraperJobs(updatedJobs)
        } catch (err) {
          console.error("Erro no auto-filtro:", err)
        }
      }
      checkAndFilterBanned(jobs)
    } catch (err: any) {
      setScraperError(err.message || "Erro desconhecido")
    }
  }, [])

  useEffect(() => {
    fetchScraperJobs()
    fetchScraperSettings()

    const supabase = getSupabaseBrowser()

    const channel = supabase
      .channel("scraper-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "telegram_scraper_jobs" },
        () => { fetchScraperJobs() }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "telegram_scraper_settings" },
        () => { fetchScraperSettings() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchScraperJobs, fetchScraperSettings])

  // Poll progress for downloading jobs
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
              const jobIndex = newJobs.findIndex(j => j.id === job.id)
              if (jobIndex > -1) {
                newJobs[jobIndex] = { ...newJobs[jobIndex], progress: data.progress }
                updated = true
              }
            }
          }
        } catch {}
      }
      if (updated) setScraperJobs(newJobs)
    }, 3000)
    return () => clearInterval(interval)
  }, [scraperJobs])

  const getScraperStatus = () => {
    if (!scraperHeartbeat) return "unknown"
    const diff = (Date.now() - new Date(scraperHeartbeat).getTime()) / 1000
    if (diff < 120) return "healthy"
    if (diff < 300) return "warning"
    return "offline"
  }

  const scraperStatus = getScraperStatus()

  const handleSaveScraperSettings = async () => {
    try {
      setIsSavingSettings(true)
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("telegram_scraper_settings")
        .update({ groups_config: scraperGroupsConfig, size_limit_mb: scraperSizeLimit, updated_at: new Date().toISOString() })
        .eq("id", "default")
      if (error) throw error
      alert("Configurações do scraper salvas com sucesso!")
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message || err}`)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleRunBackfill = async () => {
    setIsRunningBackfill(true)
    setBackfillResult(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada.")
      const res = await fetch("/api/telegram/backfill", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hours_back: backfillHoursBack }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setBackfillResult({ ok: true, message: data.message, cutoff_date: data.cutoff_date })
    } catch (err: any) {
      setBackfillResult({ ok: false, message: err.message || "Erro desconhecido." })
    } finally {
      setIsRunningBackfill(false)
    }
  }

  const handleJobAction = async (jobId: string, action: "approve" | "reject" | "cancel" | "retry") => {
    setActingJobId(jobId)
    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("Sessão não encontrada.")
      const res = await fetch("/api/telegram/jobs", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, jobId })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Erro do servidor (${res.status})`)
      }
      await fetchScraperJobs()
    } catch (err: any) {
      alert(`Falha ao realizar ação: ${err.message}`)
    } finally {
      setActingJobId(null)
    }
  }

  const handleRemoveJobPhoto = async (jobId: string, photoIndex: number) => {
    try {
      const job = scraperJobs.find(j => j.id === jobId)
      if (!job?.photos) return
      const newPhotos = [...job.photos]
      newPhotos.splice(photoIndex, 1)
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.from("telegram_scraper_jobs").update({ photos: newPhotos }).eq("id", jobId)
      if (error) throw error
      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: newPhotos } : j))
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: newPhotos })
        if (activePhotoIndex >= newPhotos.length) setActivePhotoIndex(Math.max(0, newPhotos.length - 1))
      }
    } catch (err) {
      alert("Erro ao remover a foto.")
    }
  }

  const handleAddJobPhotoUrl = async (jobId: string) => {
    const url = prompt("Digite a URL da imagem:")
    if (!url?.trim()) return
    try {
      const job = scraperJobs.find(j => j.id === jobId)
      if (!job) return
      const updatedPhotos = [...(job.photos || []), url.trim()]
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.from("telegram_scraper_jobs").update({ photos: updatedPhotos }).eq("id", jobId)
      if (error) throw error
      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: updatedPhotos } : j))
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: updatedPhotos })
        setActivePhotoIndex(updatedPhotos.length - 1)
      }
    } catch (err: any) {
      alert(err.message || "Falha ao adicionar URL.")
    }
  }

  const handleUploadJobPhotoFile = async (jobId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setIsUploadingJobPhoto(true)
      const supabase = getSupabaseBrowser()
      const fileExt = file.name.split(".").pop()
      const filePath = `telegram/manual_job/${jobId}/${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage.from("portfolio").upload(filePath, file)
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(filePath)
      const job = scraperJobs.find(j => j.id === jobId)
      if (!job) return
      const updatedPhotos = [...(job.photos || []), publicUrl]
      const { error: dbErr } = await supabase.from("telegram_scraper_jobs").update({ photos: updatedPhotos }).eq("id", jobId)
      if (dbErr) throw dbErr
      setScraperJobs(prev => prev.map(j => j.id === jobId ? { ...j, photos: updatedPhotos } : j))
      if (selectedJobDetails?.id === jobId) {
        setSelectedJobDetails({ ...selectedJobDetails, photos: updatedPhotos })
        setActivePhotoIndex(updatedPhotos.length - 1)
      }
    } catch (err: any) {
      alert(err.message || "Falha ao fazer upload.")
    } finally {
      setIsUploadingJobPhoto(false)
    }
  }

  const toggleBanSelection = (jobId: string, url: string) => {
    const key = `${jobId}|${url}`
    setSelectedBans(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleBanMultiplePhotos = async () => {
    if (selectedBans.length === 0) return
    if (!confirm(`Tem certeza que deseja banir ${selectedBans.length} imagem(ns)?`)) return
    try {
      setIsBanningPhoto(true)
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const payload = await Promise.all(selectedBans.map(async (key) => {
        const lastPipe = key.lastIndexOf("|")
        const jobId = key.substring(0, lastPipe)
        const url = key.substring(lastPipe + 1)
        const hash = await getPerceptualHash(url)
        return { jobId, url, hash }
      }))

      for (const item of payload) {
        const res = await fetch("/api/telegram/banned-images", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ image_hash: item.hash, image_url: item.url })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(`Erro ao banir imagem: ${errData.error || res.statusText}`)
        }
      }

      const urlsByJob: Record<string, string[]> = {}
      payload.forEach(item => {
        if (!urlsByJob[item.jobId]) urlsByJob[item.jobId] = []
        urlsByJob[item.jobId].push(item.url)
      })

      const updatedJobs = [...scraperJobs]
      for (const jobId of Object.keys(urlsByJob)) {
        const urlsToRemove = urlsByJob[jobId]
        const jobIndex = updatedJobs.findIndex(j => j.id === jobId)
        if (jobIndex > -1) {
          const job = updatedJobs[jobIndex]
          const newPhotos = job.photos.filter((p: string) => !urlsToRemove.includes(p))
          updatedJobs[jobIndex] = { ...job, photos: newPhotos }
          await supabase.from("telegram_scraper_jobs").update({ photos: newPhotos }).eq("id", jobId)
        }
      }
      setScraperJobs(updatedJobs)
      setSelectedBans([])
      alert("Fotos banidas com sucesso!")
    } catch (err: any) {
      alert("Erro ao banir fotos: " + err.message)
    } finally {
      setIsBanningPhoto(false)
    }
  }

  const timeText = scraperHeartbeat
    ? (() => {
        const diff = Math.max(0, Math.floor((Date.now() - new Date(scraperHeartbeat).getTime()) / 1000))
        if (diff < 60) return `há ${diff}s`
        return `há ${Math.floor(diff / 60)}m`
      })()
    : ""

  const pendingJobs = scraperJobs.filter(j => j.status === "pending_approval")

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Scraper Sub-Tabs */}
      <div className="bg-card border border-border rounded-xl p-1 flex gap-1">
        {([
          { key: "moderation" as const, label: "Aprovações e Moderação" },
          { key: "queue" as const, label: "Fila e Histórico" },
          { key: "config" as const, label: "Configurações" },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setScraperSubTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              scraperSubTab === tab.key
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB: MODERAÇÃO */}
      <div className={scraperSubTab !== "moderation" ? "hidden" : "space-y-6"}>

        {/* SECTION 1: PENDING APPROVALS */}
        {(() => {
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Fila de Aprovação (Arquivos &gt; {scraperSizeLimit} MB)</h3>
                  <p className="text-xs text-muted-foreground">
                    Estes arquivos excederam o limite automático de {scraperSizeLimit} MB e requerem aprovação manual.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
                  {pendingJobs.length} pendentes
                </span>
              </div>

              {pendingJobs.length === 0 ? (
                <div className="p-8 text-center text-sm border border-dashed border-border bg-card/20 rounded-2xl text-muted-foreground">
                  Nenhum arquivo aguardando aprovação no momento.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(showAllPending ? pendingJobs : pendingJobs.slice(0, 3)).map((job) => {
                      const formattedSize = job.file_size_bytes
                        ? `${(job.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                        : "---"
                      const hasPhotos = job.photos && job.photos.length > 0
                      const dbThumb = job.thumbnail_url?.includes("unsplash") ? "" : job.thumbnail_url
                      const thumbUrl = hasPhotos ? job.photos[0] : dbThumb

                      return (
                        <div key={job.id} className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-md">
                          <div className="relative aspect-video w-full bg-muted overflow-hidden">
                            {thumbUrl ? (
                              <img src={thumbUrl} alt={job.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground group-hover:scale-105 transition-transform duration-500">
                                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs font-bold uppercase tracking-wider opacity-50">Sem Foto</span>
                              </div>
                            )}
                            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/30">
                              {formattedSize}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedJobDetails(job); setActivePhotoIndex(0) }}
                              className="absolute inset-0 z-10 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm cursor-pointer"
                            >
                              Ver Detalhes {hasPhotos && `(${job.photos.length} foto${job.photos.length > 1 ? "s" : ""})`}
                            </button>
                          </div>
                          <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                            <div className="space-y-2">
                              <h4 className="font-bold text-sm text-foreground line-clamp-2" title={job.file_name}>{job.file_name}</h4>
                              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                                <div>Origem: <span className="font-medium text-foreground">{job.chat_title}</span></div>
                                <div>Postado em: <span>{new Date(job.created_at).toLocaleString("pt-BR")}</span></div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <button
                                onClick={() => handleJobAction(job.id, "approve")}
                                disabled={actingJobId !== null}
                                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                              >
                                {actingJobId === job.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleJobAction(job.id, "reject")}
                                disabled={actingJobId !== null}
                                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                Rejeitar
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {!showAllPending && pendingJobs.length > 3 && (
                    <div className="flex justify-center pt-2">
                      <button onClick={() => setShowAllPending(true)} className="px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors cursor-pointer">
                        Ver Mais ({pendingJobs.length - 3} restantes)
                      </button>
                    </div>
                  )}
                  {showAllPending && pendingJobs.length > 3 && (
                    <div className="flex justify-center pt-2">
                      <button onClick={() => setShowAllPending(false)} className="px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors cursor-pointer">
                        Mostrar Menos
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* SECTION 1.5: MODERAÇÃO DE FOTOS */}
        {(() => {
          let allPhotos: { jobId: string; url: string; index: number; jobTitle: string }[] = []
          const seen = new Set<string>()
          scraperJobs.forEach(job => {
            if (job.photos?.length > 0) {
              job.photos.forEach((url: string, index: number) => {
                const key = `${job.id}|${url}`
                if (!seen.has(key)) {
                  seen.add(key)
                  allPhotos.push({ jobId: job.id, url, index, jobTitle: job.file_name })
                }
              })
            }
          })
          allPhotos = allPhotos.filter(p => !dismissedPhotos.includes(`${p.jobId}|${p.url}`))
          if (allPhotos.length === 0) return null

          return (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4 mt-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Moderação Rápida de Propagandas</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold font-mono">
                  {allPhotos.length} fotos aguardando revisão
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione fotos indesejadas e clique em banir. Elas serão removidas e adicionadas à Blacklist.
              </p>
              <div className="flex justify-between items-center pb-2">
                <button
                  onClick={() => setSelectedBans(selectedBans.length === allPhotos.length ? [] : allPhotos.map(p => `${p.jobId}|${p.url}`))}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[11px] font-bold rounded-lg transition-colors cursor-pointer border border-border"
                >
                  {selectedBans.length === allPhotos.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </button>
                {selectedBans.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setDismissedPhotos((prev: string[]) => [...prev, ...selectedBans]); setSelectedBans([]) }}
                      className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer animate-in slide-in-from-bottom-2"
                    >
                      Ignorar / Ocultar ({selectedBans.length})
                    </button>
                    <button
                      onClick={handleBanMultiplePhotos}
                      disabled={isBanningPhoto}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 animate-in slide-in-from-bottom-2"
                    >
                      {isBanningPhoto ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                      Banir {selectedBans.length} selecionada(s)
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {allPhotos.map((photoObj, idx) => {
                  const isSelected = selectedBans.includes(`${photoObj.jobId}|${photoObj.url}`)
                  return (
                    <div
                      key={`${photoObj.jobId}-${idx}`}
                      onClick={() => toggleBanSelection(photoObj.jobId, photoObj.url)}
                      className={`group relative aspect-square rounded-xl overflow-hidden bg-muted border-2 cursor-pointer transition-all duration-200 ${isSelected ? "border-red-500 scale-95 shadow-inner" : "border-border shadow-sm hover:border-red-500/50"}`}
                    >
                      <img
                        src={photoObj.url}
                        alt={photoObj.jobTitle}
                        className={`w-full h-full object-cover transition-all ${isSelected ? "opacity-80" : ""}`}
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                          e.currentTarget.parentElement?.classList.add("flex", "items-center", "justify-center", "bg-red-500/10")
                          const span = document.createElement("span")
                          span.className = "text-xs text-red-400 font-bold p-2 text-center"
                          span.innerText = "Foto Expirada"
                          e.currentTarget.parentElement?.appendChild(span)
                        }}
                      />
                      <div className="absolute top-2 right-2 z-10">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? "bg-red-500 border-red-500 text-white" : "bg-black/50 border-white/50 text-transparent opacity-0 group-hover:opacity-100"}`}>
                          <Check size={14} className={isSelected ? "block" : "hidden group-hover:block opacity-50"} />
                        </div>
                      </div>
                      {!isSelected && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                          <span className="w-full py-1.5 bg-black/80 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1">Selecionar</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>{/* end moderation sub-tab */}

      {/* SUB-TAB: CONFIGURAÇÕES */}
      <div className={scraperSubTab !== "config" ? "hidden" : "space-y-6"}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Configurações do Monitoramento</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Limite de Aprovação Automática (MB)</label>
              <input
                type="number"
                value={scraperSizeLimit}
                onChange={(e) => setScraperSizeLimit(Number(e.target.value))}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ex: 750"
              />
              <p className="text-[10px] text-muted-foreground">Arquivos maiores precisarão de aprovação manual.</p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                <span>Canais e Grupos Monitorados</span>
                <button onClick={() => setScraperGroupsConfig([...scraperGroupsConfig, { id: "", type: "fdm" }])} className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] rounded">+ Adicionar</button>
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {scraperGroupsConfig.length === 0 && <p className="text-[10px] text-muted-foreground italic py-2">Nenhum grupo configurado.</p>}
                {scraperGroupsConfig.map((group, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={group.id}
                      onChange={(e) => {
                        const newGroups = [...scraperGroupsConfig]
                        newGroups[index].id = e.target.value
                        setScraperGroupsConfig(newGroups)
                      }}
                      className="flex-1 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                      placeholder="Ex: LB Creative STls ou -100..."
                    />
                    <select
                      value={group.type}
                      onChange={(e) => {
                        const newGroups = [...scraperGroupsConfig]
                        newGroups[index].type = e.target.value
                        setScraperGroupsConfig(newGroups)
                      }}
                      className="w-24 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="fdm">FDM</option>
                      <option value="resin">Resina</option>
                      <option value="all">Ambos</option>
                    </select>
                    <button
                      onClick={() => { const g = [...scraperGroupsConfig]; g.splice(index, 1); setScraperGroupsConfig(g) }}
                      className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Aceita títulos exatos, usernames públicos ou IDs numéricos do Telegram.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveScraperSettings}
              disabled={isSavingSettings}
              className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar Configurações
            </button>
          </div>
        </div>
      </div>{/* end config sub-tab */}

      {/* SUB-TAB: FILA E HISTÓRICO */}
      <div className={scraperSubTab !== "queue" ? "hidden" : "space-y-4"}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-base">Fila e Histórico do Scraper</h3>
              <p className="text-xs text-muted-foreground mt-1">Status de todos os downloads e indexações.</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {(() => {
                if (scraperStatus === "healthy") return (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                    <span>Servidor Ativo ({timeText})</span>
                  </div>
                )
                if (scraperStatus === "warning") return (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                    <span>Instável ({timeText})</span>
                  </div>
                )
                if (scraperStatus === "offline") return (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                    <span>Fora do Ar ({timeText})</span>
                  </div>
                )
                return (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-zinc-500" />
                    <span>Status Desconhecido</span>
                  </div>
                )
              })()}
              <button
                onClick={() => { fetchScraperJobs(); fetchScraperSettings() }}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/25 transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
                Atualizar Status
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          {(() => {
            const validJobs = scraperJobs.filter(j => j.status !== "pending_approval")
            const counts = {
              all: validJobs.length,
              pending: validJobs.filter(j => j.status === "pending").length,
              downloading_file: validJobs.filter(j => j.status === "downloading_file").length,
              uploading_vault: validJobs.filter(j => j.status === "uploading_vault").length,
              indexing: validJobs.filter(j => j.status === "indexing").length,
              completed: validJobs.filter(j => j.status === "completed").length,
              failed: validJobs.filter(j => j.status === "failed").length,
            }
            const filterOptions = [
              { id: "all", label: "Todos", count: counts.all, selectedClasses: "bg-zinc-500/20 border-zinc-500/50 text-zinc-300 ring-1 ring-zinc-500/50", hoverClasses: "hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-300", badgeSelected: "bg-zinc-500/40 text-zinc-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "pending", label: "⏳ Na Fila", count: counts.pending, selectedClasses: "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/50", hoverClasses: "hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400", badgeSelected: "bg-indigo-500/40 text-indigo-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "downloading_file", label: "⬇️ Baixando", count: counts.downloading_file, selectedClasses: "bg-blue-500/20 border-blue-500/50 text-blue-400 ring-1 ring-blue-500/50", hoverClasses: "hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400", badgeSelected: "bg-blue-500/40 text-blue-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "uploading_vault", label: "☁️ Salvando", count: counts.uploading_vault, selectedClasses: "bg-purple-500/20 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/50", hoverClasses: "hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-400", badgeSelected: "bg-purple-500/40 text-purple-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "indexing", label: "🔍 Indexando", count: counts.indexing, selectedClasses: "bg-amber-500/20 border-amber-500/50 text-amber-400 ring-1 ring-amber-500/50", hoverClasses: "hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400", badgeSelected: "bg-amber-500/40 text-amber-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "completed", label: "✅ Concluído", count: counts.completed, selectedClasses: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/50", hoverClasses: "hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400", badgeSelected: "bg-emerald-500/40 text-emerald-200", badgeUnselected: "bg-muted text-muted-foreground" },
              { id: "failed", label: "❌ Falhou", count: counts.failed, selectedClasses: "bg-rose-500/20 border-rose-500/50 text-rose-400 ring-1 ring-rose-500/50", hoverClasses: "hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400", badgeSelected: "bg-rose-500/40 text-rose-200", badgeUnselected: "bg-muted text-muted-foreground" },
            ]
            return (
              <div className="p-4 border-b border-border bg-muted/10 flex flex-col gap-3">
                <span className="text-muted-foreground font-bold text-sm">Filtro Rápido de Status:</span>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map(opt => {
                    const isSelected = scraperStatusFilter === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { setScraperStatusFilter(opt.id); setHistoryPage(1) }}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${isSelected ? opt.selectedClasses : `bg-card border-border text-muted-foreground ${opt.hoverClasses}`}`}
                      >
                        {opt.label}
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-colors ${isSelected ? opt.badgeSelected : opt.badgeUnselected}`}>{opt.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="overflow-x-auto">
            {scraperError ? (
              <div className="p-12 text-center text-sm text-red-400 border border-red-500/20 bg-red-500/5 m-6 rounded-xl">
                Falha ao carregar registros: {scraperError}
              </div>
            ) : (() => {
              const historyJobs = scraperJobs.filter(j => {
                if (j.status === "pending_approval") return false
                if (scraperStatusFilter !== "all" && j.status !== scraperStatusFilter) return false
                return true
              })
              if (historyJobs.length === 0) {
                return (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    {scraperStatusFilter !== "all" ? "Nenhum processo encontrado com este filtro." : "Nenhum processo registrado no histórico recentemente."}
                  </div>
                )
              }
              const ITEMS_PER_PAGE = 10
              const totalHistoryPages = Math.ceil(historyJobs.length / ITEMS_PER_PAGE)
              const paginatedJobs = historyJobs.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE)

              return (
                <>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                        <th className="px-6 py-4">Arquivo</th>
                        <th className="px-6 py-4">Canal / Grupo</th>
                        <th className="px-6 py-4">Tamanho</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Atualizado Em</th>
                        <th className="px-6 py-4">Ação / Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedJobs.map((job) => {
                        const dateFormatted = new Date(job.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                        let statusText = job.status
                        let statusColor = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        switch (job.status) {
                          case "downloading_file": statusText = "Baixando STL"; statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20"; break
                          case "uploading_vault": statusText = "Salvando no Vault"; statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20"; break
                          case "indexing": statusText = "Indexando no Banco"; statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20"; break
                          case "completed": statusText = "Concluído"; statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"; break
                          case "failed": statusText = "Falhou"; statusColor = "bg-rose-500/10 text-rose-400 border-rose-500/20"; break
                          case "pending": statusText = "Na Fila"; statusColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"; break
                        }
                        const formattedSize = job.file_size_bytes
                          ? job.file_size_bytes > 1024 * 1024 * 1024 ? `${(job.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : job.file_size_bytes > 1024 * 1024 ? `${(job.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                          : `${(job.file_size_bytes / 1024).toFixed(2)} KB`
                          : "---"
                        const isActive = ["pending", "downloading_file", "uploading_vault", "indexing"].includes(job.status)
                        return (
                          <tr key={job.id} className="hover:bg-muted/5 transition-colors">
                            <td className="px-6 py-4 font-medium text-foreground"><div className="max-w-[220px] truncate" title={job.file_name}>{job.file_name}</div></td>
                            <td className="px-6 py-4 text-muted-foreground"><div className="max-w-[160px] truncate" title={job.chat_title}>{job.chat_title}</div></td>
                            <td className="px-6 py-4 font-mono text-xs">{formattedSize}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                                {typeof job.progress === "number" && job.progress > 0 && job.progress < 100 ? `${statusText} (${job.progress}%)` : statusText}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground">{dateFormatted}</td>
                            <td className="px-6 py-4 text-xs max-w-[250px] truncate text-muted-foreground" title={job.error_message || ""}>
                              {isActive ? (
                                <button onClick={() => handleJobAction(job.id, "cancel")} disabled={actingJobId !== null} className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded transition-all cursor-pointer disabled:opacity-50">
                                  {actingJobId === job.id ? "Processando..." : "Cancelar Download"}
                                </button>
                              ) : job.status === "failed" ? (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="text-red-400">{job.error_message}</span>
                                  <button onClick={() => handleJobAction(job.id, "retry")} disabled={actingJobId !== null} className="px-2 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded transition-all cursor-pointer disabled:opacity-50 mt-1">
                                    {actingJobId === job.id ? "Processando..." : "Re-processar"}
                                  </button>
                                </div>
                              ) : job.status === "completed" ? (
                                <span className="text-emerald-400">Processado com sucesso</span>
                              ) : (
                                <span className="text-muted-foreground">---</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {totalHistoryPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/5">
                      <div className="text-xs text-muted-foreground">Página {historyPage} de {totalHistoryPages} (Total: {historyJobs.length})</div>
                      <div className="flex gap-2">
                        <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Anterior</button>
                        <button onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={historyPage === totalHistoryPages} className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Próxima</button>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>

        {/* SECTION: VARREDURA RETROATIVA */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Varredura Retroativa</h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                Reprocessa mensagens históricas dos grupos monitorados para recuperar arquivos STL enviados enquanto o scraper estava offline.
              </p>
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
              scraperStatus === "healthy" ? "bg-success/10 border-success/20 text-success"
              : scraperStatus === "warning" ? "bg-warning/10 border-warning/20 text-warning"
              : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${scraperStatus === "healthy" ? "bg-success badge-pulse-success" : scraperStatus === "warning" ? "bg-warning badge-pulse-warning" : "bg-destructive badge-pulse-destructive"}`} />
              {scraperStatus === "offline" ? "Scraper Offline — reconecte antes de varrer" : scraperStatus === "warning" ? "Scraper Instável" : "Scraper Online"}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Janela de Tempo</label>
              <div className="flex flex-wrap gap-2">
                {[{ label: "1h", value: 1 }, { label: "3h", value: 3 }, { label: "6h", value: 6 }, { label: "12h", value: 12 }, { label: "24h", value: 24 }, { label: "48h", value: 48 }, { label: "7 dias", value: 168 }].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setBackfillHoursBack(opt.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${backfillHoursBack === opt.value ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary/25"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Mensagens dos últimos <strong className="text-foreground">{backfillHoursBack}h</strong> serão verificadas.</p>
            </div>
            <button
              onClick={handleRunBackfill}
              disabled={isRunningBackfill || scraperStatus === "offline"}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold transition-all shadow-primary cursor-pointer shrink-0"
            >
              {isRunningBackfill ? <><Loader2 size={15} className="animate-spin" />Disparando...</> : <><Download size={15} />Disparar Varredura</>}
            </button>
          </div>

          <AnimatePresence>
            {backfillResult && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`rounded-xl border px-4 py-3.5 text-sm flex items-start gap-3 ${backfillResult.ok ? "bg-success/8 border-success/25 text-success" : "bg-destructive/8 border-destructive/25 text-destructive"}`}
              >
                <div className="shrink-0 mt-0.5">{backfillResult.ok ? <Check size={16} /> : <AlertTriangle size={16} />}</div>
                <div className="space-y-0.5">
                  <p className="font-semibold">{backfillResult.message}</p>
                  {backfillResult.cutoff_date && <p className="text-xs opacity-70">Cobertura a partir de: {new Date(backfillResult.cutoff_date).toLocaleString("pt-BR")}</p>}
                </div>
                <button onClick={() => setBackfillResult(null)} className="ml-auto shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>{/* end queue sub-tab */}

      {/* Modal de Detalhes do Job */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedJobDetails && (
            <div key="job-modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedJobDetails(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              >
                {/* Left: Images */}
                <div className="w-full md:w-3/5 bg-muted/50 relative flex items-center justify-center min-h-[300px]">
                  {selectedJobDetails.photos && selectedJobDetails.photos.length > 0 ? (
                    <>
                      <img src={selectedJobDetails.photos[activePhotoIndex]} alt={`Foto ${activePhotoIndex + 1}`} className="max-w-full max-h-[60vh] object-contain" />
                      {selectedJobDetails.photos.length > 1 && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev > 0 ? prev - 1 : selectedJobDetails.photos.length - 1) }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"><ChevronLeft size={20} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(prev => prev < selectedJobDetails.photos.length - 1 ? prev + 1 : 0) }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-md transition-all cursor-pointer"><ChevronRight size={20} /></button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-full bg-black/30 backdrop-blur-md">
                            {selectedJobDetails.photos.map((_: any, idx: number) => (
                              <button key={idx} onClick={(e) => { e.stopPropagation(); setActivePhotoIndex(idx) }} className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === activePhotoIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`} />
                            ))}
                          </div>
                        </>
                      )}
                      {selectedJobDetails.photos.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("Excluir apenas esta foto?")) handleRemoveJobPhoto(selectedJobDetails.id, activePhotoIndex) }}
                          className="absolute top-4 left-4 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 backdrop-blur-md transition-all shadow-md z-10 cursor-pointer"
                        >
                          Excluir Foto Atual
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <ImageIcon size={48} className="opacity-20" />
                      <span className="text-sm">Nenhuma foto disponível</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button onClick={() => handleAddJobPhotoUrl(selectedJobDetails.id)} className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer">
                      <Plus className="w-3 h-3 text-primary" /><span className="hidden sm:inline">Add URL</span>
                    </button>
                    <label className="py-1.5 px-3 bg-background/90 hover:bg-muted text-foreground rounded-full border border-border backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg text-[9px] uppercase tracking-wider font-bold cursor-pointer">
                      {isUploadingJobPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 text-primary" />}
                      <span className="hidden sm:inline">{isUploadingJobPhoto ? "Enviando..." : "Upload"}</span>
                      <input type="file" accept="image/*" onChange={(e) => handleUploadJobPhotoFile(selectedJobDetails.id, e)} disabled={isUploadingJobPhoto} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Right: Info */}
                <div className="w-full md:w-2/5 p-6 flex flex-col h-full bg-card">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-foreground">Detalhes do Arquivo</h3>
                    <button onClick={() => setSelectedJobDetails(null)} className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors cursor-pointer"><X size={20} /></button>
                  </div>
                  <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Nome Original</span>
                      <p className="text-sm font-medium text-foreground break-all">{selectedJobDetails.file_name}</p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Origem</span>
                      <p className="text-sm text-foreground">{selectedJobDetails.chat_title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Tamanho</span>
                        <p className="text-sm text-foreground font-mono">{selectedJobDetails.file_size_bytes ? `${(selectedJobDetails.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "---"}</p>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Status</span>
                        <p className="text-sm text-amber-500 font-medium">Aguardando Aprovação</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Criado em</span>
                      <p className="text-sm text-foreground">{new Date(selectedJobDetails.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-border mt-auto grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { handleJobAction(selectedJobDetails.id, "approve"); setSelectedJobDetails(null) }}
                      disabled={actingJobId !== null}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Check size={16} /> Aprovar
                    </button>
                    <button
                      onClick={() => { handleJobAction(selectedJobDetails.id, "reject"); setSelectedJobDetails(null) }}
                      disabled={actingJobId !== null}
                      className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      Rejeitar
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
