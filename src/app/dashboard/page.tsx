"use client"

import React, { useState, useEffect } from "react"
import { useConfiguratorStore } from "@/store/store"
import {
  Zap,
  DownloadCloud,
  TrendingUp,
  ArrowRight,
  Calculator,
  Folder,
  Box,
  ExternalLink,
  Search,
  Users,
  FileText,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { MakerWorldImportModal } from "@/components/dashboard/MakerWorldImportModal"
import { getSupabaseBrowser, PortfolioItem } from "@/lib/supabase"
import { formatBRL } from "@/lib/format"
import { DotMatrixLoader } from "@/components/ui/DotMatrixLoader"
import { EmptyState } from "@/components/ui/EmptyState"

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35, ease: "easeOut" as const } }),
}

export default function DashboardPage() {
  const { profile } = useConfiguratorStore()
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalStlsCount, setTotalStlsCount] = useState(0)
  const [totalPortfolioCount, setTotalPortfolioCount] = useState(0)
  const [totalValue, setTotalValue] = useState(0)

  const fetchDashboardData = React.useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseBrowser()

    try {
      const { count } = await supabase
        .from("telegram_indexed_stls")
        .select("id", { count: "exact", head: true })
      if (count !== null) setTotalStlsCount(count)
    } catch (err) {
      console.error("Error fetching STL count:", err)
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      const accessToken = session?.access_token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (userId && accessToken && supabaseUrl && supabaseAnonKey) {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/portfolio_items?user_id=eq.${userId}&order=created_at.desc`,
          { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` } }
        )
        if (response.ok) {
          const data = (await response.json()) as PortfolioItem[]
          setPortfolioItems(data)
          setTotalPortfolioCount(data.length)
          setTotalValue(data.reduce((acc, item) => acc + Number(item.calculated_price || 0), 0))
        }
      }
    } catch (err) {
      console.error("Error fetching portfolio items:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const userName = profile?.full_name || profile?.email?.split("@")[0] || "Maker"
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

  return (
    <div className="space-y-8 pb-16">

      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-display text-2xl text-foreground">
          {greeting}, {userName}! 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo de volta ao seu estúdio 3D.
        </p>
      </motion.div>

      {/* Metric strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Zap,
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
            label: "Créditos Disponíveis",
            value: `${profile?.credits ?? 0}`,
            unit: "crd",
            onClick: undefined as (() => void) | undefined,
          },
          {
            icon: Folder,
            iconBg: "bg-indigo-500/10",
            iconColor: "text-indigo-500",
            label: "Modelos no Portfólio",
            value: `${totalPortfolioCount}`,
            unit: "itens",
          },
          {
            icon: TrendingUp,
            iconBg: "bg-success/10",
            iconColor: "text-success",
            label: "Valor Acumulado",
            value: formatBRL(totalValue),
            unit: "",
          },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl shadow-card"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.iconBg}`}>
              <m.icon className={`w-5 h-5 ${m.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-label text-muted-foreground">{m.label}</p>
              <p className="text-heading text-xl text-foreground leading-tight">
                {m.value}
                {m.unit && <span className="text-sm font-medium text-muted-foreground ml-1">{m.unit}</span>}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Hero feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* STL Search */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-700 to-violet-700 rounded-3xl p-7 text-white shadow-overlay flex flex-col justify-between min-h-[240px] group border border-white/10"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none" />
          <div className="absolute top-0 right-0 w-56 h-56 bg-violet-400/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-indigo-300/10 rounded-full blur-2xl mr-6 -mb-10 pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Search size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-display text-xl leading-tight">Garimpo 3D</h2>
              <p className="text-sm text-white/80 font-medium mt-1 leading-relaxed max-w-sm">
                Sua mina de STLs prontos para impressão. Descubra, baixe e imprima milhares de modelos.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between relative z-10">
            <span className="text-xs font-semibold bg-white/10 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-md">
              🔍 {totalStlsCount.toLocaleString("pt-BR")} modelos
            </span>
            <Link
              href="/dashboard/stl-search"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-700 font-bold text-sm rounded-xl hover:bg-white/90 transition-all shadow-md"
            >
              Explorar
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>

        {/* Calculator */}
        <motion.div
          custom={4}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -3 }}
          className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-700 to-fuchsia-700 rounded-3xl p-7 text-white shadow-overlay flex flex-col justify-between min-h-[240px] group border border-white/10"
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] pointer-events-none" />
          <div className="absolute top-0 right-0 w-56 h-56 bg-fuchsia-400/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-violet-300/10 rounded-full blur-2xl mr-6 -mb-10 pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calculator size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-display text-xl leading-tight">Calculadora de Precificação</h2>
              <p className="text-sm text-white/80 font-medium mt-1 leading-relaxed max-w-sm">
                Calcule o preço real incluindo filamento, energia, margem e taxas de marketplace.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between relative z-10">
            <span className="text-xs font-semibold bg-white/10 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-md">
              ⚙️ Perfis de custo configurados
            </span>
            <Link
              href="/dashboard/calculator"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-purple-700 font-bold text-sm rounded-xl hover:bg-white/90 transition-all shadow-md"
            >
              Calcular
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Quick shortcuts */}
      <div className="space-y-3">
        <h2 className="text-heading text-base text-foreground">Atalhos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              href: "/dashboard/portfolio",
              icon: Folder,
              iconBg: "bg-primary/10",
              iconColor: "text-primary",
              title: "Portfólio",
              desc: "Modelos cadastrados e faturamento",
            },
            {
              href: "/dashboard/customers",
              icon: Users,
              iconBg: "bg-indigo-500/10",
              iconColor: "text-indigo-500",
              title: "Clientes",
              desc: "CRM e base de compradores",
            },
            {
              href: "/dashboard/quotations",
              icon: FileText,
              iconBg: "bg-success/10",
              iconColor: "text-success",
              title: "Cotações",
              desc: "Orçamentos em PDF e WhatsApp",
            },
            {
              action: () => setIsImportModalOpen(true),
              icon: DownloadCloud,
              iconBg: "bg-violet-500/10",
              iconColor: "text-violet-500",
              title: "Importar MakerWorld",
              desc: "Cole a URL e importe o modelo",
            },
          ].map((item, i) => {
            const inner = (
              <div className="flex flex-col justify-between h-full gap-3 p-4 bg-card border border-border rounded-2xl card-hover group">
                <div className="flex items-start justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </div>
            )

            return item.href ? (
              <motion.div key={item.title} custom={5 + i} variants={cardVariants} initial="hidden" animate="visible">
                <Link href={item.href} className="block h-full">{inner}</Link>
              </motion.div>
            ) : (
              <motion.div key={item.title} custom={5 + i} variants={cardVariants} initial="hidden" animate="visible">
                <button onClick={item.action} className="block w-full h-full text-left">{inner}</button>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Recent Portfolio */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-heading text-base text-foreground">Portfólio Recente</h2>
          <Link
            href="/dashboard/portfolio"
            className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
          >
            Ver todos
            <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="w-full flex items-center justify-center p-12 bg-card border border-border/60 rounded-2xl min-h-48">
            <DotMatrixLoader text="Carregando portfólio..." />
          </div>
        ) : portfolioItems.length === 0 ? (
          <EmptyState
            icon={Box}
            title="Nenhum modelo no portfólio ainda"
            description="Importe da MakerWorld ou cadastre manualmente para começar."
            action={
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-primary"
              >
                <Sparkles size={13} />
                Importar primeiro modelo
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {portfolioItems.slice(0, 4).map((item, i) => (
              <motion.div
                key={item.id}
                custom={9 + i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="group bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 transition-all hover:shadow-elevated flex flex-col"
              >
                <div className="aspect-square bg-muted relative overflow-hidden shrink-0">
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Box className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.source_type === "makerworld" ? "MakerWorld" : "LB Studio"}
                  </div>
                </div>
                <div className="p-3.5 flex flex-col flex-1 gap-2">
                  <h3 className="font-semibold text-xs line-clamp-1 text-foreground">{item.title}</h3>
                  <div className="mt-auto pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">⚖️ {item.weight_g || 0}g</span>
                    <Link
                      href="/dashboard/portfolio"
                      className="bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-0.5"
                    >
                      Precificar
                      <ExternalLink size={9} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <MakerWorldImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportSuccess={fetchDashboardData}
      />
    </div>
  )
}
