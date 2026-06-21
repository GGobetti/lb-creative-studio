'use client';

import { useAppStore } from '@/store/store';

export function useAuth() {
  const { user, profile } = useAppStore();
  return { user, profile };
}
