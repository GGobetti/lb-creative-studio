'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useTranslation } from '@/lib/translations'
import { LeaderboardTable } from '@/components/games/LeaderboardTable'
import { UserPositionCard } from '@/components/games/UserPositionCard'
import type { LeaderboardResponse } from '@/types/leaderboard'

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const [activePeriod, setActivePeriod] = useState<'week' | 'alltime'>('week')
  const [weekData, setWeekData] = useState<LeaderboardResponse | null>(null)
  const [allTimeData, setAllTimeData] = useState<LeaderboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBoth = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsLoading(false)
          return
        }

        const headers = { Authorization: `Bearer ${session.access_token}` }

        const [weekRes, allTimeRes] = await Promise.all([
          fetch('/api/leaderboard?period=week&limit=10', { headers }),
          fetch('/api/leaderboard?period=alltime&limit=10', { headers }),
        ])

        if (weekRes.ok) {
          const json = await weekRes.json()
          setWeekData(json)
        }
        if (allTimeRes.ok) {
          const json = await allTimeRes.json()
          setAllTimeData(json)
        }
      } catch {
        // silently handle fetch errors; data stays null
      } finally {
        setIsLoading(false)
      }
    }

    fetchBoth()
  }, [])

  const currentData = activePeriod === 'week' ? weekData : allTimeData
  const rankings = currentData?.rankings ?? []
  const userPosition = currentData?.userPosition ?? null

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <Trophy size={20} className="text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('leaderboard.title')}
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border/50">
          <button
            onClick={() => setActivePeriod('week')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activePeriod === 'week'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('leaderboard.weekTab')}
            {activePeriod === 'week' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActivePeriod('alltime')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activePeriod === 'alltime'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('leaderboard.allTimeTab')}
            {activePeriod === 'alltime' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* User Position Card */}
        <UserPositionCard
          userPosition={userPosition}
          isLoading={isLoading}
        />

        {/* Rankings Table */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Top 10
          </h2>
          <LeaderboardTable
            rankings={rankings}
            isLoading={isLoading}
            period={activePeriod}
          />
        </div>
      </div>
    </div>
  )
}
