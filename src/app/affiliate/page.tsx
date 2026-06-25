'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductGrid } from '@/components/affiliate/AffiliateProductGrid';

export default function AffiliatePage() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAffiliateProducts()
      .then(setProducts)
      .catch((err) => {
        console.error(err);
        setError('Failed to load products');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Loading products...</p>
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
      <h1 className="text-3xl font-bold mb-8 text-white">Recommended Products</h1>
      <AffiliateProductGrid products={products} />
    </div>
  );
}
