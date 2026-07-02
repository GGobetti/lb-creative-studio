'use client'

import { useState } from 'react'
import { PortfolioGrid } from './PortfolioGrid'
import { useTranslation } from '@/lib/translations'
import type { UserStlPortfolio } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'stlSearch' | 'makerworld'

interface Tab {
  id: TabId
  label: string
  count: number
}

interface PortfolioTabsProps {
  makerworld: UserStlPortfolio[]
  stlSearch: UserStlPortfolio[]
  isLoading?: boolean
  onPriceIt: (item: UserStlPortfolio) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PortfolioTabs({ makerworld, stlSearch, isLoading = false, onPriceIt }: PortfolioTabsProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabId>('stlSearch')

  const tabs: Tab[] = [
    {
      id: 'stlSearch',
      label: t('portfolioTabs.purchasedStlSearch', 'Comprados STL Search'),
      count: stlSearch.length,
    },
    {
      id: 'makerworld',
      label: t('portfolioTabs.importedMakerworld', 'Importados Makerworld'),
      count: makerworld.length,
    },
  ]

  const activeItems = activeTab === 'stlSearch' ? stlSearch : makerworld

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-4 py-2.5 text-sm font-semibold transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50
                ${isActive
                  ? 'text-cyan-400'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tab.label}
              {/* Count badge */}
              <span
                className={`
                  ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full
                  ${isActive
                    ? 'bg-cyan-400/15 text-cyan-400'
                    : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {isLoading ? '…' : tab.count}
              </span>
              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-t" />
              )}
            </button>
          )
        })}
      </div>

      {/* Grid for active tab */}
      <PortfolioGrid items={activeItems} isLoading={isLoading} onPriceIt={onPriceIt} />
    </div>
  )
}
