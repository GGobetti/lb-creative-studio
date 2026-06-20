'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/store'
import dynamic from 'next/dynamic'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

type Period = '4w' | '3m' | 'all'
type View = 'cumulative' | 'activity'

const GAME_COLORS: Record<string, string> = {
  'photo-match':   '#8b5cf6',
  'tag-detective': '#06b6d4',
  'category-sort': '#f59e0b',
  'quality-audit': '#10b981',
}

const GAME_LABELS: Record<string, string> = {
  'photo-match':   'PhotoMatch',
  'tag-detective': 'TagDetective',
  'category-sort': 'CategorySort',
  'quality-audit': 'QualityAudit',
}

interface XpTx {
  xp_amount: number
  game_type: string
  source: string
  created_at: string
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function XpChart() {
  const { profile } = useAppStore()
  const [txs, setTxs] = useState<XpTx[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('cumulative')
  const [period, setPeriod] = useState<Period>('3m')

  useEffect(() => {
    if (!profile?.id) return
    const supabase = getSupabaseBrowser()
    supabase
      .from('xp_transactions')
      .select('xp_amount, game_type, source, created_at')
      .eq('user_id', profile.id)
      .eq('source', 'earned')
      .order('created_at', { ascending: true })
      .then(({ data }: { data: XpTx[] | null }) => {
        setTxs(data || [])
        setLoading(false)
      })
  }, [profile?.id])

  const filtered = (() => {
    const now = Date.now()
    if (period === '4w') return txs.filter((t) => now - new Date(t.created_at).getTime() <= 28 * 86400000)
    if (period === '3m') return txs.filter((t) => now - new Date(t.created_at).getTime() <= 90 * 86400000)
    return txs
  })()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cumulativeOption: any = (() => {
    let total = 0
    const points = filtered.map((t) => {
      total += t.xp_amount
      return [t.created_at, total]
    })
    return {
      backgroundColor: 'transparent',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: 'axis', formatter: (p: any) => `${new Date(p[0].axisValue).toLocaleDateString('pt-BR')} — ${p[0].value[1].toLocaleString('pt-BR')} XP` },
      xAxis: { type: 'time', axisLabel: { color: '#6b7280', fontSize: 11 }, axisLine: { lineStyle: { color: '#374151' } } },
      yAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => v.toLocaleString('pt-BR') }, splitLine: { lineStyle: { color: '#1f2937' } } },
      grid: { left: 55, right: 20, top: 20, bottom: 40 },
      series: [{
        type: 'line',
        data: points,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#f59e0b' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.3)' }, { offset: 1, color: 'rgba(245,158,11,0)' }] } },
      }],
    }
  })()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activityOption: any = (() => {
    const weekMap: Record<string, Record<string, number>> = {}
    for (const t of filtered) {
      const w = isoWeek(new Date(t.created_at))
      weekMap[w] = weekMap[w] || {}
      weekMap[w][t.game_type] = (weekMap[w][t.game_type] || 0) + t.xp_amount
    }
    const weeks = Object.keys(weekMap).sort()
    const gameTypes = ['photo-match', 'tag-detective', 'category-sort', 'quality-audit']
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: gameTypes.map((g) => GAME_LABELS[g]), textStyle: { color: '#9ca3af', fontSize: 11 }, bottom: 0 },
      xAxis: { type: 'category', data: weeks, axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: '#374151' } } },
      yAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#1f2937' } } },
      grid: { left: 50, right: 20, top: 20, bottom: 60 },
      series: gameTypes.map((g) => ({
        name: GAME_LABELS[g],
        type: 'bar',
        stack: 'total',
        data: weeks.map((w) => weekMap[w]?.[g] || 0),
        itemStyle: { color: GAME_COLORS[g] },
      })),
    }
  })()

  if (loading) return (
    <div className="rounded-2xl border border-border bg-card p-6 h-64 flex items-center justify-center text-muted-foreground text-sm">
      Carregando gráfico...
    </div>
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Histórico de XP
        </h3>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted text-xs">
            {(['cumulative', 'activity'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md transition-colors ${view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {v === 'cumulative' ? 'Acumulado' : 'Atividade'}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted text-xs">
            {(['4w', '3m', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2 py-1 rounded-md transition-colors ${period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {p === '4w' ? '4 sem' : p === '3m' ? '3 meses' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ReactECharts
        option={view === 'cumulative' ? cumulativeOption : activityOption}
        style={{ height: 260 }}
        theme="dark"
      />
    </div>
  )
}
