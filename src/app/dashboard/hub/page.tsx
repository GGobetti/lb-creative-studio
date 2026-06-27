"use client"

import { useEffect, useState } from "react"
import { PlayCircle, Download, Users } from "lucide-react"
import { HubLink } from "@/types/hub-links"
import { getSupabaseBrowser } from "@/lib/supabase"

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

  const groupedByTheme = {
    tutoriais: links.filter((l) => l.theme === "tutoriais"),
    ia: links.filter((l) => l.theme === "ia"),
    calibracao: links.filter((l) => l.theme === "calibracao"),
    comunidade: links.filter((l) => l.theme === "comunidade"),
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
      {groupedByTheme.comunidade.length > 0 && (
        <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="text-primary" /> Comunidade Maker VIP
            </h2>
            <p className="text-muted-foreground">
              Junte-se a outros criadores no nosso grupo exclusivo. Tire dúvidas, compartilhe configurações de fatiador e tenha acesso a novidades em primeira mão.
            </p>
          </div>
          {groupedByTheme.comunidade[0] && (
            <a
              href={groupedByTheme.comunidade[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              {groupedByTheme.comunidade[0].title}
            </a>
          )}
        </section>
      )}

      {/* Tutoriais Section */}
      {groupedByTheme.tutoriais.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <PlayCircle className="text-primary" /> Tutoriais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupedByTheme.tutoriais.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card border border-border rounded-xl p-4 hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IA Tools Section */}
      {groupedByTheme.ia.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Ferramentas IA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {groupedByTheme.ia.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Calibration Section */}
      {groupedByTheme.calibracao.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Download className="text-primary" /> Calibração (MakerWorld)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {groupedByTheme.calibracao.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
