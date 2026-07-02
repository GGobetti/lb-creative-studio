'use client';

import { useState } from 'react';
import { ProductPhoto } from '@/lib/api/affiliate';
import { useTranslation } from '@/lib/translations';

interface PhotoCarouselProps {
  photos: ProductPhoto[];
  productName: string;
}

export function PhotoCarousel({ photos, productName }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t } = useTranslation();

  if (!photos || photos.length === 0) {
    return (
      <div className="w-full h-96 bg-slate-800 rounded flex items-center justify-center">
        <p className="text-slate-400">{t('affiliatePhotoCarousel.noImages', 'No images available')}</p>
      </div>
    );
  }

  const current = photos[currentIndex];
  const hasMultiple = photos.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const goToPhoto = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div className="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden">
        <img
          src={current.image_url}
          alt={`${productName} - Image ${currentIndex + 1}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/images/placeholder-product.png';
          }}
        />

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
              aria-label={t('affiliatePhotoCarousel.previousImage', 'Previous image')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
              aria-label={t('affiliatePhotoCarousel.nextImage', 'Next image')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Counter */}
            <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded text-white text-sm">
              {currentIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => goToPhoto(index)}
              className={`flex-shrink-0 w-16 h-16 rounded border-2 transition ${
                index === currentIndex
                  ? 'border-cyan-500'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              aria-label={`${t('affiliatePhotoCarousel.viewImage', 'View image')} ${index + 1}`}
            >
              <img
                src={photo.image_url}
                alt={`${t('affiliatePhotoCarousel.thumbnail', 'Thumbnail')} ${index + 1}`}
                className="w-full h-full object-cover rounded"
                onError={(e) => {
                  e.currentTarget.src = '/images/placeholder-product.png';
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
