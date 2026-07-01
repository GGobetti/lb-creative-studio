'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/translations'

interface AuditStats {
  contested: number
  pending: number
  approved: number
  rejected: number
}

export function AuditStatsCard() {
  const { t } = useTranslation()
  const supabase = getSupabaseBrowser()
  const [stats, setStats] = useState<AuditStats>({
    contested: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('stl_audit_results')
          .select('final_status')

        if (error) throw error

        const counts = {
          contested: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }

        data?.forEach((row: { final_status: string }) => {
          counts[row.final_status as keyof AuditStats]++
        })

        setStats(counts)
      } catch (error) {
        console.error('Error fetching audit stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [supabase])

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card animate-pulse h-32" />
    )
  }

  return (
    <Link href="/dashboard/admin/audit-moderation">
      <div className="p-4 rounded-lg border border-border bg-card hover:border-warning/50 hover:bg-warning/5 transition-all cursor-pointer">
        <h3 className="text-sm font-semibold mb-3">{t('gameAuditStats.title', 'Auditorias Pendentes')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.contested > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/20">
              <AlertTriangle size={14} className="text-destructive" />
              <div>
                <p className="text-xs text-destructive font-bold">{stats.contested}</p>
                <p className="text-[10px] text-muted-foreground">{t('gameAuditStats.contested', 'Contestadas')}</p>
              </div>
            </div>
          )}
          {stats.pending > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-warning/5 border border-warning/20">
              <Clock size={14} className="text-warning" />
              <div>
                <p className="text-xs text-warning font-bold">{stats.pending}</p>
                <p className="text-[10px] text-muted-foreground">{t('gameAuditStats.pending', 'Pendentes')}</p>
              </div>
            </div>
          )}
          {stats.approved > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-success/5 border border-success/20">
              <CheckCircle2 size={14} className="text-success" />
              <div>
                <p className="text-xs text-success font-bold">{stats.approved}</p>
                <p className="text-[10px] text-muted-foreground">{t('gameAuditStats.approved', 'Aprovadas')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
