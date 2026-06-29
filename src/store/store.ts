// src/store/store.ts
// Zustand global store with immer for clean mutations.
// Slices: auth, ui, pricing, featureFlags, xp

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User } from '@supabase/supabase-js'
import type { Profile, UserStlPortfolio } from '@/lib/supabase'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { XpSummary } from '@/types/xp'

// ─── Auth Slice ──────────────────────────────────────────────────

interface AuthSlice {
  user: User | null
  profile: Profile | null
  authInitialized: boolean
  language: 'pt' | 'en' | 'es'
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setAuthInitialized: (v: boolean) => void
  setLanguage: (lang: 'pt' | 'en' | 'es') => void
  refreshCredits: (credits: number) => void
  logout: () => void
}

// ─── UI Slice ────────────────────────────────────────────────────

interface UiSlice {
  exportLoading: boolean
  creditModalOpen: boolean
  sidebarTab: 'parameters' | 'image' | 'presets'
  uiMode: 'simple' | 'advanced'
  setExportLoading: (v: boolean) => void
  setCreditModalOpen: (v: boolean) => void
  setSidebarTab: (tab: 'parameters' | 'image' | 'presets') => void
  setUiMode: (mode: 'simple' | 'advanced') => void
}

// ─── Pricing Slice ───────────────────────────────────────────────

export interface Printer {
  id: string
  name: string
  powerW: number
  price: number
  lifeHours: number
}

export interface Marketplace {
  id: string
  name: string
  feePercent: number
}

export interface Material {
  id: string
  name: string
  price: number
  weight: number
}

export interface PricingSettings {
  filamentCostPerKg: number
  energyCostPerKwh: number
  printerPowerW: number
  profitMarginPercent: number
  spoolPrice: number
  spoolWeight: number
  machinePrice: number
  machineLifeHours: number
  prepTimeHours: number
  prepRate: number
  failureMargin: number
  marketplaceFee: number
  taxes: number
  printers: Printer[]
  marketplaces: Marketplace[]
  materials: Material[]
  selectedPrinterId: string
  selectedMarketplaceId: string
  selectedMaterialId: string
}

interface PricingSlice {
  pricingSettings: PricingSettings
  setPricingSettings: (settings: Partial<PricingSettings>) => void
}

interface FeatureFlagsSlice {
  featureFlags: Record<string, boolean>
  setFeatureFlags: (flags: Record<string, boolean>) => void
  isFeatureEnabled: (key: string) => boolean
}

// ─── XP Slice ────────────────────────────────────────────────────

interface XpSlice {
  xpSummary: XpSummary | null
  setXpSummary: (summary: XpSummary | null) => void
  refreshXpSummary: () => Promise<void>
}

// ─── Portfolio Slice ─────────────────────────────────────────────

interface PortfolioSlice {
  portfolioItems: UserStlPortfolio[]
  isLoadingPortfolio: boolean
  fetchPortfolio: () => Promise<void>
  clearPortfolio: () => void
}

// ─── Combined Store ──────────────────────────────────────────────

type Store = AuthSlice & UiSlice & PricingSlice & FeatureFlagsSlice & XpSlice & PortfolioSlice

