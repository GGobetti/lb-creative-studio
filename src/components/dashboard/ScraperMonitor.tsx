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
        <div className="flex flex-col gap-6">
          <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-xl">Right column — approvals & photos</div>
        </div>
      </div>
    </div>
  )
}
