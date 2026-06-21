'use client';

import { useAppStore } from '@/store/store';

export function useAuth() {
  const { user, profile, authInitialized } = useAppStore();
  // `loading` reflects the real auth bootstrap: it stays true until
  // AuthProvider's onAuthStateChange resolves the initial session. This avoids
  // flashing a login redirect for an already-authenticated user on hard reload.
  return { user, profile, loading: !authInitialized };
}
