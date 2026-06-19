'use client'

import type { XpSummary, XpLevel } from '@/types/xp'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpBadgesGrid({ summary }: Props) {
  const [allLevels, setAllLevels] = useState<XpLevel[]>([])

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_levels')
      .select('*')
      .order('level')
      .then(({ data }: { data: XpLevel[] | null }) => { if (data) setAllLevels(data) })
  }, [])

  const unlockedMap = Object.fromEntries(summary.badges.map((b) => [b.level, b]))

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Badges
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {allLevels.map((level) => {
          const badge = unlockedMap[level.level]
          const unlocked = !!badge

          return (
            <div
              key={level.level}
              className={`rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all
                ${unlocked
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border bg-muted/20 opacity-50 grayscale'
                }`}
            >
              <div className="text-3xl">{unlocked ? level.badge_icon : <Lock size={24} className="text-muted-foreground" />}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{level.name}</p>
                {unlocked ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {new Date(badge.unlocked_at).toLocaleDateString('pt-BR')}
                    </p>
                    {badge.credits_awarded > 0 && (
                      <p className="text-xs text-amber-500">+{badge.credits_awarded} créditos</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {level.xp_required > 0 ? `${level.xp_required.toLocaleString('pt-BR')} XP` : '—'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
