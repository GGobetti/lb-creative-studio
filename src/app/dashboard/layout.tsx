"use client"

import { useState, useEffect } from "react"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { CreditModal } from "@/components/CreditModal"
import { useTranslation } from "@/lib/translations"
import {
  Menu,
  Zap,
  User,
  ChevronDown,
  LogOut,
  Folder,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react"
import { useConfiguratorStore } from "@/store/store"
import { getSupabaseBrowser } from "@/lib/supabase"
import { useShallow } from "zustand/react/shallow"
import { useLogout } from "@/hooks/useLogout"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, creditModalOpen, setCreditModalOpen, setFeatureFlags, xpSummary } = useConfiguratorStore(
    useShallow((s) => ({
      profile: s.profile,
      creditModalOpen: s.creditModalOpen,
      setCreditModalOpen: s.setCreditModalOpen,
      setFeatureFlags: s.setFeatureFlags,
      xpSummary: s.xpSummary,
    }))
  )
  const handleLogout = useLogout()
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data, error } = await supabase.from("feature_flags").select("key, is_enabled")
        if (error) throw error
        const flagsMap: Record<string, boolean> = {}
        data.forEach((flag: any) => { flagsMap[flag.key] = flag.is_enabled })
        setFeatureFlags(flagsMap)
      } catch (err) {
        console.error("Erro ao carregar feature flags:", err)
      }
    }
    fetchFlags()
  }, [])

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "Maker"
  const planLabel = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : "Free"

  const planColor = {
    free:  "text-muted-foreground",
    pro:   "text-primary",
    max:   "text-warning",
  }[profile?.plan || "free"] ?? "text-muted-foreground"

  return (
    <div className="flex h-screen bg-background transition-colors overflow-hidden relative print:h-auto print:overflow-visible">

      {/* Liquid Glass — animated mesh, absolute inside wrapper so backdrop-filter blurs it */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none dark:block hidden">
        <div
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[80%] animate-blob-1 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(120,80,255,0.22) 0%, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[75%] animate-blob-2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(0,160,255,0.16) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-[30%] left-[40%] w-[40%] h-[50%] animate-blob-3 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(255,80,120,0.10) 0%, transparent 65%)' }}
        />
      </div>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — relative z-10 so it sits above the z-0 mesh */}
      <div className="print:hidden relative z-10">
        <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main — relative z-10 so it sits above the z-0 mesh */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 print:h-auto print:overflow-visible">

        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-border/60 bg-card/60 backdrop-blur-xl saturate-150 print:hidden z-20 relative shrink-0 overflow-hidden
                           lg:mt-4 lg:mr-4 lg:rounded-2xl lg:border lg:border-border/60 lg:shadow-card lg:ml-0 transition-all duration-300">

          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden transition-colors"
          >
            <Menu size={18} />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <span className="text-label text-muted-foreground/70">LB Creative Studio</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">

            {/* Credits button */}
            {profile && (
              <button
                onClick={() => setCreditModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                           bg-primary/8 text-primary border border-primary/20
                           text-xs font-bold
                           hover:bg-primary/15 hover:border-primary/35
                           hover:scale-105 active:scale-95
                           transition-all cursor-pointer shadow-sm"
              >
                <Zap size={13} className="fill-current" />
                <span>{profile.credits}</span>
                <span className="text-primary/60 font-normal">crd</span>
              </button>
            )}

            {/* XP pill */}
            {profile && xpSummary && (
              <Link
                href="/dashboard/profile?tab=xp"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                           bg-amber-500/10 border border-amber-500/20 text-xs font-bold
                           hover:bg-amber-500/20 hover:scale-105 active:scale-95
                           transition-all shadow-sm"
              >
                <span>{xpSummary.current_level.badge_icon}</span>
                <span className="text-amber-500">{xpSummary.xp_total.toLocaleString('pt-BR')} XP</span>
                <span className="text-amber-500/60 font-normal hidden sm:inline">· {xpSummary.current_level.name}</span>
              </Link>
            )}

            <LanguageSwitcher />

            {/* Profile dropdown */}
            {profile && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer select-none"
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-6 h-6 rounded-full object-cover border border-primary/20 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      <User size={12} />
                    </div>
                  )}
                  <div className="hidden md:flex flex-col min-w-0 text-left">
                    <span className="text-xs font-semibold truncate text-foreground leading-tight max-w-22.5">
                      {displayName}
                    </span>
                    <span className={`text-[10px] leading-tight font-semibold ${planColor}`}>
                      {t("common.plan", "Plano")} {planLabel}
                    </span>
                  </div>
                  <ChevronDown size={12} className={`transition-transform shrink-0 text-muted-foreground ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ type: "spring", duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-overlay overflow-hidden z-20"
                      >
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                          {profile.role === "sysadmin" && (
                            <span className="text-[10px] text-warning font-bold uppercase tracking-wider">Sysadmin</span>
                          )}
                        </div>

                        {[
                          { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard", "Dashboard") },
                          { href: "/dashboard/portfolio", icon: Folder, label: t("nav.portfolio", "Meu Portfólio") },
                          { href: "/dashboard/profile", icon: User, label: t("nav.profile", "Meu Perfil") },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-card-foreground hover:bg-muted transition-colors border-t border-border first:border-t-0"
                          >
                            <item.icon size={14} className="text-muted-foreground shrink-0" />
                            {item.label}
                          </Link>
                        ))}

                        {profile.role === "sysadmin" && (
                          <Link
                            href="/dashboard/admin"
                            onClick={() => setMenuOpen(false)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-warning font-semibold hover:bg-muted transition-colors border-t border-border"
                          >
                            <ShieldAlert size={14} className="shrink-0" />
                            {t("nav.adminPanel", "Painel Admin")}
                          </Link>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/8 transition-colors border-t border-border cursor-pointer"
                        >
                          <LogOut size={14} className="shrink-0" />
                          {t("nav.logout", "Sair")}
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7 print:p-0 print:overflow-visible transition-all duration-300">
          <div className="mx-auto max-w-6xl print:max-w-none">
            {children}
          </div>
        </main>
      </div>

      <CreditModal open={creditModalOpen} onOpenChange={setCreditModalOpen} />
    </div>
  )
}
