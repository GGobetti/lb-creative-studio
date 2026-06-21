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
        </div>
        <div className="flex flex-col gap-6">
          <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-xl">Right column — approvals & photos</div>
        </div>
      </div>
    </div>
  )
}
