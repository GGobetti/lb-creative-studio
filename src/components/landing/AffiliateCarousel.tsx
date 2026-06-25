'use client';

import { useState, useEffect } from 'react';
import { AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductCard } from '@/components/affiliate/AffiliateProductCard';
import { ProductModal } from '@/components/affiliate/ProductModal';

interface AffiliateCarouselProps {
  products: AffiliateProduct[];
}

export function AffiliateCarousel({ products }: AffiliateCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);
  const [autoplay, setAutoplay] = useState(true);

  const displayProducts = products.slice(0, 5); // Show max 5 products

  useEffect(() => {
    if (!autoplay || displayProducts.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayProducts.length);
    }, 5000); // Auto-rotate every 5 seconds

    return () => clearInterval(interval);
  }, [autoplay, displayProducts.length]);

  if (displayProducts.length === 0) {
    return null; // Don't show if no products
  }

  const goToPrevious = () => {
    setAutoplay(false);
    setCurrentIndex((prev) =>
      prev === 0 ? displayProducts.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setAutoplay(false);
    setCurrentIndex((prev) => (prev + 1) % displayProducts.length);
  };

  const goToProduct = (index: number) => {
    setAutoplay(false);
    setCurrentIndex(index);
  };

  return (
    <section className="py-16 bg-gradient-to-b from-slate-900 to-black">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12 text-center text-white">
          Recommended Products
        </h2>

        {/* Carousel container */}
        <div className="relative">
          {/* Main display - show 4 cards in a row, centered on current */}
          <div className="overflow-hidden">
            <div className="flex gap-4 justify-center items-start">
              {/* Previous card (faded) */}
              {displayProducts.length > 1 && (
                <div className="w-1/5 opacity-50 scale-95 flex-shrink-0">
                  <AffiliateProductCard
                    product={
                      displayProducts[
                        (currentIndex - 1 + displayProducts.length) %
                          displayProducts.length
                      ]
                    }
                    onSelect={setSelectedProduct}
                  />
                </div>
              )}

              {/* Current card (prominent) */}
              <div className="w-1/3 flex-shrink-0">
                <AffiliateProductCard
                  product={displayProducts[currentIndex]}
                  onSelect={setSelectedProduct}
                />
              </div>

              {/* Next card (faded) */}
              {displayProducts.length > 1 && (
                <div className="w-1/5 opacity-50 scale-95 flex-shrink-0">
                  <AffiliateProductCard
                    product={displayProducts[(currentIndex + 1) % displayProducts.length]}
                    onSelect={setSelectedProduct}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          {displayProducts.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-full transition z-10"
                aria-label="Previous product"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-cyan-500 hover:bg-cyan-600 text-white p-2 rounded-full transition z-10"
                aria-label="Next product"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}

          {/* Dots navigation */}
          {displayProducts.length > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {displayProducts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToProduct(index)}
                  className={`w-3 h-3 rounded-full transition ${
                    index === currentIndex ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                  aria-label={`Go to product ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* View all link */}
          <div className="text-center mt-8">
            <a
              href="/affiliate"
              className="inline-block text-cyan-400 hover:text-cyan-300 font-medium transition"
            >
              View all products →
            </a>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </section>
  );
}
