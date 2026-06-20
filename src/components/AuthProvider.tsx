'use client'

// src/components/AuthProvider.tsx
// Bootstraps Supabase auth on mount and syncs profile to Zustand.

import { useEffect, useRef, type ReactNode } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useAppStore } from '@/store/store'
import { useShallow } from 'zustand/react/shallow'
import type { Profile } from '@/lib/supabase'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[AuthProvider] fetchProfile error:', error.message)
    return null
  }
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, setUser, setProfile, logout, pricingSettings, setPricingSettings, refreshXpSummary } = useAppStore(
    useShallow((s) => ({
      user: s.user,
      setUser: s.setUser,
      setProfile: s.setProfile,
      logout: s.logout,
      pricingSettings: s.pricingSettings,
      setPricingSettings: s.setPricingSettings,
      refreshXpSummary: s.refreshXpSummary,
    }))
  )
  const skipSyncRef = useRef<boolean>(true)

  // 1. Sync supabase auth state (synchronously to avoid deadlock)
  useEffect(() => {
    const supabase = getSupabaseBrowser()
    let isMounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: any, session: any) => {
        if (session?.user) {
          setUser(session.user)
        } else if (isMounted) {
          logout()
          skipSyncRef.current = true
        }
      },
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [setUser, logout])

  // 2. Fetch profile and pricing settings when user changes
  useEffect(() => {
    if (!user) return

    let isMounted = true
    const getProfileAndSettings = async () => {
      try {
        const profile = await fetchProfile(user.id)
        if (isMounted && profile) {
          setProfile(profile)
          refreshXpSummary()

          // Buscar pricing settings do banco
          const supabase = getSupabaseBrowser()
          const { data, error } = await supabase
            .from('user_pricing_settings')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (isMounted) {
            if (!error && data?.settings_json && Object.keys(data.settings_json).length > 0) {
              skipSyncRef.current = true // Ignora sync na primeira carga
              setPricingSettings(data.settings_json)
            } else {
              // Se não existir, salva o padrão inicial local no banco
              await supabase
                .from('user_pricing_settings')
                .upsert({
                  user_id: user.id,
                  filament_cost_per_kg: pricingSettings.filamentCostPerKg,
                  energy_cost_per_kwh: pricingSettings.energyCostPerKwh,
                  printer_power_w: pricingSettings.printerPowerW,
                  profit_margin_percent: pricingSettings.profitMarginPercent,
                  settings_json: pricingSettings
                })
            }
            // Permite sincronização para futuras edições
            setTimeout(() => {
              if (isMounted) skipSyncRef.current = false
            }, 1000)
          }
        }
      } catch (err) {
        console.error('[AuthProvider] Failed to load profile or settings:', err)
      }
    }

    getProfileAndSettings()

    // Real-time listener for profile changes (like credit updates)
    const supabase = getSupabaseBrowser()
    const profileChannel = supabase
      .channel(`public:profiles:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          if (isMounted) {
            const updatedProfile = await fetchProfile(user.id)
            if (updatedProfile) {
              setProfile(updatedProfile)
            }
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(profileChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setProfile, setPricingSettings])

  // 3. Sincronizar pricingSettings alterados com o banco (Debounced)
  useEffect(() => {
    if (!user || skipSyncRef.current) return

    const timer = setTimeout(async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { error } = await supabase
          .from('user_pricing_settings')
          .upsert({
            user_id: user.id,
            filament_cost_per_kg: pricingSettings.filamentCostPerKg,
            energy_cost_per_kwh: pricingSettings.energyCostPerKwh,
            printer_power_w: pricingSettings.printerPowerW,
            profit_margin_percent: pricingSettings.profitMarginPercent,
            settings_json: pricingSettings
          })
        if (error) {
          console.error('[AuthProvider] Error syncing pricing settings:', error.message)
        }
      } catch (err) {
        console.error('[AuthProvider] Failed to sync pricing settings:', err)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [pricingSettings, user?.id])

  return <>{children}</>
}

