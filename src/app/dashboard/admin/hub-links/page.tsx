"use client"

import { useState, useEffect, useCallback } from "react"
import { useAppStore } from "@/store/store"
import { getSupabaseBrowser } from "@/lib/supabase"
import { HubLink } from "@/types/hub-links"
import { HubLinksEditor } from "@/components/admin/HubLinksEditor"
import { HubLinksPreview } from "@/components/admin/HubLinksPreview"

async function getToken(): Promise<string> {
  const { data: { session } } = await getSupabaseBrowser().auth.getSession()
  return session?.access_token ?? ""
}

export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

export default function HubLinksAdminPage() {
  const { profile } = useAppStore()

  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await authedFetch("/api/admin/hub-links")
      if (!res.ok) throw new Error("Failed to fetch links")
      const { data } = await res.json()
      setLinks(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.role === "sysadmin") {
      fetchLinks()
    } else if (profile) {
      setError("Acesso restrito a administradores.")
      setLoading(false)
    }
  }, [profile, fetchLinks])

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-destructive font-medium">{error}</p>
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
        <div className="lg:col-span-2">
          <HubLinksEditor
            links={links}
            onLinksChange={setLinks}
            loading={loading}
            onError={(msg: string) => setError(msg)}
          />
        </div>

        <div className="lg:col-span-1">
          <HubLinksPreview links={links.filter((l) => l.is_active)} />
        </div>
      </div>
    </div>
  )
}
