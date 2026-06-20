'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'
import { useTranslation } from '@/lib/translations'
import type { LeaderboardUser } from '@/types/leaderboard'

interface UserPositionCardProps {
  userPosition: LeaderboardUser | null
  isLoading?: boolean
}

export function UserPositionCard({
  userPosition,
  isLoading = false,
}: UserPositionCardProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <div className="h-24 bg-muted/20 rounded-lg animate-pulse" />
  }

  if (!userPosition) {
    return (
      <div className="rounded-lg border border-dashed border-warning/50 bg-warning/5 px-4 py-6 text-center">
        <p className="text-sm font-medium text-warning mb-3">
          {t('leaderboard.noGamesYet')}
        </p>
        <Link
          href="/dashboard/games"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/20 hover:bg-warning/30 text-warning font-medium text-sm transition-colors"
        >
          <Zap size={16} />
          Jogar Agora
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('leaderboard.yourPosition')}
        </h3>
        <span className="text-2xl font-bold text-primary">
          #{userPosition.rank}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('leaderboard.xp')}</p>
          <p className="text-lg font-bold text-warning">
            {userPosition.xp.toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('leaderboard.badge')}</p>
          <p className="text-2xl">{userPosition.badge}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('leaderboard.streak')}</p>
          <p className="text-lg font-bold text-orange-500">
            🔥 {userPosition.streak}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('leaderboard.games')}</p>
          <p className="text-lg font-bold text-foreground">
            {userPosition.gamesPlayed}
          </p>
        </div>
      </div>
    </div>
  )
}
