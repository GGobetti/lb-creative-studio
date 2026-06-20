'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'

interface LeaderboardUser {
  rank: number
  userId: string
  name: string
  xp: number
  badge: string
  streak: number
  gamesPlayed: number
}

interface UserPositionCardProps {
  userPosition: LeaderboardUser | null
  isLoading?: boolean
}

export function UserPositionCard({
  userPosition,
  isLoading = false,
}: UserPositionCardProps) {
  if (isLoading) {
    return <div className="h-24 bg-muted/20 rounded-lg animate-pulse" />
  }

  if (!userPosition) {
    return (
      <div className="rounded-lg border border-dashed border-warning/50 bg-warning/5 px-4 py-6 text-center">
        <p className="text-sm font-medium text-warning mb-3">
          Você ainda não aparece no ranking. Jogue para entrar!
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
        <h3 className="text-sm font-semibold text-foreground">Sua Posição</h3>
        <span className="text-2xl font-bold text-primary">
          #{userPosition.rank}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">XP Total</p>
          <p className="text-lg font-bold text-warning">
            {userPosition.xp.toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Badge</p>
          <p className="text-2xl">{userPosition.badge}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Streak</p>
          <p className="text-lg font-bold text-orange-500">
            🔥 {userPosition.streak}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Games</p>
          <p className="text-lg font-bold text-foreground">
            {userPosition.gamesPlayed}
          </p>
        </div>
      </div>
    </div>
  )
}
