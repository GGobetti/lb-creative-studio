'use client'

import type { XpSummary } from '@/types/xp'
import { Flame } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpHeroCard({ summary }: Props) {
  const { current_level, next_level, xp_earned_total, current_streak_weeks, best_streak_weeks } = summary

  const progressPct = next_level
    ? Math.min(
        100,
        Math.round(
          ((xp_earned_total - current_level.xp_required) /
            (next_level.xp_required - current_level.xp_required)) *
            100
        )
      )
    : 100

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="text-5xl">{current_level.badge_icon}</div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-foreground">{current_level.name}</h2>
          <p className="text-sm text-muted-foreground">
            {xp_earned_total.toLocaleString('pt-BR')} XP acumulados
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <Flame size={20} className="text-orange-500" />
          <span className="text-2xl font-black text-orange-500">{current_streak_weeks}</span>
          <span className="text-xs text-muted-foreground">
            {current_streak_weeks === 1 ? 'semana' : 'semanas'}
          </span>
          {best_streak_weeks > 0 && (
            <span className="text-xs text-muted-foreground/50">
              recorde: {best_streak_weeks}
            </span>
          )}
        </div>
      </div>

      {next_level && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{current_level.name}</span>
            <span>{next_level.name} — {next_level.xp_required.toLocaleString('pt-BR')} XP</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {progressPct}% — faltam{' '}
            {(next_level.xp_required - xp_earned_total).toLocaleString('pt-BR')} XP
            {next_level.credits_reward > 0 && (
              <> · desbloqueia {next_level.credits_reward} créditos</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
