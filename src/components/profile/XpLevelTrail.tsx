'use client'

import type { XpSummary, XpLevel } from '@/types/xp'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpLevelTrail({ summary }: Props) {
  const [allLevels, setAllLevels] = useState<XpLevel[]>([])

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_levels')
      .select('*')
      .order('level')
      .then(({ data }: { data: XpLevel[] | null }) => { if (data) setAllLevels(data) })
  }, [])

  const unlockedLevels = new Set(summary.badges.map((b) => b.level))

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
        Trilha de Níveis
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {allLevels.map((level, idx) => {
          const unlocked = unlockedLevels.has(level.level)
          const isCurrent = level.level === summary.current_level.level
          const badge = summary.badges.find((b) => b.level === level.level)

          return (
            <div key={level.level} className="flex flex-col items-center gap-2 min-w-[80px]">
              {/* Connector line */}
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 ${unlocked ? 'bg-amber-500/60' : 'bg-muted'}`} />
                )}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all
                    ${isCurrent ? 'border-amber-500 shadow-lg shadow-amber-500/30 scale-110' : ''}
                    ${unlocked && !isCurrent ? 'border-border bg-card' : ''}
                    ${!unlocked ? 'border-muted bg-muted/30 grayscale opacity-50' : ''}
                  `}
                >
                  {unlocked ? level.badge_icon : <Lock size={16} className="text-muted-foreground" />}
                </div>
                {idx < allLevels.length - 1 && (
                  <div className={`flex-1 h-0.5 ${unlocked ? 'bg-amber-500/60' : 'bg-muted'}`} />
                )}
              </div>
              <span className={`text-xs font-medium text-center ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                {level.name}
              </span>
              {badge ? (
                <span className="text-xs text-muted-foreground/60">
                  {new Date(badge.unlocked_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/40">
                  {level.xp_required > 0 ? `${level.xp_required.toLocaleString('pt-BR')} XP` : '—'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
