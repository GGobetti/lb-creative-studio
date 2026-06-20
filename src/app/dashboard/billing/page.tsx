"use client"

import { useAppStore } from "@/store/store"
import { Zap, Check, CreditCard, Loader2, Rocket, Crown, Star, Sparkles, ArrowRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "@/lib/translations"
import { useToast } from "@/components/ui/Toast"
import { PageHeader } from "@/components/ui/PageHeader"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { motion } from "framer-motion"

const CREDIT_PACKAGES = [
  {
    id: "pack_50",
    credits: 50,
    price: 10.00,
    popular: false,
    pricePerCredit: "R$ 0,20/crd",
  },
  {
    id: "pack_200",
    credits: 200,
    price: 35.00,
    popular: true,
    pricePerCredit: "R$ 0,17/crd",
    saving: "15% off",
  },
  {
    id: "pack_500",
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

  const handleCheckout = async (itemId: string, type: "credits" | "subscription") => {
    setLoadingId(itemId)
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, type }),
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

  const formatBRL = (value: number) =>
    new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', {
      style: "currency",
      currency: "BRL",
    }).format(value)

  const currentPlan = profile?.plan || "free"

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
            onClick={() => handleCheckout("pack_200", "credits")}
            disabled={loadingId !== null}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-primary shrink-0 disabled:opacity-50"
          >
            {loadingId === "pack_200" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
        <h2 className="text-heading text-lg text-foreground mb-4">{t("billing.subscriptionPlans")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SUBSCRIPTION_PLANS.map((plan, idx) => {
            const isCurrentPlan = currentPlan === plan.id
            const Icon = plan.icon
            return (
              <motion.div
                key={plan.id}
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
                  onClick={() => handleCheckout(plan.id, "subscription")}
                  disabled={isCurrentPlan || loadingId === plan.id}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    isCurrentPlan
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : plan.id === "max"
                      ? "bg-warning text-white hover:bg-warning/90 shadow-sm"
                      : plan.id === "pro"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {loadingId === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    t("billing.currentPlanBtn")
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CREDIT_PACKAGES.map((pack, idx) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + idx * 0.06 }}
              className={`relative rounded-2xl p-6 border transition-all flex flex-col gap-4 bg-card ${
                pack.popular
                  ? "border-primary/40 shadow-elevated ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:shadow-elevated"
              }`}
            >
              {pack.popular && (
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
                    <p className="text-heading text-2xl text-foreground leading-none">{pack.credits}</p>
                    <p className="text-xs text-muted-foreground">{t("billing.credits")}</p>
                  </div>
                </div>
                {pack.saving && (
                  <StatusBadge variant="success" size="sm">{pack.saving}</StatusBadge>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-heading text-2xl text-foreground">{formatBRL(pack.price)}</span>
                <span className="text-xs text-muted-foreground">{pack.pricePerCredit}</span>
              </div>

              <button
                onClick={() => handleCheckout(pack.id, "credits")}
                disabled={loadingId === pack.id}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                  pack.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary"
                    : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                {loadingId === pack.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {t("billing.buy")} {pack.credits} crd
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
