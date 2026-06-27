"use client"

import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { HubLink, HubTheme } from "@/types/hub-links"
import { getSupabaseBrowser } from "@/lib/supabase"
import { getYouTubeEmbedUrl, isYouTubeUrl } from "@/lib/youtube"
import { ExternalLink } from "lucide-react"

const THEME_LABELS: Record<HubTheme, string> = {
  tutoriais: "Tutoriais",
  ia: "Ferramentas IA",
  calibracao: "Calibração (MakerWorld)",
  comunidade: "Comunidade",
}

function LinkCard({ link }: { link: HubLink }) {
  const isYT = isYouTubeUrl(link.url)
  const embedUrl = isYT ? getYouTubeEmbedUrl(link.url) : null

  if (embedUrl) {
    return (
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            title={link.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground">{link.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
        </div>
      </div>
    )
  }

  if (link.thumbnail_url) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden border border-border bg-card hover:border-primary transition-colors group"
      >
        <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <img
            src={link.thumbnail_url}
            alt={link.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ExternalLink className="text-white" size={32} />
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
        </div>
      </a>
    )
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col justify-between p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group"
    >
      <div>
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{link.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <ExternalLink size={12} /> Abrir link
      </div>
    </a>
  )
}

export default function HubThemePage({ params }: { params: Promise<{ theme: string }> }) {
  const [theme, setTheme] = useState<HubTheme | null>(null)
  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { theme: themeParam } = await params
      const validThemes = ["tutoriais", "ia", "calibracao", "comunidade"]
      if (!validThemes.includes(themeParam)) {
        setTheme(null)
        setLoading(false)
        return
      }
      setTheme(themeParam as HubTheme)

      try {
        const { data: { session } } = await getSupabaseBrowser().auth.getSession()
        const token = session?.access_token ?? ""
        const res = await fetch("/api/hub-links", {
          headers: { "Authorization": `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("Failed to fetch hub links")
        const { data } = await res.json()
        setLinks(data.filter((l: HubLink) => l.theme === themeParam))
      } catch (err) {
        console.error("Error fetching hub links:", err)
      } finally {
        setLoading(false)
      }
    })()
  }, [params])

  if (!theme || loading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!Object.keys(THEME_LABELS).includes(theme)) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Tema não encontrado.</p>
        <Link href="/dashboard/hub" className="text-primary hover:underline flex items-center gap-1 justify-center">
          <ArrowLeft size={16} /> Voltar ao Hub
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/hub"
          className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          title="Voltar"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{THEME_LABELS[theme]}</h1>
          <p className="text-muted-foreground mt-1">
            {links.length} {links.length === 1 ? "recurso" : "recursos"} disponível{links.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          Nenhum recurso disponível nesta categoria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  )
}
