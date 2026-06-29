'use client'

import { useState, useEffect } from 'react'
import { ShoppingBag } from 'lucide-react'
import { PortfolioTabs } from './PortfolioTabs'
import { useToast } from '@/components/ui/Toast'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { UserStlPortfolio } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioApiResponse {
  makerworld: UserStlPortfolio[]
  stlSearch: UserStlPortfolio[]
  total: number
  timestamp: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { toast } = useToast()
  const [makerworld, setMakerworld] = useState<UserStlPortfolio[]>([])
  const [stlSearch, setStlSearch] = useState<UserStlPortfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPortfolio() {
      setIsLoading(true)
      try {
        const supabase = getSupabaseBrowser()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
          toast('Sessão inválida. Faça login novamente.', 'error')
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
        const message = err instanceof Error ? err.message : 'Erro ao carregar portfólio.'
        console.error('[PortfolioPage]', message)
        toast(message, 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPortfolio()
  }, [toast])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-cyan-400/10 border border-cyan-400/20 shrink-0">
          <ShoppingBag className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Meu Portfolio</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            STLs adquiridos na plataforma, separados por origem de aquisição.
          </p>
        </div>
      </div>

      {/* Tabs + Grids */}
      <PortfolioTabs
        makerworld={makerworld}
        stlSearch={stlSearch}
        isLoading={isLoading}
      />
    </div>
  )
}
