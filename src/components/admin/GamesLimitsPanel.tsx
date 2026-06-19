'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Save, AlertCircle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyLimit {
  max_actions_per_day: number
  max_credits_per_day: number
}

interface RewardConfig {
  game_type: string
  actions_per_reward: number
  credits_per_reward: number
}

export function GamesLimitsPanel() {
  const supabase = getSupabaseBrowser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dailyLimit, setDailyLimit] = useState<DailyLimit>({
    max_actions_per_day: 100,
    max_credits_per_day: 500,
  })

  const [rewards, setRewards] = useState<RewardConfig[]>([
    { game_type: 'photo-match', actions_per_reward: 5, credits_per_reward: 10 },
    { game_type: 'tag-detective', actions_per_reward: 8, credits_per_reward: 5 },
    { game_type: 'category-sort', actions_per_reward: 3, credits_per_reward: 25 },
    { game_type: 'quality-audit', actions_per_reward: 10, credits_per_reward: 50 },
  ])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load daily limits
      const { data: limits } = await supabase
        .from('game_daily_limits')
        .select('*')
        .limit(1)
        .single()

      if (limits) {
        setDailyLimit({
          max_actions_per_day: limits.max_actions_per_day,
          max_credits_per_day: limits.max_credits_per_day,
        })
      }

      // Load reward configs
      const { data: rewardData } = await supabase
        .from('game_rewards_config')
        .select('*')
        .order('game_type')

      if (rewardData) {
        setRewards(rewardData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sessão expirada')

      const res = await fetch('/api/games/admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ dailyLimit, rewards }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Erro desconhecido')
      }

      alert('Configurações salvas com sucesso!')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error)
      console.error('Error saving:', msg)
      alert('Erro ao salvar: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 bg-card border border-border rounded-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const gameLabels: Record<string, string> = {
    'photo-match': '📸 Photo Match',
    'tag-detective': '🔍 Tag Detective',
    'category-sort': '📁 Category Sort',
    'quality-audit': '✅ Quality Audit',
  }

  return (
    <div className="space-y-6">
      {/* Daily Limits Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <AlertCircle size={20} className="text-warning" />
          <h3 className="text-lg font-bold text-foreground">Limites Diários Globais</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Máximos permitidos por usuário, por dia, em todos os games
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Máx. Ações por Dia
            </label>
            <input
              type="number"
              value={dailyLimit.max_actions_per_day}
              onChange={(e) =>
                setDailyLimit({
                  ...dailyLimit,
                  max_actions_per_day: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Após atingir esse limite, o usuário não pode mais fazer ações neste dia
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Máx. Créditos por Dia
            </label>
            <input
              type="number"
              value={dailyLimit.max_credits_per_day}
              onChange={(e) =>
                setDailyLimit({
                  ...dailyLimit,
                  max_credits_per_day: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Máximo de créditos que um usuário pode ganhar em um dia
            </p>
          </div>
        </div>
      </motion.div>

      {/* Reward Config Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <Zap size={20} className="text-primary" />
          <h3 className="text-lg font-bold text-foreground">Recompensas por Game</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Configure a cada quantas ações o usuário ganha créditos
        </p>

        <div className="space-y-4">
          {rewards.map((reward) => (
            <div
              key={reward.game_type}
              className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3"
            >
              <h4 className="font-semibold text-foreground">
                {gameLabels[reward.game_type]}
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Ações por Recompensa
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reward.actions_per_reward}
                    onChange={(e) =>
                      setRewards(
                        rewards.map((r) =>
                          r.game_type === reward.game_type
                            ? { ...r, actions_per_reward: parseInt(e.target.value) || 1 }
                            : r
                        )
                      )
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Créditos Ganhos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reward.credits_per_reward}
                    onChange={(e) =>
                      setRewards(
                        rewards.map((r) =>
                          r.game_type === reward.game_type
                            ? { ...r, credits_per_reward: parseInt(e.target.value) || 1 }
                            : r
                        )
                      )
                    }
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                A cada {reward.actions_per_reward} ações neste game, o usuário ganha{' '}
                <span className="text-primary font-semibold">{reward.credits_per_reward} créditos</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.button
        onClick={handleSave}
        disabled={saving}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
          saving
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        )}
      >
        <Save size={18} />
        {saving ? 'Salvando...' : 'Salvar Configurações'}
      </motion.button>
    </div>
  )
}
