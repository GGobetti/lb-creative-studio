"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Zap, Search, Calculator, Layers } from "lucide-react"
import { RetroGrid } from "@/components/ui/RetroGrid"

const floatingCards = [
  { icon: Search, label: "Busca STL", sub: "12.847 modelos", color: "from-indigo-500/20 to-primary/20", delay: 0 },
  { icon: Calculator, label: "Calculadora", sub: "Precificação real", color: "from-violet-500/20 to-purple-500/20", delay: 0.15 },
  { icon: Layers, label: "Configurador 3D", sub: "Export STL", color: "from-fuchsia-500/20 to-pink-500/20", delay: 0.3 },
]

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-background">
      <RetroGrid className="opacity-30 dark:opacity-20" />

      {/* Ambient blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[15%] right-[10%] w-[35vw] h-[35vw] max-w-[600px] max-h-[600px] bg-violet-500/12 dark:bg-violet-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[20%] left-[5%] w-[28vw] h-[28vw] max-w-[480px] max-h-[480px] bg-blue-500/8 dark:bg-blue-500/14 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="container mx-auto px-6 relative z-10 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 text-primary font-semibold text-sm"
            >
              <Zap size={15} className="fill-current" />
              <span>A plataforma completa para Makers 3D</span>
            </motion.div>

            <h1 className="text-display text-[clamp(2.4rem,5vw,4.2rem)] text-foreground mb-6">
              Do bit ao{" "}
              <span className="gradient-text">átomo.</span>
              <br />
              Crie. Precifique. Venda.
            </h1>

            <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-lg">
              Calculadora de custos, CRM de clientes, portfólio personalizado, cotações em PDF
              e busca inteligente de arquivos STL do Telegram — tudo integrado para seu negócio 3D crescer.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Começar Grátis
                <ArrowRight size={18} />
              </Link>

              <Link
                href="#features"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-card border border-border text-foreground font-semibold text-base hover:bg-muted transition-colors"
              >
                Ver funcionalidades
              </Link>
            </div>

            {/* Social proof strip */}
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {["bg-primary/80", "bg-violet-500/80", "bg-fuchsia-500/80"].map((c, i) => (
                    <div key={i} className={`w-6 h-6 rounded-full border-2 border-background ${c}`} />
                  ))}
                </div>
                <span>+850 makers ativos</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <span>✅ Grátis para começar</span>
            </div>
          </motion.div>

          {/* Right: Floating feature cards */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:flex flex-col gap-4 relative"
          >
            {/* Main glass panel */}
            <div className="glass-panel rounded-3xl p-7 border shadow-overlay relative overflow-hidden">
              <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/90 to-blue-500/80 dark:border dark:border-white/20 flex items-center justify-center">
                      <span className="text-white font-black text-xs">LB</span>
                    </div>
                    <div>
                      <p className="text-heading text-sm text-foreground">Creative Studio</p>
                      <p className="text-[10px] text-muted-foreground">Dashboard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <Zap size={11} className="text-primary fill-primary" />
                    <span className="text-xs font-bold text-primary">320 crd</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Portfólio", value: "47 itens" },
                    { label: "Clientes", value: "12" },
                    { label: "Faturado", value: "R$ 3.240" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-muted/60 rounded-xl p-3 text-center">
                      <p className="text-heading text-sm text-foreground">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {floatingCards.map((card, i) => (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + card.delay, duration: 0.4 }}
                      className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${card.color} border border-white/5`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <card.icon size={16} className="text-white/80" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{card.label}</p>
                        <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                      </div>
                      <ArrowRight size={13} className="ml-auto text-muted-foreground/50 shrink-0" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating stat badge */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-4 -left-6 bg-card border border-border rounded-2xl p-3.5 shadow-overlay flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                <span className="text-success text-sm font-bold">↑</span>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">+2.400 STLs</p>
                <p className="text-[10px] text-muted-foreground">indexados hoje</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
