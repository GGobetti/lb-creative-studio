'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, ArrowRight } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

interface LeaderboardUser {
  rank: number
  userId: string
  name: string
  xp: number
  badge: string
  streak: number
  gamesPlayed: number
}

interface LeaderboardResponse {
  period: string
  rankings: LeaderboardUser[]
  userPosition: LeaderboardUser | null
}

export function LeaderboardCard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsLoading(false)
          return
        }

        const res = await fetch('/api/leaderboard?period=week&limit=5', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.ok) {
          const json = await res.json()
          setData(json)
        } else {
          setIsError(true)
        }
      } catch {
        setIsError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const rankings = data?.rankings ?? []

  return (
    <div className="flex flex-col gap-3 bg-muted/40 border border-border rounded-2xl px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
          <Trophy size={18} className="text-warning" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Ranking Semanal</h3>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-8 bg-muted/20 rounded animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && isError && (
        <p className="text-xs text-destructive/70">
          Erro ao carregar ranking
        </p>
      )}

      {/* Rankings */}
      {!isLoading && !isError && rankings.length > 0 && (
        <div className="space-y-1">
          {rankings.map((user) => (
            <div
              key={user.userId}
              className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-muted/20 transition"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-bold text-muted-foreground w-5 shrink-0">
                  #{user.rank}
                </span>
                <span className="text-sm truncate">{user.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-warning font-semibold">{user.xp}</span>
                <span className="text-muted-foreground">XP</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && rankings.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum jogador essa semana
        </p>
      )}

      {/* Footer: Link to full leaderboard */}
      <Link
        href="/dashboard/games/leaderboard"
        className="flex items-center justify-center gap-2 mt-2 px-3 py-2 text-xs font-medium rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition group"
      >
        Ver ranking completo
        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  )
}
