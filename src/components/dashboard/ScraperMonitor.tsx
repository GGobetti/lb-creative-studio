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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-xl">Left column — status & progress</div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-xl">Right column — approvals & photos</div>
        </div>
      </div>
    </div>
  )
}
