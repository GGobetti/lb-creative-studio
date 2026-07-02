"use client"

import { HubLink } from "@/types/hub-links"
import { PlayCircle, Download, Users } from "lucide-react"
import { useTranslation } from "@/lib/translations"

interface HubLinksPreviewProps {
  links: HubLink[]
}

export function HubLinksPreview({ links }: HubLinksPreviewProps) {
  const { t } = useTranslation()
  const groupedByTheme = {
    tutoriais: links.filter((l) => l.theme === "tutoriais"),
    ia: links.filter((l) => l.theme === "ia"),
    calibracao: links.filter((l) => l.theme === "calibracao"),
    comunidade: links.filter((l) => l.theme === "comunidade"),
  }

  return (
    <div className="space-y-8 pb-10 bg-card border border-border rounded-xl p-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Preview</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("adminHubLinksPreview.howItWillLook", "Como ficará no Hub Maker")}</p>
      </div>

      {/* Community CTA */}
      {groupedByTheme.comunidade.length > 0 && (
        <section className="bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/30 rounded-xl p-6">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="text-primary" size={20} /> {t("adminHubLinksPreview.community", "Comunidade")}
            </h3>
            {groupedByTheme.comunidade.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-primary hover:underline"
              >
                {link.title}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Tutoriais */}
      {groupedByTheme.tutoriais.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <PlayCircle className="text-primary" size={20} /> {t("adminHubLinksPreview.tutorials", "Tutoriais")}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.tutoriais.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* IA */}
      {groupedByTheme.ia.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3">{t("adminHubLinksPreview.aiTools", "Ferramentas IA")}</h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.ia.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Calibração */}
      {groupedByTheme.calibracao.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Download className="text-primary" size={20} /> {t("adminHubLinksPreview.calibrationMakerworld", "Calibração (MakerWorld)")}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {groupedByTheme.calibracao.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border hover:border-primary transition-colors group"
              >
                <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  {link.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {Object.values(groupedByTheme).every((arr) => arr.length === 0) && (
        <p className="text-center text-sm text-muted-foreground py-8">
          {t("adminHubLinksPreview.noActiveLinks", "Nenhum link ativo. Adicione links no editor à esquerda.")}
        </p>
      )}
    </div>
  )
}
