'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Zap, Flame, Camera, Tag, LayoutGrid, ShieldCheck } from 'lucide-react'
import { useConfiguratorStore } from '@/store/store'
import { BADGES } from '@/types/games'
import { getSupabaseBrowser } from '@/lib/supabase'

const GAMES = [
  {
    id: 'photo-match',
    href: '/dashboard/games/photo-match',
    icon: Camera,
    title: 'Photo Match',
    description: 'A foto representa o modelo?',
    credits: 10,
    color: 'text-primary',
    bg: 'bg-primary/8',
    border: 'border-primary/20 hover:border-primary/50',
    glow: 'hover:shadow-primary',
  },
  {
    id: 'tag-detective',
    href: '/dashboard/games/tag-detective',
    icon: Tag,
    title: 'Tag Detective',
    description: 'Remova as tags que não fazem sentido',
    credits: 5,
    color: 'text-accent-foreground',
    bg: 'bg-accent',
    border: 'border-accent-foreground/20 hover:border-accent-foreground/50',
    glow: '',
  },
  {
    id: 'category-sort',
    href: '/dashboard/games/category-sort',
    icon: LayoutGrid,
    title: 'Category Sort',
    description: 'Classifique modelos nas categorias certas',
    credits: 25,
    color: 'text-warning',
    bg: 'bg-warning/8',
    border: 'border-warning/20 hover:border-warning/50',
    glow: '',
  },
  {
    id: 'quality-audit',
    href: '/dashboard/games/quality-audit',
    icon: ShieldCheck,
    title: 'Quality Audit',
    description: 'Aprove ou rejeite uploads da comunidade',
    credits: 15,
    color: 'text-success',
    bg: 'bg-success/8',
    border: 'border-success/20 hover:border-success/50',
    glow: '',
  },
]

export function GameHub() {
  const { profile } = useConfiguratorStore()
  const [streak, setStreak] = useState(0)
  const [points, setPoints] = useState(0)

  useEffect(() => {
    if (!profile?.id) return

    const loadStats = async () => {
      try {
        const { data, error } = await getSupabaseBrowser()
          .from('game_user_stats')
          .select('total_points, current_streak')
          .eq('user_id', profile.id)
          .single()

        if (error) {
          // If no record found, that's OK - user hasn't played yet
          if (error.code === 'PGRST116') {
            setPoints(0)
            setStreak(0)
            return
          }
          console.error('Error loading game stats:', error)
          return
        }

        if (data) {
          setPoints(data.total_points || 0)
          setStreak(data.current_streak || 0)
        }
      } catch (err) {
        console.error('Failed to load game stats:', err)
      }
    }

    loadStats()
  }, [profile?.id])

  const currentBadge = [...BADGES].reverse().find((b) => points >= b.requiredPoints)
  const nextBadge = BADGES.find((b) => points < b.requiredPoints)
  const progressPct = nextBadge
    ? Math.min(100, Math.round(((points - (currentBadge?.requiredPoints ?? 0)) / (nextBadge.requiredPoints - (currentBadge?.requiredPoints ?? 0))) * 100))
    : 100

  const badgeEmoji: Record<string, string> = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    diamond: '💎',
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl gradient-text">Gaming Lab XP</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajude a melhorar o catálogo e ganhe créditos
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-sm font-bold px-3 py-2 rounded-xl badge-pulse">
          <Zap size={14} />
          {profile?.credits ?? 0}
        </div>
      </div>

      {/* Streak banner */}
      {streak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-warning/8 border border-warning/25 rounded-2xl px-4 py-3"
        >
          <Flame size={18} className="text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              🔥 Streak de {streak} {streak === 1 ? 'dia' : 'dias'}!
            </p>
            <p className="text-xs text-muted-foreground">Multiplicador 2× ativo hoje</p>
          </div>
        </motion.div>
      )}

      {/* Game cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GAMES.map((game, i) => {
          const Icon = game.icon
          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                href={game.href}
                className={`flex flex-col gap-3 p-4 rounded-2xl border-2 bg-card transition-all card-hover ${game.border}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl ${game.bg} flex items-center justify-center`}>
                    <Icon size={20} className={game.color} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${game.color} bg-current/10 px-2.5 py-1 rounded-full`}
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <span className={`flex items-center gap-1 ${game.color}`}>
                      <Zap size={11} />
                      +{game.credits} por acerto
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-heading text-base font-bold text-foreground">{game.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{game.description}</p>
                </div>

                <div className={`text-xs font-semibold ${game.color} mt-auto`}>
                  Jogar →
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* Badge progress */}
      {nextBadge && (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-label text-muted-foreground">Progresso de Badge</p>
            <span className="text-xs text-muted-foreground">{points} pts</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{badgeEmoji[currentBadge?.tier ?? 'bronze']}</span>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-foreground font-medium">{currentBadge?.name ?? 'Sem badge'}</span>
                <span className="text-muted-foreground">
                  → {nextBadge.name} ({nextBadge.requiredPoints} pts)
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
            <span className="text-2xl opacity-40">{badgeEmoji[nextBadge.tier]}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Próximo poder: <span className="text-foreground font-medium">{nextBadge.unlockedPower}</span>
          </p>
        </div>
      )}

      {/* Leaderboard teaser */}
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">
          🏆 Leaderboard semanal em breve
        </p>
      </div>
    </div>
  )
}
