'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductGrid } from '@/components/affiliate/AffiliateProductGrid';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

export default function AffiliatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchAffiliateProducts()
        .then(setProducts)
        .catch((err) => {
          console.error(err);
          setError('Falha ao carregar produtos');
        })
        .finally(() => setIsLoading(false));
    }
  }, [user, loading, router]);

  if (loading || (user && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <AffiliateProductGrid products={products} />
    </div>
  );
}
