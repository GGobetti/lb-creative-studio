'use client'

import { useEffect, useState } from 'react'
import { Trophy, Users } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

export function WeeklyLeaderboardTeaser() {
  const [activeCount, setActiveCount] = useState<number | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase
      .from('xp_transactions')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', new Date(
        Date.now() - ((new Date().getDay() || 7) - 1) * 86400000
      ).toISOString().split('T')[0])
      .then(({ data }: { data: { user_id: string }[] | null }) => {
        if (!data) return
        const unique = new Set(data.map((r: { user_id: string }) => r.user_id)).size
        setActiveCount(unique)
      })
  }, [])

  return (
    <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-2xl px-4 py-3">
      <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
        <Trophy size={18} className="text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Ranking Semanal</p>
        <p className="text-xs text-muted-foreground">
          {activeCount === null
            ? 'Carregando...'
            : `${activeCount} maker${activeCount !== 1 ? 's' : ''} ativo${activeCount !== 1 ? 's' : ''} essa semana`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Users size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Em breve</span>
      </div>
    </div>
  )
}
