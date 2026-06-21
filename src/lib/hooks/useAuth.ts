'use client';

import { useAppStore } from '@/store/store';
import { useEffect, useState } from 'react';

export function useAuth() {
  const { user, profile } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If auth provider has initialized (user is set or null), mark as loaded
    setLoading(false);
  }, []);

  return { user, profile, loading };
}
