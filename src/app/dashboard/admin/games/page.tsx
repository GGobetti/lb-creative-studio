'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Settings, ShieldCheck, Zap } from 'lucide-react'
import Link from 'next/link'
import { useAppStore } from '@/store/store'
import { Lock } from 'lucide-react'
import { GamesLimitsPanel } from '@/components/admin/GamesLimitsPanel'
import { useTranslation } from '@/lib/translations'

type TabType = 'limits' | 'moderation'

export default function GamesAdminPage() {
  const { profile } = useAppStore()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('limits')

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'limits', label: t('adminGames.tabLimits', 'Limites e Recompensas'), icon: Settings },
    { key: 'moderation', label: t('adminGames.tabModeration', 'Moderação de Auditorias'), icon: ShieldCheck },
  ]

  if (!profile || profile.role !== 'sysadmin') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 ring-4 ring-red-500/5">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight">{t('adminGames.accessRestricted', 'Acesso Restrito')}</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          {t('adminGames.accessRestrictedMessage', 'Esta área é exclusiva para administradores (sysadmin).')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/dashboard/admin"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-display text-2xl gradient-text">{t('adminGames.pageTitle', 'Admin de Games')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('adminGames.pageSubtitle', 'Gerencie limites, recompensas e moderação de auditorias')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-card border border-border rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="w-full"
        >
          {activeTab === 'limits' && <GamesLimitsPanel />}

          {activeTab === 'moderation' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                    <ShieldCheck size={24} className="text-warning" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {t('adminGames.moderationTitle', 'Moderação de Auditorias')}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('adminGames.moderationSubtitle', 'Revise e aprove STLs com votações contestadas (30-70% consenso)')}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <p className="text-sm text-muted-foreground">
                    {t('adminGames.moderationPanelIntro', 'O painel de moderação permite que você:')}
                  </p>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{t('adminGames.moderationFeature1', 'Visualizar STLs com votações contestadas (status não definido)')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{t('adminGames.moderationFeature2', 'Ver detalhes de cada voto e motivos de rejeição')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{t('adminGames.moderationFeature3', 'Aprovar ou rejeitar manualmente (sobrescreve o consenso)')}</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href="/dashboard/admin/audit-moderation"
                  className="inline-block mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 transition-all"
                >
                  {t('adminGames.goToModerationPanel', 'Ir para Painel de Moderação →')}
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
