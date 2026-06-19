"use client"

import { motion } from "framer-motion"

interface FeatureFlag {
  key: string
  display_name: string
  is_enabled: boolean
}

interface FlagsTabProps {
  featureFlags: FeatureFlag[]
  onToggle: (key: string, currentVal: boolean) => void
}

export function FlagsTab({ featureFlags, onToggle }: FlagsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="p-6 border-b border-border bg-muted/20">
        <h3 className="font-bold text-base">Controle de Features (Feature Flags)</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ative ou desative funcionalidades em tempo real para os usuários da plataforma de forma faseada.
        </p>
      </div>

      <div className="p-6 divide-y divide-border/60">
        {featureFlags.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Nenhuma feature flag cadastrada no banco de dados.
          </div>
        ) : (
          featureFlags.map((flag) => (
            <div key={flag.key} className="py-4 flex items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="font-bold text-sm text-foreground">{flag.display_name}</span>
                <p className="text-[10px] text-muted-foreground font-mono">Chave: {flag.key}</p>
              </div>

              <button
                onClick={() => onToggle(flag.key, flag.is_enabled)}
                className={`relative w-12 h-6 rounded-full p-0.5 transition-all duration-300 outline-none select-none cursor-pointer border shadow-inner flex items-center
                  ${flag.is_enabled
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted border-border text-muted-foreground"
                  }`}
              >
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`w-4.5 h-4.5 rounded-full shadow-md transition-all
                    ${flag.is_enabled
                      ? "bg-primary translate-x-6"
                      : "bg-muted-foreground/60 translate-x-0.5"
                    }`}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
