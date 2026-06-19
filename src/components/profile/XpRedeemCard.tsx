'use client'

import { useState, useEffect } from 'react'
import type { XpSummary, XpConfig } from '@/types/xp'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'
import { Loader2, ArrowRightLeft } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpRedeemCard({ summary }: Props) {
  const { refreshXpSummary, refreshCredits } = useConfiguratorStore()
  const [config, setConfig] = useState<XpConfig | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_config')
      .select('*')
      .single()
      .then(({ data }: { data: XpConfig | null }) => { if (data) setConfig(data) })
  }, [])

  const xpNum = parseInt(amount) || 0
  const creditsPreview = config ? Math.floor(xpNum / config.xp_to_credits_rate) : 0
  const canRedeem = config && xpNum >= config.min_redeem_xp && xpNum <= summary.xp_total

  const handleRedeem = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sessão expirada'); setLoading(false); return }

      const res = await fetch('/api/games/redeem-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ xp_to_redeem: xpNum }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); setShowConfirm(false); return }

      setSuccess(`+${data.credits_earned} créditos adicionados!`)
      setAmount('')
      setShowConfirm(false)
      await refreshXpSummary()
      // Refresh credits in store
      const { data: profileData } = await supabase.from('profiles').select('credits').single()
      if (profileData) refreshCredits(profileData.credits)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Resgatar XP por Créditos
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">XP disponível</span>
          <span className="font-bold text-foreground">{summary.xp_total.toLocaleString('pt-BR')} XP</span>
        </div>
        {config && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa</span>
            <span className="text-muted-foreground">
              {config.xp_to_credits_rate} XP = 1 crédito
              <span className="ml-2 text-muted-foreground/50">(mín. {config.min_redeem_xp} XP)</span>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); setSuccess(null) }}
            placeholder={`Quantidade de XP (mín. ${config?.min_redeem_xp ?? 100})`}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => { setShowConfirm(true); setError(null) }}
            disabled={!canRedeem}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
          >
            <ArrowRightLeft size={15} />
            Resgatar
          </button>
        </div>
        {xpNum > 0 && config && (
          <p className="text-xs text-muted-foreground">
            {xpNum.toLocaleString('pt-BR')} XP → <span className="font-semibold text-amber-500">{creditsPreview} créditos</span>
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <h4 className="text-lg font-bold text-foreground">Confirmar resgate</h4>
            <p className="text-sm text-muted-foreground">
              Trocar <span className="font-semibold text-foreground">{xpNum.toLocaleString('pt-BR')} XP</span> por{' '}
              <span className="font-semibold text-amber-500">{creditsPreview} créditos</span>?
              <br />Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleRedeem}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
