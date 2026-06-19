'use client'

// src/components/CreditModal.tsx
// Low-balance modal with mock credit package selection.

import { useState } from 'react'
import { Zap, X, Check, Loader2, Sparkles } from 'lucide-react'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { CatalogItem } from '@/lib/supabase'
import { triggerConfetti } from '@/lib/confetti'
import { motion, AnimatePresence } from 'framer-motion'

const PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    credits: 10,
    price: 'R$ 9,90',
    popular: false,
    color: 'from-slate-700 to-slate-600',
    border: 'border-white/10',
  },
  {
    id: 'pro',
    label: 'Pro',
    credits: 30,
    price: 'R$ 24,90',
    popular: true,
    color: 'from-violet-700 to-indigo-700',
    border: 'border-violet-500/50',
  },
  {
    id: 'studio',
    label: 'Studio',
    credits: 100,
    price: 'R$ 69,90',
    popular: false,
    color: 'from-amber-700 to-orange-700',
    border: 'border-amber-500/30',
  },
]

interface CreditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: CatalogItem
}

export function CreditModal({ open, onOpenChange, item }: CreditModalProps) {
  const { profile, refreshCredits } = useConfiguratorStore()
  const [selectedPkg, setSelectedPkg] = useState('pro')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = profile?.plan || 'free'
  const currentCost = item
    ? plan === 'max'
      ? item.price_max
      : plan === 'pro'
        ? item.price_pro
        : item.price_free ?? item.price_in_credits
    : 0

  const handlePurchase = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-credits`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ package_id: selectedPkg }),
        },
      )

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha na compra')

      const pkg = PACKAGES.find((p) => p.id === selectedPkg)!
      refreshCredits((profile?.credits ?? 0) + pkg.credits)
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
              {PACKAGES.map((pkg) => (
                <motion.button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg.id)}
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 relative overflow-hidden cursor-pointer
                    ${selectedPkg === pkg.id
                      ? `bg-gradient-to-r ${pkg.color} ${pkg.border} shadow-lg shadow-indigo-500/15`
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                    ${selectedPkg === pkg.id ? 'border-white bg-white' : 'border-white/30'}
                  `}>
                    {selectedPkg === pkg.id && <Check size={12} className="text-violet-700" />}
                  </div>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{pkg.label}</span>
                      {pkg.popular && (
                        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-white/60">
                      {pkg.credits} créditos
                    </span>
                  </div>

                  <span className="text-lg font-bold text-white">{pkg.price}</span>
                </motion.button>
              ))}
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
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
                  ) : (
                    <>
                      <Zap size={16} />
                      Comprar {PACKAGES.find((p) => p.id === selectedPkg)?.credits} Créditos
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
