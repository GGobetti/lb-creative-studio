// src/store/store.ts
// Zustand global store with immer for clean mutations.
// Slices: auth, catalog, parametric, imageToStl, ui, pricing

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User } from '@supabase/supabase-js'
import type { Profile, CatalogItem, ConfigState } from '@/lib/supabase'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { XpSummary } from '@/types/xp'

// ─── Auth Slice ──────────────────────────────────────────────────

interface AuthSlice {
  user: User | null
  profile: Profile | null
  language: 'pt' | 'en' | 'es'
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLanguage: (lang: 'pt' | 'en' | 'es') => void
  refreshCredits: (credits: number) => void
  logout: () => void
}

// ─── Catalog Slice ───────────────────────────────────────────────

interface CatalogSlice {
  currentItem: CatalogItem | null
  setCurrentItem: (item: CatalogItem | null) => void
}

// ─── Parametric Slice ────────────────────────────────────────────

export interface ParametricValues {
  // Text
  line1: string
  line2: string
  // Base geometry
  baseWidth: number
  baseHeight: number
  baseDepth: number
  baseRadius: number
  // Text 3D
  textDepth: number
  textScale: number
  textX: number
  textYOffset: number
  textZ: number
  textRotationX: number
  textRotationY: number
  textRotationZ: number
  // Advanced Features
  booleanMode: 'union' | 'subtract'
  fontFamily: string
  baseShape: 'rectangle' | 'circle' | 'hexagon'
  holesEnabled: boolean
  holeDiameter: number
  holeMargin: number
  keychainEnabled: boolean
  surfaceTexture: 'none' | 'honeycomb' | 'stripes'
  customBaseStlUrl: string | null
  // Image-to-3D / Cookie Cutter
  bladeHeight: number
  bladeWall: number
  flangeOffset: number
  flangeHeight: number
  // Keychain
  bodyDepth: number
  bodyScale: number
  ringRadius: number
  // Generic
  [key: string]: string | number | boolean | null
}

const DEFAULT_PARAMETRIC: ParametricValues = {
  line1: 'LB Creative',
  line2: 'Studio',
  baseWidth: 120,
  baseHeight: 10,
  baseDepth: 80,
  baseRadius: 2,
  textDepth: 3,
  textScale: 1,
  textX: 0,
  textYOffset: 0,
  textZ: 0,
  textRotationX: 0,
  textRotationY: 0,
  textRotationZ: 0,
  booleanMode: 'union',
  fontFamily: 'roboto',
  baseShape: 'rectangle',
  holesEnabled: false,
  holeDiameter: 4,
  holeMargin: 10,
  keychainEnabled: false,
  surfaceTexture: 'none',
  customBaseStlUrl: null,
  bladeHeight: 15,
  bladeWall: 1.2,
  flangeOffset: 4,
  flangeHeight: 3,
  bodyDepth: 3,
  bodyScale: 40,
  ringRadius: 5,
}

interface ParametricSlice {
  values: ParametricValues
  color: string
  preset: 'cookie_cutter' | 'keychain' | null
  setValue: (key: string, value: number | string | boolean | null) => void
  setColor: (color: string) => void
  setPreset: (preset: 'cookie_cutter' | 'keychain' | null) => void
  resetToDefaults: (schema?: { sliders: Array<{ key: string; default: number }> }) => void
  toConfigState: () => ConfigState
}

// ─── Image-to-STL Slice ──────────────────────────────────────────

interface ImageToStlSlice {
  sourceImageUrl: string | null
  svgPathData: string | null
  traceThreshold: number
  setSourceImage: (url: string | null) => void
  setSvgPathData: (svg: string | null) => void
  setTraceThreshold: (v: number) => void
  clearImage: () => void
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

// ─── Combined Store ──────────────────────────────────────────────

type Store = AuthSlice & CatalogSlice & ParametricSlice & ImageToStlSlice & UiSlice & PricingSlice & FeatureFlagsSlice & XpSlice

export const useConfiguratorStore = create<Store>()(
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
      language: 'pt',
      setUser: (user) =>
        set((s) => {
          s.user = user
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

      // ── Catalog ───────────────────────────────────────────────
      currentItem: null,
      setCurrentItem: (item) =>
        set((s) => {
          s.currentItem = item
        }),

      // ── Parametric ────────────────────────────────────────────
      values: { ...DEFAULT_PARAMETRIC },
      color: '#e8d5b7',
      preset: null,
      setValue: (key, value) =>
        set((s) => {
          ;(s.values as Record<string, unknown>)[key] = value
        }),
      setColor: (color) =>
        set((s) => {
          s.color = color
        }),
      setPreset: (preset) =>
        set((s) => {
          s.preset = preset
        }),
      resetToDefaults: (schema) =>
        set((s) => {
          s.values = { ...DEFAULT_PARAMETRIC }
          if (schema) {
            schema.sliders.forEach((sl) => {
              ;(s.values as Record<string, unknown>)[sl.key] = sl.default
            })
          }
        }),
      toConfigState: () => {
        const s = get()
        return {
          ...s.values,
          color: s.color,
          preset: s.preset,
        }
      },

      // ── Image-to-STL ──────────────────────────────────────────
      sourceImageUrl: null,
      svgPathData: null,
      traceThreshold: 128,
      setSourceImage: (url) =>
        set((s) => {
          s.sourceImageUrl = url
        }),
      setSvgPathData: (svg) =>
        set((s) => {
          s.svgPathData = svg
        }),
      setTraceThreshold: (v) =>
        set((s) => {
          s.traceThreshold = v
        }),
      clearImage: () =>
        set((s) => {
          s.sourceImageUrl = null
          s.svgPathData = null
        }),

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
    })),
    {
      name: 'lb-studio-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive UI preferences and parametric values
      partialize: (state) => ({
        values: state.values,
        color: state.color,
        preset: state.preset,
        sidebarTab: state.sidebarTab,
        uiMode: state.uiMode,
        pricingSettings: state.pricingSettings,
        language: state.language,
      }),
    },
  ),
)
