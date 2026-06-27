"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/store/store"
import { HubLink } from "@/types/hub-links"
import { HubLinksEditor } from "@/components/admin/HubLinksEditor"
import { HubLinksPreview } from "@/components/admin/HubLinksPreview"

export default function HubLinksAdminPage() {
  const { profile } = useAppStore()

  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check admin access
  useEffect(() => {
    if (profile?.role !== "sysadmin") {
      setError("Unauthorized: Admin access required")
      return
    }
  }, [profile])

  // Fetch links on mount
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/admin/hub-links")
        if (!res.ok) throw new Error("Failed to fetch links")
        const { data } = await res.json()
        setLinks(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (profile?.role === "sysadmin") {
      fetchLinks()
    }
  }, [profile])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{error}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuração do Hub</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os links e recursos exibidos no Hub Maker para makers 3D.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor - 60% on desktop */}
        <div className="lg:col-span-2">
          <HubLinksEditor
            links={links}
            onLinksChange={setLinks}
            loading={loading}
            onError={(msg: string) => setError(msg)}
          />
        </div>

        {/* Preview - 40% on desktop */}
        <div className="lg:col-span-1">
          <HubLinksPreview links={links.filter((l) => l.is_active)} />
        </div>
      </div>
    </div>
  )
}
