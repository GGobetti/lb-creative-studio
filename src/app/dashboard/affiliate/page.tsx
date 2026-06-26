'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductGrid } from '@/components/affiliate/AffiliateProductGrid';

export default function AffiliateDashboardPage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAffiliateProducts()
      .then(setProducts)
      .catch((err) => {
        console.error(err);
        setError('Erro ao carregar produtos');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 py-12 text-center">{error}</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Loja de Afiliados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Produtos recomendados de nossos parceiros.
        </p>
      </div>
      <AffiliateProductGrid products={products} />
    </div>
  );
}
