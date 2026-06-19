'use client'

import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useConfiguratorStore } from '@/store/store'

export function useLogout() {
  const router = useRouter()
  const logout = useConfiguratorStore((s) => s.logout)

  return async function handleLogout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }
}
