"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calculator,
  BookOpen,
  User,
  LogOut,
  Folder,
  Search,
  Users,
  FileText,
  LifeBuoy,
  X,
  CreditCard,
  LayoutDashboard,
  ShieldAlert,
  Wifi,
  WifiOff,
  AlertTriangle,
  Swords,
} from "lucide-react"
import { useAppStore } from "@/store/store"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useShallow } from "zustand/react/shallow"
import { useLogout } from "@/hooks/useLogout"
import { useTranslation } from "@/lib/translations"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
}

type ScraperHealth = "healthy" | "warning" | "offline" | "unknown"

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { isFeatureEnabled, profile } = useAppStore(
    useShallow((s) => ({ isFeatureEnabled: s.isFeatureEnabled, profile: s.profile }))
  )
  const handleLogout = useLogout()
  const { t } = useTranslation()
  const isSysadmin = profile?.role === "sysadmin"

  const [scraperHealth, setScraperHealth] = useState<ScraperHealth>("unknown")

  useEffect(() => {
    if (!isSysadmin) return

    const updateHealth = (heartbeat: string | null | undefined) => {
      if (!heartbeat) { setScraperHealth("unknown"); return }
      const diff = (Date.now() - new Date(heartbeat).getTime()) / 1000
      if (diff < 120)      setScraperHealth("healthy")
      else if (diff < 300) setScraperHealth("warning")
      else                  setScraperHealth("offline")
    }

    const supabase = getSupabaseBrowser()

    supabase
      .from("telegram_scraper_settings")
      .select("last_heartbeat")
      .eq("id", "default")
      .single()
      .then(({ data }: { data: { last_heartbeat?: string } | null }) => updateHealth(data?.last_heartbeat))

    const channel = supabase
      .channel("sidebar-scraper-health")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "telegram_scraper_settings", filter: "id=eq.default" },
        (payload: { new: { last_heartbeat?: string } }) => { updateHealth(payload.new?.last_heartbeat) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isSysadmin])

  const flagMappings: Record<string, string> = {
    "/dashboard/stl-search": "telegram_stl_search",
    "/dashboard/calculator": "pricing_calculator",
    "/dashboard/customers": "crm_customers",
    "/dashboard/quotations": "quotations",
    "/dashboard/hub": "maker_hub",
    "/dashboard/tickets": "support_tickets",
  }

  const sections: {
    title: string
    items: { name: string; href: string; icon: any; highlight?: boolean }[]
  }[] = [
    {
      title: t("sidebar.discover", "Descobrir"),
      items: [
        { name: t("sidebar.stlSearch", "Garimpo 3D"), href: "/dashboard/stl-search", icon: Search, highlight: true },
        { name: t("sidebar.curation", "Gaming Lab XP"), href: "/dashboard/games", icon: Swords, highlight: true },
        { name: t("sidebar.makerHub", "Hub Maker"), href: "/dashboard/hub", icon: BookOpen },
      ],
    },
    {
      title: t("sidebar.myBusiness", "Meu Negócio"),
      items: [
        { name: t("sidebar.calculator", "Calculadora"), href: "/dashboard/calculator", icon: Calculator, highlight: true },
        { name: t("sidebar.portfolio", "Portfólio"), href: "/dashboard/portfolio", icon: Folder },
        { name: t("sidebar.customers", "Clientes"), href: "/dashboard/customers", icon: Users },
        { name: t("sidebar.quotations", "Cotações"), href: "/dashboard/quotations", icon: FileText },
      ],
    },
    {
      title: t("sidebar.account", "Conta"),
      items: [
        { name: t("sidebar.billing", "Assinatura & Créditos"), href: "/dashboard/billing", icon: CreditCard },
        { name: t("sidebar.profileSettings", "Perfil & Configurações"), href: "/dashboard/profile", icon: User },
        { name: t("sidebar.tickets", "Suporte / Chamados"), href: "/dashboard/tickets", icon: LifeBuoy },
      ],
    },
  ]

  if (isSysadmin) {
    sections.push({
      title: t("sidebar.admin", "Admin"),
      items: [
        { name: t("sidebar.adminPanel", "Painel Admin"), href: "/dashboard/admin", icon: ShieldAlert },
      ],
    })
  }

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const flagKey = flagMappings[item.href]
        return flagKey ? isFeatureEnabled(flagKey) : true
      }),
    }))
    .filter((s) => s.items.length > 0)

  const scraperIcon = {
    healthy: <Wifi size={11} className="text-success" />,
    warning: <AlertTriangle size={11} className="text-warning" />,
    offline: <WifiOff size={11} className="text-destructive" />,
    unknown: <Wifi size={11} className="text-muted-foreground/40" />,
  }[scraperHealth]

  const scraperLabel = {
    healthy: t("sidebar.scraperOnline", "Scraper online"),
    warning: t("sidebar.scraperSlow", "Scraper lento"),
    offline: t("sidebar.scraperOffline", "Scraper offline"),
    unknown: t("sidebar.unknownStatus", "Status desconhecido"),
  }[scraperHealth]

  const scraperDotClass = {
    healthy: "bg-success badge-pulse-success",
    warning: "bg-warning badge-pulse-warning",
    offline: "bg-destructive badge-pulse-destructive",
    unknown: "bg-muted-foreground/30",
  }[scraperHealth]

  return (
    <>
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-64 flex-col relative overflow-hidden
          transition-transform duration-300 ease-in-out
          lg:my-4 lg:ml-4 lg:h-[calc(100vh-2rem)] lg:rounded-2xl lg:shadow-overlay lg:static lg:translate-x-0
          bg-[var(--sidebar-bg)] glass-sidebar border-r border-[var(--sidebar-border)]
          lg:border lg:border-[var(--sidebar-border)]
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Liquid Glass — specular highlight on top edge */}
        <div
          aria-hidden
          className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none z-10 hidden dark:block"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }}
        />
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--sidebar-border)] px-5 lg:rounded-t-2xl shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-primary shrink-0">
              <span className="text-white font-black text-xs tracking-tight">LB</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-heading text-[13px] text-foreground">Creative</span>
              <span className="text-heading text-[13px] text-primary">Studio</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Dashboard quick link */}
        <div className="px-3 pt-3 shrink-0">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all relative group ${
              pathname === "/dashboard"
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {pathname === "/dashboard" && (
              <motion.div
                layoutId="active-nav-pill"
                className="absolute inset-0 bg-primary/8 rounded-xl border-l-2 border-primary"
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            )}
            <LayoutDashboard size={16} className="relative z-10 shrink-0" />
            <span className="relative z-10 font-medium">{t("sidebar.dashboard", "Dashboard")}</span>
          </Link>
        </div>

        {/* Navigation sections */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-none">
          {visibleSections.map((section) => (
            <div key={section.title} className="flex flex-col">
              <span className="text-label text-muted-foreground/60 px-3 mb-1.5">{section.title}</span>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      data-tour={
                        item.href === '/dashboard/stl-search' ? 'stl-search' :
                        item.href === '/dashboard/games' ? 'games' :
                        undefined
                      }
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all relative group ${
                        isActive
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-pill"
                          className="absolute inset-0 bg-primary/8 rounded-xl border-l-2 border-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        />
                      )}
                      <Icon
                        size={16}
                        className={`shrink-0 relative z-10 transition-colors ${
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      />
                      <span className="flex-1 relative z-10">{item.name}</span>
                      {item.highlight && !isActive && (
                        <span className="relative flex h-1.5 w-1.5 z-10">
                          <span className="badge-pulse absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-[var(--sidebar-border)] space-y-1 lg:rounded-b-2xl">
          {/* Scraper health badge (sysadmin only) */}
          {isSysadmin && (
            <Link
              href="/dashboard/admin?tab=scraper"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted transition-colors group"
              title={scraperLabel}
            >
              <span className={`relative flex h-2 w-2 shrink-0`}>
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${scraperDotClass}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${scraperDotClass.split(" ")[0]}`} />
              </span>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                {scraperLabel}
              </span>
              {scraperIcon}
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/8 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>{t("sidebar.logout", "Sair")}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
