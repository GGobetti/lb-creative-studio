"use client"

import { useAppStore } from "@/store/store"
import { Zap, Check, CreditCard, Loader2, Rocket, Crown, Star, Sparkles, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from "@/lib/translations"
import { useToast } from "@/components/ui/Toast"
import { PageHeader } from "@/components/ui/PageHeader"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { motion } from "framer-motion"
import { getSupabaseBrowser } from "@/lib/supabase"

interface PricingPlan {
  id: number
  name: string
  credits: number
  price_cents: number
  stripe_price_id: string
  active: boolean
}

const CREDIT_PACKAGES = [
  {
    id: 1,
    credits: 50,
    price: 10.00,
    popular: false,
    pricePerCredit: "R$ 0,20/crd",
  },
  {
    id: 2,
    credits: 200,
    price: 35.00,
    popular: true,
    pricePerCredit: "R$ 0,17/crd",
    saving: "15% off",
  },
  {
    id: 3,
    credits: 500,
    price: 80.00,
    popular: false,
    pricePerCredit: "R$ 0,16/crd",
    saving: "20% off",
  },
]

const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    icon: Star,
    color: "text-muted-foreground",
    borderColor: "border-border",
    bgColor: "bg-card",
    badgeVariant: "muted" as const,
    iconBg: "bg-muted",
    featureKeys: ["billing.freeFeature1", "billing.freeFeature2", "billing.freeFeature3", "billing.freeFeature4"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29.90,
    icon: Rocket,
    color: "text-primary",
    borderColor: "border-primary/40",
    bgColor: "bg-primary/3",
    badgeVariant: "default" as const,
    iconBg: "bg-primary/10",
    highlight: true,
    featureKeys: ["billing.proFeature1", "billing.proFeature2", "billing.proFeature3", "billing.proFeature4"],
  },
  {
    id: "max",
    name: "Max",
    price: 79.90,
    icon: Crown,
    color: "text-warning",
    borderColor: "border-warning/30",
    bgColor: "bg-warning/3",
    badgeVariant: "warning" as const,
    iconBg: "bg-warning/10",
    featureKeys: ["billing.maxFeature1", "billing.maxFeature2", "billing.maxFeature3", "billing.maxFeature4"],
  },
]

