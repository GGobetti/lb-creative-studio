"use client"

import { useEffect, useState } from "react"
import { PlayCircle, Download, Users, ExternalLink } from "lucide-react"
import { HubLink } from "@/types/hub-links"
import { getSupabaseBrowser } from "@/lib/supabase"
import { getYouTubeEmbedUrl, isYouTubeUrl } from "@/lib/youtube"

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

export default function HubPage() {
  const [links, setLinks] = useState<HubLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const { data: { session } } = await getSupabaseBrowser().auth.getSession()
        const token = session?.access_token ?? ""
        const res = await fetch("/api/hub-links", {
          headers: { "Authorization": `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("Failed to fetch hub links")
        const { data } = await res.json()
        setLinks(data)
      } catch (err) {
        console.error("Error fetching hub links:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchLinks()
  }, [])

  const grouped = {
    tutoriais: links.filter((l) => l.theme === "tutoriais"),
    ia: links.filter((l) => l.theme === "ia"),
    calibracao: links.filter((l) => l.theme === "calibracao"),
    comunidade: links.filter((l) => l.theme === "comunidade"),
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-10 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Hub Maker</h1>
        <p className="text-muted-foreground mt-1">
          Recursos, tutoriais e arquivos úteis para você melhorar suas impressões.
        </p>
      </div>

      {/* Community CTA */}
      {grouped.comunidade.length > 0 && (
        <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="text-primary" /> Comunidade Maker VIP
            </h2>
            <p className="text-muted-foreground">
              {grouped.comunidade[0].description}
            </p>
          </div>
          <a
            href={grouped.comunidade[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            {grouped.comunidade[0].title}
          </a>
        </section>
      )}

      {/* Tutoriais */}
      {grouped.tutoriais.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <PlayCircle className="text-primary" /> Tutoriais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {grouped.tutoriais.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      )}

      {/* IA Tools */}
      {grouped.ia.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Ferramentas IA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {grouped.ia.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      )}

      {/* Calibração */}
      {grouped.calibracao.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Download className="text-primary" /> Calibração (MakerWorld)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {grouped.calibracao.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      )}

      {links.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          Nenhum recurso disponível ainda. Volte em breve!
        </div>
      )}
    </div>
  )
}
