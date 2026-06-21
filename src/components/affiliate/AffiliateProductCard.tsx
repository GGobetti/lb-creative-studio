'use client';

import Link from 'next/link';
import { AffiliateProduct, trackClick } from '@/lib/api/affiliate';
import { useAuth } from '@/lib/hooks/useAuth';

interface AffiliateProductCardProps {
  product: AffiliateProduct;
  onClicked?: () => void;
}

const marketplaceIcons: Record<string, string> = {
  aliexpress: '🌐',
  shopee: '🛒',
  mercado_livre: '🇧🇷',
  amazon: '📦',
};

export function AffiliateProductCard({
  product,
  onClicked,
}: AffiliateProductCardProps) {
  const { user } = useAuth();

  const handleClick = async () => {
    await trackClick(product.id, user?.id);
    onClicked?.();
  };

  return (
    <div className="glass-panel rounded-lg overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-300">
      {/* Image */}
      <div className="relative w-full h-48 bg-slate-900 overflow-hidden">
        {/* Plain <img>: image_url points to arbitrary marketplace hosts
            (AliExpress/Shopee/etc.) that next/image's remotePatterns can't
            enumerate, so we skip optimization to avoid render crashes. */}
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = '/images/placeholder-product.png';
          }}
        />
        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
          {marketplaceIcons[product.marketplace] || '🔗'}{' '}
          {product.marketplace.replace('_', ' ')}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        <div className="mt-auto">
          <div className="text-lg font-bold text-cyan-400 mb-3">
            R$ {product.price.toFixed(2)}
          </div>

          <Link
            href={product.affiliate_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="w-full inline-block text-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-2 rounded font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Ver Produto
          </Link>
        </div>
      </div>
    </div>
  );
}
