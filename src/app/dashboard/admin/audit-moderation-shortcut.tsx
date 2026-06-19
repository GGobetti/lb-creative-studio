import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'

export function AuditModerationShortcut() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Link
        href="/dashboard/admin/audit-moderation"
        className="flex items-center justify-between p-4 rounded-2xl border-2 border-warning/30 bg-gradient-to-r from-warning/5 to-transparent hover:from-warning/10 hover:border-warning/50 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} className="text-warning" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Moderação de Auditorias</p>
            <p className="text-xs text-muted-foreground">Revisar e aprovar votações do Quality Audit</p>
          </div>
        </div>
        <div className="text-xs font-semibold text-warning opacity-0 group-hover:opacity-100 transition-opacity">
          Acessar →
        </div>
      </Link>
    </motion.div>
  )
}
