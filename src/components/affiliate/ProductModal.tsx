'use client';

import { AffiliateProduct } from '@/lib/api/affiliate';
import { PhotoCarousel } from './PhotoCarousel';
import { useEffect } from 'react';

interface ProductModalProps {
  product: AffiliateProduct;
  isOpen: boolean;
  onClose: () => void;
}

const marketplaceIcons: Record<string, string> = {
  mercado_livre: '🇧🇷',
  aliexpress: '🌐',
  shopee: '🛒',
  amazon: '📦',
};

export function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const details = product.details;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{marketplaceIcons[product.marketplace] || '🔗'}</span>
            <h2 className="text-xl font-semibold text-white">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Photo carousel */}
          <div>
            <PhotoCarousel photos={product.photos} productName={product.name} />
          </div>

          {/* Right: Product details */}
          <div className="space-y-6">
            {/* Price */}
            {details && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Price</p>
                <p className="text-4xl font-bold text-cyan-400">R$ {(details.price || 0).toFixed(2)}</p>
              </div>
            )}

            {/* Rating and reviews */}
            {details && details.rating != null && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⭐</span>
                  <span className="text-lg font-semibold text-white">{(details.rating || 0).toFixed(1)}</span>
                  <span className="text-sm text-slate-400">({(details.rating_count || 0).toLocaleString()} reviews)</span>
                </div>
              </div>
            )}

            {/* Stock status */}
            {details?.stock_quantity !== undefined && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Stock</p>
                <div className="flex items-center gap-2">
                  {details.stock_quantity > 5 && (
                    <>
                      <span className="text-green-500">✓</span>
                      <span className="text-white">In stock ({details.stock_quantity} available)</span>
                    </>
                  )}
                  {details.stock_quantity > 0 && details.stock_quantity <= 5 && (
                    <>
                      <span className="text-yellow-500">⚠️</span>
                      <span className="text-white">Low stock ({details.stock_quantity} left)</span>
                    </>
                  )}
                  {details.stock_quantity === 0 && (
                    <>
                      <span className="text-red-500">✗</span>
                      <span className="text-white">Out of stock</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Condition */}
            {details?.condition && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Condition</p>
                <span className="inline-block px-3 py-1 bg-slate-800 text-white rounded text-sm capitalize">
                  {details.condition}
                </span>
              </div>
            )}

            {/* Sales count */}
            {details?.sales_count && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Sales</p>
                <p className="text-white font-medium">{details.sales_count.toLocaleString()} sold</p>
              </div>
            )}

            {/* Category */}
            {details?.category && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Category</p>
                <span className="inline-block px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded text-sm">
                  {details.category}
                </span>
              </div>
            )}

            {/* Payment methods */}
            {details?.payment_methods && details.payment_methods.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-3">Payment Methods</p>
                <div className="space-y-2">
                  {details.payment_methods.map((method, idx) => (
                    <div key={idx} className="text-sm text-white">
                      <span>💳 {method.name}</span>
                      {method.installments && (
                        <span className="text-slate-400 ml-2">(up to {method.installments}x)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {details?.description && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Description</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap line-clamp-4">
                  {details.description}
                </p>
              </div>
            )}

            {/* CTA Button */}
            <div className="pt-4 border-t border-slate-700">
              <a
                href={product.affiliate_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded font-semibold hover:opacity-90 transition"
              >
                View on {product.marketplace.replace('_', ' ')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
