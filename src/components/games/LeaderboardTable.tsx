'use client'

import { useTranslation } from '@/lib/translations'
import type { LeaderboardUser } from '@/types/leaderboard'

interface LeaderboardTableProps {
  rankings: LeaderboardUser[]
  isLoading?: boolean
  period: 'week' | 'alltime'
}

export function LeaderboardTable({
  rankings,
  isLoading = false,
  period,
}: LeaderboardTableProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-muted/20 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (rankings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">
          {period === 'week' ? t('leaderboard.noGamesWeek') : t('leaderboard.noGamesYet')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/40">
            <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.rank')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.name')}
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.xp')}
            </th>
            <th className="px-4 py-3 text-center font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.badge')}
            </th>
            <th className="px-4 py-3 text-center font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.streak')}
            </th>
            <th className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
              {t('leaderboard.games')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((user, idx) => (
            <tr
              key={user.userId}
              className={`border-b border-border/30 transition hover:bg-muted/20 ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}
            >
              <td className="px-4 py-3">
                <span className="font-bold text-primary">#{user.rank}</span>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {user.name}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-warning">
                {user.xp.toLocaleString('pt-BR')}
              </td>
              <td className="px-4 py-3 text-center text-lg">{user.badge}</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium">
                  🔥 {user.streak}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {user.gamesPlayed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
