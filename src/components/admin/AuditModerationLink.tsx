import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export function AuditModerationLink() {
  return (
    <Link
      href="/dashboard/admin/audit-moderation"
      className="flex items-center gap-3 p-4 rounded-xl border-2 border-warning/30 bg-warning/5 hover:bg-warning/10 hover:border-warning/50 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
        <ShieldCheck size={20} className="text-warning" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Moderação de Auditorias</p>
        <p className="text-xs text-muted-foreground">Revisar votações do Quality Audit (70% consenso)</p>
      </div>
    </Link>
  )
}