export const useAppStore = create<Store>()(
  persist(
    immer((set, get) => ({
      // ── Feature Flags ───────────────────────────────────────────
      featureFlags: {},
      setFeatureFlags: (flags) =>
        set((s) => {
          s.featureFlags = flags
        }),
      isFeatureEnabled: (key) => {
        const flags = get().featureFlags
        return flags[key] !== false // Default to true
      },

      // ── Auth ──────────────────────────────────────────────────
      user: null,
      profile: null,
      authInitialized: false,
      language: 'pt',
      setUser: (user) =>
        set((s) => {
          s.user = user
        }),
      setAuthInitialized: (v) =>
        set((s) => {
          s.authInitialized = v
        }),
      setProfile: (profile) =>
        set((s) => {
          s.profile = profile
          if (profile?.language) {
            s.language = profile.language
          }
        }),
      setLanguage: (lang) =>
        set((s) => {
          s.language = lang
          if (s.profile) s.profile.language = lang
        }),
      refreshCredits: (credits) =>
        set((s) => {
          if (s.profile) s.profile.credits = credits
        }),
      logout: () =>
        set((s) => {
          s.user = null
          s.profile = null
        }),

      // ── XP ───────────────────────────────────────────────────────
      xpSummary: null,
      setXpSummary: (summary) =>
        set((s) => {
          s.xpSummary = summary
        }),
      refreshXpSummary: async () => {
        const supabase = getSupabaseBrowser()
        const { data, error } = await supabase.rpc('get_xp_summary')
        if (!error && data) {
          set((s) => {
            s.xpSummary = data as XpSummary
          })
        }
      },

      // ── UI ────────────────────────────────────────────────────
      exportLoading: false,
      creditModalOpen: false,
      sidebarTab: 'parameters',
      uiMode: 'simple',
      setExportLoading: (v) =>
        set((s) => {
          s.exportLoading = v
        }),
      setCreditModalOpen: (v) =>
        set((s) => {
          s.creditModalOpen = v
        }),
      setSidebarTab: (tab) =>
        set((s) => {
          s.sidebarTab = tab
        }),
      setUiMode: (mode) =>
        set((s) => {
          s.uiMode = mode
        }),

      // ── Pricing ──────────────────────────────────────────────────
      pricingSettings: {
        filamentCostPerKg: 150.00,
        energyCostPerKwh: 0.90,
        printerPowerW: 300,
        profitMarginPercent: 100,
        spoolPrice: 130,
        spoolWeight: 1000,
        machinePrice: 4500,
        machineLifeHours: 5000,
        prepTimeHours: 0.25,
        prepRate: 30,
        failureMargin: 10,
        marketplaceFee: 12,
        taxes: 6,
        selectedPrinterId: "bambu-p1s",
        selectedMarketplaceId: "ml",
        selectedMaterialId: "pla-generico",
        printers: [
          { id: "bambu-p1s", name: "Bambu Lab P1S", powerW: 350, price: 5500, lifeHours: 5000 },
          { id: "ender-3", name: "Creality Ender 3", powerW: 270, price: 1500, lifeHours: 3000 }
        ],
        marketplaces: [
          { id: "ml", name: "Mercado Livre", feePercent: 15 },
          { id: "shopee", name: "Shopee", feePercent: 18 },
          { id: "site", name: "Site Próprio", feePercent: 5 },
          { id: "pix", name: "Venda Direta (Pix)", feePercent: 0 }
        ],
        materials: [
          { id: "pla-generico", name: "PLA Genérico", price: 130, weight: 1000 },
          { id: "petg-premium", name: "PETG Premium", price: 160, weight: 1000 }
        ]
      },
      setPricingSettings: (settings) =>
        set((s) => {
          s.pricingSettings = { ...s.pricingSettings, ...settings }
        }),

      // ── Portfolio ────────────────────────────────────────────────
      portfolioItems: [],
      isLoadingPortfolio: false,
      fetchPortfolio: async () => {
        set((s) => {
          s.isLoadingPortfolio = true
        })
        try {
          const res = await fetch('/api/portfolio')
          if (!res.ok) {
            throw new Error(`Portfolio API error: ${res.status}`)
          }
          const data = await res.json()
          set((s) => {
            s.portfolioItems = [
              ...(data.makerworld || []),
              ...(data.stlSearch || [])
            ]
            s.isLoadingPortfolio = false
          })
        } catch (err) {
          console.error('Failed to fetch portfolio:', err)
          set((s) => {
            s.isLoadingPortfolio = false
          })
        }
      },
      clearPortfolio: () =>
        set((s) => {
          s.portfolioItems = []
        }),
    })),
    {
      name: 'lb-studio-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive UI preferences
      partialize: (state) => ({
        sidebarTab: state.sidebarTab,
        uiMode: state.uiMode,
        pricingSettings: state.pricingSettings,
        language: state.language,
      }),
    },
  ),
)
