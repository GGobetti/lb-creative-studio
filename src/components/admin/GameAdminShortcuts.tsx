import Link from 'next/link'
import { motion } from 'framer-motion'
import { Settings, ShieldCheck, Zap } from 'lucide-react'

export function GameAdminShortcuts() {
  const shortcuts = [
    {
      href: '/dashboard/admin/games',
      icon: Zap,
      title: 'Admin de Games',
      description: 'Configurar limites e recompensas diárias',
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
    },
    {
      href: '/dashboard/admin/audit-moderation',
      icon: ShieldCheck,
      title: 'Moderação de Auditorias',
      description: 'Revisar e aprovar votações contestadas',
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {shortcuts.map((shortcut, i) => {
        const Icon = shortcut.icon
        return (
          <motion.div
            key={shortcut.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link
              href={shortcut.href}
              className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] group ${shortcut.bg} ${shortcut.border} hover:border-current`}
            >
              <div className={`w-12 h-12 rounded-xl ${shortcut.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon size={24} className={shortcut.color} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{shortcut.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{shortcut.description}</p>
              </div>
              <div className={`text-lg font-bold ${shortcut.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                →
              </div>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