export default function BillingPage() {
  const { profile } = useAppStore()
  const { t, language } = useTranslation()
  const { toast } = useToast()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [creditPlans, setCreditPlans] = useState<PricingPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelConfirmed, setCancelConfirmed] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  // Load pricing plans from Supabase on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data, error } = await supabase
          .from('pricing_plans')
          .select('*')
          .eq('active', true)
          .lt('credits', 999) // Only credit packages, not subscriptions
          .order('price_cents', { ascending: true })

        if (error) throw error
        setCreditPlans(data || [])
      } catch (err) {
        console.error('Failed to load pricing plans:', err)
        // Fall back to hardcoded if fetch fails
        setCreditPlans(CREDIT_PACKAGES.map(p => ({
          id: p.id,
          name: `Pacote ${p.credits} Créditos`,
          credits: p.credits,
          price_cents: Math.round(p.price * 100),
          stripe_price_id: '',
          active: true,
        })))
      } finally {
        setPlansLoading(false)
      }
    }

    fetchPlans()
  }, [])

  const handleCheckout = async (planId: number) => {
    setLoadingId(String(planId))
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t("billing.errorCheckout"))
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      toast(err.message, "error")
    } finally {
      setLoadingId(null)
    }
  }

  const handleCancelClick = () => {
    setCancelConfirmed(false)
    setShowCancelDialog(true)
  }

  const handleUpgradeDowngrade = async (toplanId: number) => {
    setLoadingId(`change-${toplanId}`)
    try {
      // Use subscription plan ID, not profile plan (they can be out of sync)
      if (!subscription?.current_plan_id) {
        throw new Error("Nenhuma assinatura ativa")
      }

      const response = await fetch("/api/subscription-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPlanId: subscription.current_plan_id,
          toPlanId: toplanId,
        }),
      })

      const data = await response.json()
      console.log('Subscription change response:', { status: response.status, data, error: data.error })
      if (!response.ok) throw new Error(data.error || `Erro ao mudar plano (${response.status})`)

      const planName = toplanId === 5 ? "Max" : "Pro"
      const isUpgrade = toplanId > subscription.current_plan_id
      toast(
        isUpgrade
          ? `Upgraded para ${planName}! Cobrança iniciada.`
          : `Downgrade para ${planName} agendado para o próximo período!`,
        "success"
      )
      setShowCancelDialog(false)
    } catch (err: any) {
      toast(err.message, "error")
    } finally {
      setLoadingId(null)
    }
  }

  const handleCancelSubscription = async () => {
    setLoadingId("cancel")
    try {
      const response = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao cancelar")
      toast(data.message || "Assinatura cancelada", "success")
      setShowCancelDialog(false)
    } catch (err: any) {
      toast(err.message, "error")
    } finally {
      setLoadingId(null)
    }
  }

  const formatBRL = (value: number) =>
    new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
      style: "currency",
      currency: "BRL",
    }).format(value)

  const currentPlan = profile?.plan || "free"

  // Load subscription on mount
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await fetch('/api/subscription')
        const data = await response.json()
        setSubscription(data.subscription)
      } catch (err) {
        console.error('Failed to load subscription:', err)
      }
    }
    loadSubscription()
  }, [])

  const handleCreateTestSubscription = async () => {
    setSubscriptionLoading(true)
    try {
      const response = await fetch('/api/test/create-real-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      console.log('Create subscription response:', { status: response.status, data })
      if (!response.ok) throw new Error(data.error || 'Erro ao criar assinatura')
      toast('Assinatura criada no Stripe! Recarregando página em 2 segundos...', 'success')
      // Reload page after a delay to let webhook sync
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err: any) {
      console.error('Create subscription error:', err)
      toast(err.message, 'error')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={t("billing.title")}
        subtitle={t("billing.subtitle")}
        breadcrumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("billing.title") }]}
      />

      {/* Current status strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="col-span-1 sm:col-span-2 bg-card border border-border rounded-2xl p-5 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-primary fill-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-label text-muted-foreground mb-0.5">{t("billing.creditBalance")}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-heading text-3xl text-foreground">{profile?.credits ?? 0}</span>
              <span className="text-sm text-muted-foreground font-medium">{t("billing.creditsAvailable")}</span>
            </div>
          </div>
          <button
            onClick={() => handleCheckout(2)}
            disabled={loadingId !== null}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-primary shrink-0 disabled:opacity-50"
          >
            {loadingId === "2" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t("billing.reload")}
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            currentPlan === "max" ? "bg-warning/10" : currentPlan === "pro" ? "bg-primary/10" : "bg-muted"
          }`}>
            {currentPlan === "max" ? (
              <Crown className="w-6 h-6 text-warning" />
            ) : currentPlan === "pro" ? (
              <Rocket className="w-6 h-6 text-primary" />
            ) : (
              <Star className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-label text-muted-foreground mb-0.5">{t("billing.currentPlan")}</p>
            <div className="flex items-center gap-2">
              <span className="text-heading text-xl text-foreground capitalize">{currentPlan}</span>
              {currentPlan !== "free" && (
                <StatusBadge variant="success" dot size="sm">{t("billing.active")}</StatusBadge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading text-lg text-foreground">{t("billing.subscriptionPlans")}</h2>
          {currentPlan === "free" && process.env.NODE_ENV === "development" && (
            <button
              onClick={handleCreateTestSubscription}
              disabled={subscriptionLoading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {subscriptionLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  Criando...
                </>
              ) : (
                "🧪 Criar Assinatura Teste"
              )}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SUBSCRIPTION_PLANS.map((plan, idx) => {
            const isCurrentPlan = currentPlan === plan.id
            const Icon = plan.icon

            // Tier hierarchy: free (0) < pro (1) < max (2)
            const tierMap = { free: 0, pro: 1, max: 2 }
            const currentTier = tierMap[currentPlan as keyof typeof tierMap] || 0
            const targetTier = tierMap[plan.id as keyof typeof tierMap] || 0

            // Can't downgrade: if on Max/Pro, can't go to Pro/Free without canceling first
            const isDowngrade = targetTier < currentTier && currentTier > 0
            const isDisabledDowngrade = isDowngrade && !isCurrentPlan

            return (
              <motion.div
                key={plan.id}
                data-plan={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`relative flex flex-col rounded-2xl p-6 border transition-all ${plan.bgColor} ${
                  isCurrentPlan
                    ? `${plan.borderColor} shadow-elevated ring-1 ${plan.borderColor}`
                    : "border-border hover:border-primary/30 hover:shadow-elevated"
                }`}
              >
                {isCurrentPlan && (
                  <div className={`absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider shadow-sm ${
                    plan.id === "max" ? "bg-warning" : plan.id === "pro" ? "bg-primary" : "bg-muted-foreground"
                  }`}>
                    {t("billing.yourPlan")}
                  </div>
                )}

                {plan.highlight && !isCurrentPlan && (
                  <div className="absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground uppercase tracking-wider shadow-primary">
                    {t("billing.mostPopular")}
                  </div>
                )}

                <div className="flex items-start justify-between mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.iconBg}`}>
                    <Icon className={`w-5 h-5 ${plan.color}`} />
                  </div>
                  <StatusBadge variant={plan.badgeVariant} size="sm">{plan.name}</StatusBadge>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-heading text-3xl text-foreground">{formatBRL(plan.price)}</span>
                    {plan.price > 0 && <span className="text-sm text-muted-foreground">{t("billing.perMonth")}</span>}
                  </div>
                  {plan.price === 0 && (
                    <span className="text-sm text-muted-foreground">{t("billing.freeForever")}</span>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.featureKeys.map((key, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.color}`} />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => isCurrentPlan && plan.id !== "free" ? handleCancelClick() : null}
                  disabled={!isCurrentPlan && isDisabledDowngrade}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    isCurrentPlan && plan.id !== "free"
                      ? "bg-destructive text-white hover:bg-destructive/90 shadow-sm"
                      : isCurrentPlan
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : isDisabledDowngrade
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : plan.id === "max"
                      ? "bg-warning text-white hover:bg-warning/90 shadow-sm"
                      : plan.id === "pro"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                  title={isDisabledDowngrade ? `Você precisa cancelar o plano atual (${currentPlan}) antes de migrar para um plano menor` : undefined}
                >
                  {loadingId === "cancel" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan && plan.id !== "free" ? (
                    "Cancelar Assinatura"
                  ) : isCurrentPlan ? (
                    t("billing.currentPlanBtn")
                  ) : isDisabledDowngrade ? (
                    <>
                      Cancelar primeiro
                    </>
                  ) : (
                    <>
                      {t("billing.subscribe")} {plan.name}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Credit Packages */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-heading text-lg text-foreground">{t("billing.buyCredits")}</h2>
          <p className="text-xs text-muted-foreground">{t("billing.noExpiry")}</p>
        </div>
        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {creditPlans.map((plan, idx) => {
              const isPopular = plan.credits === 200
              const pricePerCredit = (plan.price_cents / 100 / plan.credits).toFixed(2)

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + idx * 0.06 }}
                  className={`relative rounded-2xl p-6 border transition-all flex flex-col gap-4 bg-card ${
                    isPopular
                      ? "border-primary/40 shadow-elevated ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:shadow-elevated"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-5 px-3 py-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground uppercase tracking-wider shadow-primary">
                      {t("billing.bestValue")}
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-primary fill-primary" />
                      </div>
                      <div>
                        <p className="text-heading text-2xl text-foreground leading-none">{plan.credits}</p>
                        <p className="text-xs text-muted-foreground">{t("billing.credits")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-heading text-2xl text-foreground">{formatBRL(plan.price_cents / 100)}</span>
                    <span className="text-xs text-muted-foreground">R$ {pricePerCredit}/crd</span>
                  </div>

                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={loadingId === String(plan.id)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                      isPopular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary"
                        : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {loadingId === String(plan.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {t("billing.buy")} {plan.credits} crd
                      </>
                    )}
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cancel Subscription Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowCancelDialog(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-warning/10 border-b border-border p-6">
              <h3 className="text-xl font-bold text-foreground mb-2">Espera aí! 👀</h3>
              <p className="text-sm text-muted-foreground">
                Veja o que você vai perder ao fazer downgrade
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Comparison Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Current Plan */}
                <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 relative">
                  <div className="absolute -top-3 left-4 px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded">
                    Seu Plano
                  </div>
                  <div className="mt-2">
                    <h4 className="text-lg font-bold text-foreground capitalize">{currentPlan}</h4>
                    {currentPlan === "max" && (
                      <>
                        <p className="text-2xl font-bold text-warning mt-2">R$ 79,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                        <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <li>✓ 300+ créditos/mês</li>
                          <li>✓ Prioridade máxima</li>
                          <li>✓ Suporte 24/7</li>
                        </ul>
                      </>
                    )}
                    {currentPlan === "pro" && (
                      <>
                        <p className="text-2xl font-bold text-primary mt-2">R$ 29,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                        <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <li>✓ 100+ créditos/mês</li>
                          <li>✓ Suporte padrão</li>
                          <li>✓ Atualizações grátis</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>

                {/* Suggested Plan */}
                {currentPlan === "max" && (
                  <div className="bg-card border border-red-200 dark:border-red-800 rounded-xl p-4 relative">
                    <div className="absolute -top-3 left-4 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                      Você Perde
                    </div>
                    <div className="mt-2">
                      <h4 className="text-lg font-bold text-foreground">Pro</h4>
                      <p className="text-2xl font-bold text-primary mt-2">R$ 29,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                      <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                        <li>✗ <span className="line-through">300+ créditos</span> → 100+ créditos</li>
                        <li>✗ <span className="line-through">Prioridade máxima</span> → Padrão</li>
                        <li>✗ <span className="line-through">Suporte 24/7</span> → Suporte padrão</li>
                      </ul>
                    </div>
                  </div>
                )}

                {currentPlan === "pro" && (
                  <div className="bg-card border border-warning/40 rounded-xl p-4 relative">
                    <div className="absolute -top-3 left-4 px-2 py-1 bg-warning text-white text-xs font-bold rounded">
                      Melhore 3x
                    </div>
                    <div className="mt-2">
                      <h4 className="text-lg font-bold text-foreground">Max</h4>
                      <p className="text-2xl font-bold text-warning mt-2">R$ 79,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                      <p className="text-xs text-warning font-medium mt-1">Apenas R$ 50 a mais</p>
                      <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                        <li>✓ 300+ créditos/mês</li>
                        <li>✓ Prioridade máxima</li>
                        <li>✓ Suporte 24/7</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3 border-t border-border pt-6">
                {currentPlan === "max" && (
                  <button
                    onClick={() => handleUpgradeDowngrade(4)}
                    disabled={loadingId?.startsWith("change-")}
                    className="w-full px-4 py-3 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingId === "change-4" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Fazer Downgrade para Pro"
                    )}
                  </button>
                )}

                {currentPlan === "pro" && (
                  <button
                    onClick={() => handleUpgradeDowngrade(5)}
                    disabled={loadingId?.startsWith("change-")}
                    className="w-full px-4 py-3 rounded-lg bg-warning text-white text-sm font-semibold hover:bg-warning/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingId === "change-5" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Fazer Upgrade para Max (Ganhe 3x Créditos!)"
                    )}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowCancelDialog(false)}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setCancelConfirmed(true)}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Final confirmation */}
              {cancelConfirmed && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3"
                >
                  <p className="text-sm text-red-900 dark:text-red-200 font-medium">
                    ⚠️ Tem certeza absoluta?
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    Você perderá todos os benefícios e créditos não utilizados serão perdidos. Não há volta.
                  </p>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loadingId === "cancel"}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {loadingId === "cancel" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Cancelando...
                      </>
                    ) : (
                      "Sim, cancelar minha assinatura"
                    )}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
