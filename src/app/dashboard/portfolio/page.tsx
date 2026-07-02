'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingBag, Plus, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { PortfolioTabs } from './PortfolioTabs'
import { useToast } from '@/components/ui/Toast'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { UserStlPortfolio } from '@/lib/supabase'
import { MakerWorldImportModal } from '@/components/dashboard/MakerWorldImportModal'
import { PricingCalculator } from '@/components/dashboard/PricingCalculator'
import { useTranslation } from '@/lib/translations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioApiResponse {
  makerworld: UserStlPortfolio[]
  stlSearch: UserStlPortfolio[]
  total: number
  timestamp: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [makerworld, setMakerworld] = useState<UserStlPortfolio[]>([])
  const [stlSearch, setStlSearch] = useState<UserStlPortfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [pricingItem, setPricingItem] = useState<UserStlPortfolio | null>(null)

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        toast(t('portfolioPage.invalidSession', 'Sessão inválida. Faça login novamente.'), 'error')
        return
      }

      const res = await fetch('/api/portfolio', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Erro HTTP ${res.status}`)
      }

      const data: PortfolioApiResponse = await res.json()
      setMakerworld(data.makerworld ?? [])
      setStlSearch(data.stlSearch ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('portfolioPage.loadError', 'Erro ao carregar portfólio.')
      console.error('[PortfolioPage]', message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyan-400/10 border border-cyan-400/20 shrink-0">
            <ShoppingBag className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">{t('portfolioPage.title', 'Meu Portfolio')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('portfolioPage.subtitle', 'STLs adquiridos na plataforma, separados por origem de aquisição.')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('portfolioPage.importMakerWorld', 'Importar MakerWorld')}
        </button>
      </div>

      <MakerWorldImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportSuccess={fetchPortfolio}
      />

      {/* Tabs + Grids */}
      <PortfolioTabs
        makerworld={makerworld}
        stlSearch={stlSearch}
        isLoading={isLoading}
        onPriceIt={setPricingItem}
      />

      {/* Pricing Modal */}
      <Dialog.Root open={!!pricingItem} onOpenChange={(open) => !open && setPricingItem(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
            <Dialog.Title className="sr-only">{t('portfolioPage.pricingModalTitle', 'Precificar Modelo')}</Dialog.Title>
            {pricingItem && (
              <PricingCalculator
                isStandalone={false}
                initialWeight={pricingItem.weight_g ?? 0}
                initialTimeHours={pricingItem.print_time_hours ?? 0}
              />
            )}
            <Dialog.Close asChild>
              <button className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground rounded-full p-2 transition-colors z-50">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
