"use client"

import { Monitor } from "lucide-react"
import { useTranslation } from "@/lib/translations"

interface DesktopOnlyNoticeProps {
  /** Which breakpoint to gate on. Content below this width shows the notice instead of `children`. */
  breakpoint?: "md" | "lg"
  children: React.ReactNode
}

/**
 * Wraps a tool that isn't adapted for small screens yet. Below the given
 * breakpoint it shows an explanatory card instead of rendering `children`,
 * so users don't hit a broken layout — they get a clear "use a computer" message.
 */
export function DesktopOnlyNotice({ breakpoint = "lg", children }: DesktopOnlyNoticeProps) {
  const { t } = useTranslation()
  const hiddenClass = breakpoint === "lg" ? "lg:hidden" : "md:hidden"
  const visibleClass = breakpoint === "lg" ? "hidden lg:block" : "hidden md:block"

  return (
    <>
      <div className={`${hiddenClass} flex flex-col items-center text-center gap-4 py-16 px-6 bg-card border border-border rounded-3xl`}>
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <Monitor size={28} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-bold text-foreground">
            {t("common.desktopOnlyTitle", "Disponível apenas no computador")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("common.desktopOnlyDesc", "Essa ferramenta ainda não tem uma versão otimizada para celular. Acesse pelo computador para a melhor experiência.")}
          </p>
        </div>
      </div>
      <div className={visibleClass}>
        {children}
      </div>
    </>
  )
}
