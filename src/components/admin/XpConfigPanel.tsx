'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { XpConfig, XpLevel, GameRewardsConfig } from '@/types/xp'
import { Save, Loader2, Check } from 'lucide-react'

export function XpConfigPanel() {
  const [config, setConfig] = useState<XpConfig | null>(null)
  const [levels, setLevels] = useState<XpLevel[]>([])
  const [gameConfigs, setGameConfigs] = useState<GameRewardsConfig[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    Promise.all([
      supabase.from('xp_config').select('*').single(),
      supabase.from('xp_levels').select('*').order('level'),
      supabase.from('game_rewards_config').select('game_type, actions_per_reward, credits_per_reward, xp_per_action').order('game_type'),
    ]).then(([c, l, g]) => {
      if (c.data) setConfig(c.data as XpConfig)
      if (l.data) setLevels(l.data as XpLevel[])
      if (g.data) setGameConfigs(g.data as GameRewardsConfig[])
    })
  }, [])

  const saveConfig = async () => {
    if (!config) return
    setSaving('config')
    await getSupabaseBrowser().from('xp_config').update({
      xp_to_credits_rate: config.xp_to_credits_rate,
      min_redeem_xp: config.min_redeem_xp,
      max_redeem_per_day: config.max_redeem_per_day,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(null)
    setSaved('config')
    setTimeout(() => setSaved(null), 2000)
  }

  const saveLevel = async (level: XpLevel) => {
    setSaving(`level-${level.level}`)
    await getSupabaseBrowser().from('xp_levels').update({
      name: level.name,
      xp_required: level.xp_required,
      badge_icon: level.badge_icon,
      badge_color: level.badge_color,
      credits_reward: level.credits_reward,
    }).eq('level', level.level)
    setSaving(null)
    setSaved(`level-${level.level}`)
    setTimeout(() => setSaved(null), 2000)
  }

  const saveGameConfig = async (gc: GameRewardsConfig) => {
    setSaving(`game-${gc.game_type}`)
    await getSupabaseBrowser().from('game_rewards_config').update({
      xp_per_action: gc.xp_per_action,
    }).eq('game_type', gc.game_type)
    setSaving(null)
    setSaved(`game-${gc.game_type}`)
    setTimeout(() => setSaved(null), 2000)
  }

  const updateLevel = (index: number, field: keyof XpLevel, value: string | number) => {
    setLevels((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  const updateGame = (index: number, value: number) => {
    setGameConfigs((prev) => prev.map((g, i) => i === index ? { ...g, xp_per_action: value } : g))
  }

  if (!config) return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={18} />Carregando...</div>

  return (
    <div className="flex flex-col gap-6">
      {/* Global config */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">Configuração Global de XP</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Taxa XP → Créditos', field: 'xp_to_credits_rate' as const, hint: 'XP ÷ taxa = créditos' },
            { label: 'Mínimo por resgate (XP)', field: 'min_redeem_xp' as const, hint: 'Ex: 100' },
            { label: 'Limite diário de resgate (XP)', field: 'max_redeem_per_day' as const, hint: 'Ex: 5000' },
          ].map(({ label, field, hint }) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              <input
                type="number"
                value={(config[field] as number) ?? 0}
                onChange={(e) => setConfig((c) => c ? { ...c, [field]: parseFloat(e.target.value) || 0 } : c)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground/50 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
        <button
          onClick={saveConfig}
          disabled={saving === 'config'}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {saving === 'config' ? <Loader2 size={14} className="animate-spin" /> : saved === 'config' ? <Check size={14} /> : <Save size={14} />}
          {saved === 'config' ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* XP per game */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">XP por Ação (por jogo)</h3>
        <div className="flex flex-col gap-3">
          {gameConfigs.map((gc, i) => (
            <div key={gc.game_type} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-40 shrink-0 capitalize">
                {gc.game_type.replace('-', ' ')}
              </span>
              <input
                type="number"
                value={gc.xp_per_action ?? 0}
                onChange={(e) => updateGame(i, parseInt(e.target.value) || 0)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground">XP / ação</span>
              <button
                onClick={() => saveGameConfig(gc)}
                disabled={saving === `game-${gc.game_type}`}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-medium hover:bg-muted/80 disabled:opacity-60"
              >
                {saving === `game-${gc.game_type}` ? <Loader2 size={12} className="animate-spin" /> : saved === `game-${gc.game_type}` ? <Check size={12} /> : <Save size={12} />}
                {saved === `game-${gc.game_type}` ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Levels */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">Níveis e Badges</h3>
        <div className="flex flex-col gap-3">
          {levels.map((level, i) => (
            <div key={level.level} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-lg">{level.badge_icon}</span>
                <input
                  value={level.name}
                  onChange={(e) => updateLevel(i, 'name', e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Nome"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">XP necessário</label>
                <input type="number" value={level.xp_required ?? 0}
                  onChange={(e) => updateLevel(i, 'xp_required', parseInt(e.target.value) || 0)}
                  disabled={level.level === 1}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Ícone (emoji)</label>
                <input value={level.badge_icon}
                  onChange={(e) => updateLevel(i, 'badge_icon', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Créditos reward</label>
                <input type="number" value={level.credits_reward ?? 0}
                  onChange={(e) => updateLevel(i, 'credits_reward', parseInt(e.target.value) || 0)}
                  disabled={level.level === 1}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <button
                onClick={() => saveLevel(level)}
                disabled={saving === `level-${level.level}`}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
              >
                {saving === `level-${level.level}` ? <Loader2 size={12} className="animate-spin" /> : saved === `level-${level.level}` ? <Check size={12} /> : <Save size={12} />}
                {saved === `level-${level.level}` ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
