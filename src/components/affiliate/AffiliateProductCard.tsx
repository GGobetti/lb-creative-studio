'use client';

import { AffiliateProduct, trackClick } from '@/lib/api/affiliate';
import { useAuth } from '@/lib/hooks/useAuth';

interface AffiliateProductCardProps {
  product: AffiliateProduct;
  onSelect: (product: AffiliateProduct) => void;
}

const marketplaceIcons: Record<string, string> = {
  mercado_livre: '🇧🇷',
  aliexpress: '🌐',
  shopee: '🛒',
  amazon: '📦',
};

export function AffiliateProductCard({
  product,
  onSelect,
}: AffiliateProductCardProps) {
  const { user } = useAuth();
  const details = product.details;
  const primaryPhoto = product.photos?.find((p) => p.is_primary) || product.photos?.[0];

  const handleClick = async () => {
    await trackClick(product.id, user?.id);
    onSelect(product);
  };

  return (
    <div
      onClick={handleClick}
      className="glass-panel rounded-lg overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-300 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative w-full h-48 bg-slate-900 overflow-hidden">
        <img
          src={primaryPhoto?.image_url || '/images/placeholder-product.png'}
          alt={product.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = '/images/placeholder-product.png';
          }}
        />
        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
          {marketplaceIcons[product.marketplace] || '🔗'}{' '}
          {product.marketplace.replace('_', ' ')}
        </div>

        {/* Photo count badge */}
        {product.photos && product.photos.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
            📷 {product.photos.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Name */}
        <h3 className="font-semibold text-sm line-clamp-2 mb-2">{product.name}</h3>

        {/* Description */}
        {details?.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3">
            {details.description}
          </p>
        )}

        {/* Rating */}
        {details?.rating && (
          <div className="flex items-center gap-1 mb-3">
            <span>⭐</span>
            <span className="text-xs font-medium">
              {details.rating.toFixed(1)} ({details.rating_count} reviews)
            </span>
          </div>
        )}

        <div className="mt-auto">
          {/* Price */}
          {details?.price && (
            <div className="text-lg font-bold text-cyan-400 mb-3">
              R$ {details.price.toFixed(2)}
            </div>
          )}

          {/* Stock indicator */}
          {details?.stock_quantity !== undefined && (
            <div className="text-xs text-slate-400 mb-3">
              {details.stock_quantity > 5
                ? '✓ In stock'
                : details.stock_quantity > 0
                ? '⚠️ Low stock'
                : '✗ Out of stock'}
            </div>
          )}

          {/* View button */}
          <button className="w-full inline-block text-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-2 rounded font-medium text-sm hover:opacity-90 transition-opacity">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
