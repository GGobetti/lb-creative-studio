'use client'

// src/components/CreditModal.tsx
// Dynamic pricing modal — loads plans from Supabase

import { useState, useEffect } from 'react'
import { Zap, X, Check, Loader2, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { CatalogItem } from '@/lib/supabase'
import { triggerConfetti } from '@/lib/confetti'
import { motion, AnimatePresence } from 'framer-motion'

interface PricingPlan {
  id: number
  name: string
  description?: string
  credits: number
  price_cents: number
  stripe_price_id: string
  active: boolean
}

interface CreditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: CatalogItem
}

export function CreditModal({ open, onOpenChange, item }: CreditModalProps) {
  const { profile, refreshCredits } = useAppStore()
  const [packages, setPackages] = useState<PricingPlan[]>([])
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plansLoading, setPlansLoading] = useState(true)

  // Load pricing plans from Supabase
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data, error: err } = await supabase
          .from('pricing_plans')
          .select('*')
          .eq('active', true)
          .order('price_cents', { ascending: true })

        if (err) throw err
        setPackages(data || [])
        if (data && data.length > 0) {
          setSelectedPkgId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to load pricing plans:', err)
      } finally {
        setPlansLoading(false)
      }
    }

    if (open) {
      fetchPlans()
    }
  }, [open])

  const plan = profile?.plan || 'free'
  const currentCost = item
    ? plan === 'max'
      ? item.price_max
      : plan === 'pro'
        ? item.price_pro
        : item.price_free ?? item.price_in_credits
    : 0

  const selectedPackage = packages.find((p) => p.id === selectedPkgId)
  const userCredits = profile?.credits ?? 0
  const isInsufficientUpgrade = selectedPackage && selectedPackage.credits <= userCredits

  const handlePurchase = async () => {
    if (!selectedPackage) {
      setError('Selecione um pacote')
      return
    }

    if (isInsufficientUpgrade) {
      setError(`Você já tem ${userCredits} créditos. Escolha um pacote com mais créditos.`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPackage.id }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha na compra')

      refreshCredits((profile?.credits ?? 0) + selectedPackage.credits)
      setSuccess(true)
      triggerConfetti()

      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-md bg-[#0f0f2a]/95 border border-white/10 rounded-2xl
                            shadow-2xl shadow-black/70 overflow-hidden backdrop-blur-lg z-10"
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={18} className="text-violet-400" />
                    <h2 className="text-lg font-bold text-white">Créditos Insuficientes</h2>
                  </div>
                  <p className="text-sm text-white/50 text-left">
                    {item
                      ? `Exportar "${item.title}" custa ${currentCost} crédito${currentCost !== 1 ? 's' : ''}.`
                      : 'Você precisa de mais créditos para continuar.'
                    }
                    {profile && (
                      <span className="block mt-0.5">
                        Saldo atual: <strong className="text-white">{profile.credits}</strong> crédito{profile.credits !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Mock badge */}
            <div className="mx-6 mt-4 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20
                            rounded-lg text-xs text-amber-300">
              <Sparkles size={12} />
              Simulação — sem cobrança real. Créditos adicionados instantaneamente.
            </div>

            {/* Packages */}
            <div className="p-6 space-y-3">
              {plansLoading ? (
                <div className="flex items-center justify-center py-8 text-white/50">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : packages.length === 0 ? (
                <p className="text-center text-white/50 text-sm py-8">Nenhum plano disponível</p>
              ) : (
                packages.map((pkg) => {
                  const priceInReais = (pkg.price_cents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })

                  return (
                    <motion.button
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      whileHover={{ scale: 1.015, y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 relative overflow-hidden cursor-pointer
                        ${selectedPkgId === pkg.id
                          ? 'bg-gradient-to-r from-violet-700/40 to-indigo-700/40 border-violet-500/50 shadow-lg shadow-violet-500/15'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                        }
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                        ${selectedPkgId === pkg.id ? 'border-white bg-white' : 'border-white/30'}
                      `}>
                        {selectedPkgId === pkg.id && <Check size={12} className="text-violet-700" />}
                      </div>

                      <div className="flex-1 text-left">
                        <span className="font-semibold text-white">{pkg.name}</span>
                        <span className="text-sm text-white/60 block">
                          {pkg.credits === 999 ? '∞ créditos' : `${pkg.credits} créditos`}
                        </span>
                      </div>

                      <span className="text-lg font-bold text-white">{priceInReais}</span>
                    </motion.button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              {error && (
                <p className="text-sm text-red-400 mb-3 text-center">{error}</p>
              )}

              {success ? (
                <div className="flex items-center justify-center gap-2 py-3 text-green-400 font-medium animate-pulse">
                  <Check size={18} />
                  Créditos adicionados! Fechando...
                </div>
              ) : (
                <motion.button
                  id="btn-purchase-credits"
                  onClick={handlePurchase}
                  disabled={loading || isInsufficientUpgrade}
                  whileHover={{ scale: !loading && !isInsufficientUpgrade ? 1.02 : 1 }}
                  whileTap={{ scale: !loading && !isInsufficientUpgrade ? 0.98 : 1 }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl
                             bg-gradient-to-r from-violet-600 to-indigo-600
                             hover:from-violet-500 hover:to-indigo-500
                             text-white font-semibold text-sm
                             transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-lg shadow-violet-500/20 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando...
                    </>
                  ) : isInsufficientUpgrade ? (
                    <>
                      <Zap size={16} />
                      Plano insuficiente
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Comprar {selectedPackage?.credits === 999 ? '∞' : selectedPackage?.credits} Créditos
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
