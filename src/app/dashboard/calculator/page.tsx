"use client"

import { PricingCalculator } from "@/components/dashboard/PricingCalculator"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useConfiguratorStore } from "@/store/store"

export default function PricingCalculatorPage() {
  const router = useRouter()
  const isFeatureEnabled = useConfiguratorStore((s) => s.isFeatureEnabled)

  useEffect(() => {
    if (!isFeatureEnabled("pricing_calculator")) {
      router.push("/dashboard")
    }
  }, [isFeatureEnabled, router])

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-black text-foreground">Calculadora de Preço</h1>
        <p className="text-muted-foreground mt-1">
          Descubra o custo real e o preço de venda ideal para suas impressões.
        </p>
      </div>

      <PricingCalculator isStandalone={true} />
    </div>
  )
}
