'use client';

import { useState, useMemo } from 'react';
import { AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductCard } from './AffiliateProductCard';

interface AffiliateProductGridProps {
  products: AffiliateProduct[];
}

const marketplaces = [
  { value: 'all', label: 'Todos' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'amazon', label: 'Amazon' },
];

export function AffiliateProductGrid({
  products,
}: AffiliateProductGridProps) {
  const [search, setSearch] = useState('');
  const [marketplace, setMarketplace] = useState('all');

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchMarketplace = marketplace === 'all' || p.marketplace === marketplace;
      return matchSearch && matchMarketplace;
    });
  }, [products, search, marketplace]);

  return (
    <div>
      {/* Search & Filter */}
      <div className="mb-8 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded bg-slate-800/50 text-white placeholder-slate-400 border border-slate-700 focus:border-cyan-500 outline-none transition"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {marketplaces.map((m) => (
            <button
              key={m.value}
              onClick={() => setMarketplace(m.value)}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                marketplace === m.value
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          Nenhum produto encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <AffiliateProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Count */}
      <div className="mt-8 text-center text-sm text-slate-400">
        {filtered.length} de {products.length} produtos
      </div>
    </div>
  );
}
