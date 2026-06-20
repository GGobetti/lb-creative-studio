'use client'

import { useAppStore } from '@/store/store'
import { XpHeroCard } from './XpHeroCard'
import { XpLevelTrail } from './XpLevelTrail'
import { XpChart } from './XpChart'
import { XpRedeemCard } from './XpRedeemCard'
import { XpBadgesGrid } from './XpBadgesGrid'
import { Loader2 } from 'lucide-react'

export function XpTab() {
  const { xpSummary } = useAppStore()

  if (!xpSummary) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" />
        Carregando XP...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <XpHeroCard summary={xpSummary} />
      <XpLevelTrail summary={xpSummary} />
      <XpChart />
      <XpRedeemCard summary={xpSummary} />
      <XpBadgesGrid summary={xpSummary} />
    </div>
  )
}
