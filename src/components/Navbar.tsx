'use client'

// src/components/Navbar.tsx
// Top navigation bar with logo, credit indicator, and auth controls.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, LogOut, User, ChevronDown, LayoutDashboard, Folder, ShieldAlert } from 'lucide-react'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useTranslation } from '@/lib/translations'

export function Navbar() {
  const { profile, logout } = useConfiguratorStore()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useTranslation()

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center px-6 gap-3 sm:gap-6
                        bg-background/90 border-b border-border backdrop-blur-xl transition-colors">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg
                        bg-gradient-to-br from-violet-500/90 to-blue-500/80
                        dark:border dark:border-white/20
                        flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-sm">LB</span>
        </div>
        <span className="font-bold text-foreground text-sm tracking-tight hidden sm:inline">
          Creative <span className="text-primary">Studio</span>
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Credit badge */}
      {profile && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                        bg-primary/10 border border-primary/20">
          <Zap size={13} className="text-primary" />
          <span className="text-sm font-semibold text-primary">
            {profile.credits}
          </span>
          <span className="text-xs text-primary/60 hidden sm:inline">
            {t('common.credits', 'créditos')}
          </span>
          <span className="text-xs text-primary/60 inline sm:hidden">
            {t('common.crd', 'crd')}
          </span>
        </div>
      )}

      {/* User menu */}
      {profile ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                        bg-muted border border-border hover:border-primary/50
                        transition-colors text-muted-foreground hover:text-foreground"
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-6 h-6 rounded-full object-cover border border-primary/20"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary
                              flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                {profile.email[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm max-w-[120px] truncate hidden md:inline">{profile.email}</span>
            <ChevronDown size={13} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border
                              rounded-xl shadow-2xl overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-muted-foreground">{t('profile.email', 'Email')}</p>
                  <p className="text-sm text-card-foreground font-medium truncate">{profile.email}</p>
                  {profile.role === 'sysadmin' && (
                    <span className="text-[10px] text-amber-500 font-semibold">SYSADMIN</span>
                  )}
                </div>
                
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-3
                             text-sm text-card-foreground hover:bg-muted
                             transition-colors"
                >
                  <LayoutDashboard size={14} />
                  {t('nav.dashboard', 'Dashboard')}
                </Link>

                <Link
                  href="/dashboard/portfolio"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-3
                             text-sm text-card-foreground hover:bg-muted
                             transition-colors border-t border-border"
                >
                  <Folder size={14} />
                  {t('nav.portfolio', 'Meu Portfólio')}
                </Link>

                <Link
                  href="/dashboard/profile"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-3
                             text-sm text-card-foreground hover:bg-muted
                             transition-colors border-t border-border"
                >
                  <User size={14} />
                  {t('nav.profile', 'Meu Perfil')}
                </Link>

                {profile.role === 'sysadmin' && (
                  <Link
                    href="/dashboard/admin"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-3
                               text-sm text-amber-500 hover:bg-muted
                               transition-colors border-t border-border font-semibold"
                  >
                    <ShieldAlert size={14} />
                    {t('nav.adminPanel', 'Painel Admin')}
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3
                             text-sm text-red-500 hover:bg-red-500/10
                             transition-colors border-t border-border"
                >
                  <LogOut size={14} />
                  {t('nav.logout', 'Sair')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl
                       text-muted-foreground hover:text-foreground text-sm font-semibold
                       transition-colors hidden sm:flex"
          >
            {t('nav.login', 'Entrar')}
          </Link>
          <Link
            href="/login?mode=signup"
            className="flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold
                       transition-colors shadow-lg shadow-primary/20"
          >
            <User size={14} />
            {t('nav.signup', 'Cadastrar')}
          </Link>
        </div>
      )}
    </header>
  )
}
