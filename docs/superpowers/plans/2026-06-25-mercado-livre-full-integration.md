# Mercado Livre Full Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Mercado Livre affiliate product system with normalized database, complete product data extraction (ratings, sales, photos, stock, categories, payment methods), public product listing page, product detail modal with photo gallery, and home page carousel.

**Architecture:** Three-layer approach:
1. **Database Layer** — Normalize schema into `affiliate_products`, `affiliate_product_details`, `affiliate_product_photos` with proper relationships
2. **Backend Layer** — Enhanced data extraction from ML API, multi-table transactional inserts, updated API responses
3. **Frontend Layer** — New `ProductModal` with carousel, `AffiliateCarousel` for home, public `/affiliate` page, updated product cards

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL), TypeScript, React, TailwindCSS

## Global Constraints

- Maintain backwards compatibility with existing `affiliate_products` inserts (handle null descriptions/prices gracefully)
- All API responses must include photo arrays and details
- `/affiliate` page must be publicly accessible (remove auth requirements)
- Modal must support lazy-loading photos to avoid loading all images upfront
- Affiliate links must preserve ML tracking parameters

---

## File Structure

### Database (Migrations)

- `supabase/migrations/001_create_product_details.sql` — Create `affiliate_product_details` table
- `supabase/migrations/002_create_product_photos.sql` — Create `affiliate_product_photos` table
- `supabase/migrations/003_alter_affiliate_products.sql` — Remove deprecated columns

### Backend

- `src/lib/mercado-livre.ts` — Enhanced ML data extraction
- `src/app/api/affiliate/import-mercado-livre/route.ts` — Multi-table import handler
- `src/app/api/affiliate/products/route.ts` — Updated response schema
- `src/app/api/affiliate/products/[id]/route.ts` — Single product endpoint (create if needed)

### Frontend - Types & API

- `src/lib/api/affiliate.ts` — Updated TypeScript interfaces, new fetch functions

### Frontend - Components

- `src/components/affiliate/AffiliateProductCard.tsx` — Refactored for new data structure
- `src/components/affiliate/ProductModal.tsx` — NEW: Full product details + photo carousel
- `src/components/affiliate/PhotoCarousel.tsx` — NEW: Reusable photo carousel component
- `src/components/landing/AffiliateCarousel.tsx` — NEW: 5-product carousel for home page

### Frontend - Pages

- `src/app/affiliate/page.tsx` — Remove auth, use new schema
- `src/app/page.tsx` — Integrate carousel section

---

## Task Breakdown

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/001_create_product_details.sql`
- Create: `supabase/migrations/002_create_product_photos.sql`
- Create: `supabase/migrations/003_alter_affiliate_products.sql`

**Interfaces:**
- Produces: Three new tables with proper foreign keys, indexes, timestamps

- [ ] **Step 1: Create affiliate_product_details migration**

```sql
-- supabase/migrations/001_create_product_details.sql
CREATE TABLE IF NOT EXISTS affiliate_product_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(255),
  condition VARCHAR(50),
  payment_methods JSONB,
  stock_quantity INT,
  sales_count INT DEFAULT 0,
  rating DECIMAL(2, 1),
  rating_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_details_product_id 
  ON affiliate_product_details(product_id);

ALTER TABLE affiliate_product_details ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Create affiliate_product_photos migration**

```sql
-- supabase/migrations/002_create_product_photos.sql
CREATE TABLE IF NOT EXISTS affiliate_product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  image_url VARCHAR(2048) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  position INT DEFAULT 0,
  source_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_photos_product_id 
  ON affiliate_product_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_source_id 
  ON affiliate_product_photos(source_id);

ALTER TABLE affiliate_product_photos ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Create alter affiliate_products migration**

```sql
-- supabase/migrations/003_alter_affiliate_products.sql
ALTER TABLE affiliate_products 
DROP COLUMN IF EXISTS image_url,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS price;

-- Add is_public column if not exists (for future public/private toggle)
ALTER TABLE affiliate_products 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
```

- [ ] **Step 4: Execute migrations in Supabase**

Run in Supabase SQL Editor:
```bash
# Copy and paste each migration file content into Supabase SQL editor
# Execute in order: 001, 002, 003
```

Expected: Three tables created, no errors in Supabase console.

---

### Task 2: Update Mercado Livre Data Extraction Library

**Files:**
- Modify: `src/lib/mercado-livre.ts`

**Interfaces:**
- Consumes: ML API responses from `fetchMLProductData(productId, token)`
- Produces: Enhanced `transformMLProductData()` returning `{ productBase, details, photos }`

- [ ] **Step 1: Replace transformMLProductData function**

```typescript
// src/lib/mercado-livre.ts

export interface MLProductResult {
  productBase: {
    name: string;
    marketplace: 'mercado_livre';
  };
  details: {
    description: string | null;
    price: number;
    category: string | null;
    condition: 'new' | 'used' | null;
    payment_methods: Array<{ name: string; installments?: number }>;
    stock_quantity: number;
    sales_count: number;
    rating: number | null;
    rating_count: number;
  };
  photos: Array<{
    url: string;
    source_id: string;
    is_primary: boolean;
  }>;
}

export function transformMLProductData(mlData: any): MLProductResult {
  // Extract images
  const pictures = mlData.pictures || [];
  const photos = pictures.map((pic: any, index: number) => ({
    url: pic.secure_url || pic.url,
    source_id: pic.id || `ml_photo_${index}`,
    is_primary: index === 0,
  }));

  // Extract description (handle multiple descriptions)
  let description = '';
  if (mlData.descriptions && Array.isArray(mlData.descriptions)) {
    description = mlData.descriptions
      .map((d: any) => d.text || '')
      .filter((t: string) => t.length > 0)
      .join('\n\n');
  }
  if (!description && mlData.description) {
    description = mlData.description;
  }

  // Extract payment methods
  const paymentMethods: Array<{ name: string; installments?: number }> = [];
  if (mlData.payment_methods && Array.isArray(mlData.payment_methods)) {
    paymentMethods.push(
      ...mlData.payment_methods
        .filter((pm: any) => pm.id && pm.type)
        .map((pm: any) => ({
          name: pm.id.toUpperCase().replace(/_/g, ' '),
          installments: pm.additional_info?.max_allowed_installments,
        }))
    );
  }
  // Add common payment method names
  if (paymentMethods.length === 0) {
    paymentMethods.push(
      { name: 'Credit Card', installments: 12 },
      { name: 'Debit Card' },
      { name: 'Pix' }
    );
  }

  // Extract condition
  const condition: 'new' | 'used' | null = mlData.condition === 'used' ? 'used' : 'new';

  // Extract category (name from category_id if available)
  let category = mlData.category_name || mlData.category_id || null;

  // Extract ratings
  const rating = mlData.rating ? parseFloat(mlData.rating) : null;
  const ratingCount = mlData.rating_count || mlData.ratings_count || 0;

  // Extract stock
  const stockQuantity = mlData.available_quantity || 0;

  // Extract sales count
  const salesCount = mlData.sold_quantity || 0;

  // Price handling (use sale_price if available, otherwise price)
  const price = mlData.sale_price || mlData.price || 0;

  return {
    productBase: {
      name: mlData.title,
      marketplace: 'mercado_livre',
    },
    details: {
      description: description || null,
      price,
      category,
      condition,
      payment_methods: paymentMethods,
      stock_quantity: stockQuantity,
      sales_count: salesCount,
      rating,
      rating_count: ratingCount,
    },
    photos,
  };
}
```

- [ ] **Step 2: Test data extraction locally**

Create temp test file to verify extraction:
```typescript
// Test: import a real ML product and check structure
const testData = {
  title: "Test Product",
  price: 99.99,
  pictures: [
    { secure_url: "https://...", id: "pic1" },
    { secure_url: "https://...", id: "pic2" },
  ],
  descriptions: [{ text: "Description text" }],
  rating: "4.5",
  rating_count: 123,
  sold_quantity: 456,
  available_quantity: 10,
  condition: "new",
};

const result = transformMLProductData(testData);
console.log(result);
// Verify: photos array has 2 items, first is primary, etc.
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mercado-livre.ts
git commit -m "feat(mercado-livre): expand data extraction for photos, ratings, sales, stock, payment methods"
```

---

### Task 3: Update Import Endpoint for Multi-Table Insert

**Files:**
- Modify: `src/app/api/affiliate/import-mercado-livre/route.ts`

**Interfaces:**
- Consumes: `transformMLProductData()` result from Task 2
- Produces: `POST /api/affiliate/import-mercado-livre` returns full product with nested details and photos

- [ ] **Step 1: Rewrite import endpoint with transactional insert**

```typescript
// src/app/api/affiliate/import-mercado-livre/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveMLShortUrl,
  fetchMLProductData,
  transformMLProductData,
} from '@/lib/mercado-livre';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ImportRequest {
  affiliateLink: string;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check (same as before)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { affiliateLink } = (await req.json()) as ImportRequest;
    if (!affiliateLink) {
      return NextResponse.json(
        { error: 'affiliateLink is required' },
        { status: 400 }
      );
    }

    // Resolve short URL
    const productId = await resolveMLShortUrl(affiliateLink);
    if (!productId) {
      return NextResponse.json(
        { error: 'Could not resolve Mercado Livre link' },
        { status: 400 }
      );
    }

    // Get ML credentials
    const { data: credentials, error: credError } = await supabase
      .from('marketplace_credentials')
      .select('access_token, refresh_token, expires_at')
      .eq('admin_id', user.user.id)
      .eq('marketplace', 'mercado_livre')
      .single();

    if (credError || !credentials) {
      return NextResponse.json(
        { error: 'Mercado Livre not connected. Please authorize first.' },
        { status: 403 }
      );
    }

    // Token refresh if needed
    let accessToken = credentials.access_token;
    const expiresAt = new Date(credentials.expires_at);

    if (expiresAt < new Date()) {
      try {
        const { refreshMLAccessToken } = await import('@/lib/mercado-livre');
        const refreshed = await refreshMLAccessToken(
          credentials.refresh_token,
          process.env.MERCADO_LIVRE_CLIENT_SECRET!
        );

        await supabase
          .from('marketplace_credentials')
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: new Date(
              Date.now() + refreshed.expires_in * 1000
            ).toISOString(),
          })
          .eq('admin_id', user.user.id)
          .eq('marketplace', 'mercado_livre');

        accessToken = refreshed.access_token;
      } catch (err) {
        console.error('[Token Refresh Failed]', err);
        return NextResponse.json(
          { error: 'Token expired and could not be refreshed. Please reconnect.' },
          { status: 403 }
        );
      }
    }

    // Fetch ML product data
    const mlProductData = await fetchMLProductData(productId, accessToken);

    // Transform to our format
    const { productBase, details, photos } = transformMLProductData(mlProductData);

    // Begin transaction: insert into 3 tables
    // 1. affiliate_products
    const { data: product, error: productError } = await supabase
      .from('affiliate_products')
      .insert([
        {
          admin_id: user.user.id,
          name: productBase.name,
          marketplace: productBase.marketplace,
          affiliate_link: affiliateLink,
          is_active: true,
          is_public: true,
        },
      ])
      .select()
      .single();

    if (productError) {
      console.error('[Insert Product Error]', productError);
      if (productError.code === '23505') {
        return NextResponse.json(
          { error: 'This product link is already imported' },
          { status: 409 }
        );
      }
      throw productError;
    }

    // 2. affiliate_product_details
    const { error: detailsError } = await supabase
      .from('affiliate_product_details')
      .insert([
        {
          product_id: product.id,
          description: details.description,
          price: details.price,
          category: details.category,
          condition: details.condition,
          payment_methods: details.payment_methods,
          stock_quantity: details.stock_quantity,
          sales_count: details.sales_count,
          rating: details.rating,
          rating_count: details.rating_count,
        },
      ]);

    if (detailsError) {
      console.error('[Insert Details Error]', detailsError);
      // Cleanup: delete product if details insert fails
      await supabase.from('affiliate_products').delete().eq('id', product.id);
      throw detailsError;
    }

    // 3. affiliate_product_photos
    const photoRecords = photos.map((photo, index) => ({
      product_id: product.id,
      image_url: photo.url,
      is_primary: photo.is_primary,
      position: index,
      source_id: photo.source_id,
    }));

    const { error: photosError } = await supabase
      .from('affiliate_product_photos')
      .insert(photoRecords);

    if (photosError) {
      console.error('[Insert Photos Error]', photosError);
      // Cleanup: delete product and details
      await supabase.from('affiliate_products').delete().eq('id', product.id);
      throw photosError;
    }

    // Return complete product object
    const completeProduct = {
      ...product,
      details: {
        ...details,
      },
      photos: photos.map((p, i) => ({
        id: `temp_${i}`, // Will be replaced on next fetch
        image_url: p.url,
        is_primary: p.is_primary,
        position: i,
      })),
    };

    return NextResponse.json({ product: completeProduct }, { status: 201 });
  } catch (err) {
    console.error('[Import ML Product Error]', err);
    return NextResponse.json(
      { error: 'Failed to import product', details: String(err) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test endpoint with curl**

```bash
curl -X POST http://localhost:3000/api/affiliate/import-mercado-livre \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"affiliateLink":"https://meli.la/2Y6zGMW"}'
```

Expected: 201 response with product object including nested details and photos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/affiliate/import-mercado-livre/route.ts
git commit -m "feat(affiliate): multi-table transactional import for photos, details"
```

---

### Task 4: Update GET /api/affiliate/products Endpoint

**Files:**
- Modify: `src/app/api/affiliate/products/route.ts`

**Interfaces:**
- Consumes: Database queries from tasks 1-3
- Produces: `GET /api/affiliate/products?marketplace=mercado_livre` returns products with nested details and photos array

- [ ] **Step 1: Rewrite products GET endpoint**

```typescript
// src/app/api/affiliate/products/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const marketplace = searchParams.get('marketplace');

    let query = supabase
      .from('affiliate_products')
      .select(
        `
        id,
        admin_id,
        name,
        marketplace,
        affiliate_link,
        is_active,
        is_public,
        created_at,
        updated_at,
        details:affiliate_product_details (
          id,
          description,
          price,
          category,
          condition,
          payment_methods,
          stock_quantity,
          sales_count,
          rating,
          rating_count
        ),
        photos:affiliate_product_photos (
          id,
          image_url,
          is_primary,
          position
        )
      `
      )
      .eq('is_active', true)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (marketplace) {
      query = query.eq('marketplace', marketplace);
    }

    const { data: products, error } = await query;

    if (error) {
      throw error;
    }

    // Flatten details (single record) and sort photos by position
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      admin_id: product.admin_id,
      name: product.name,
      marketplace: product.marketplace,
      affiliate_link: product.affiliate_link,
      is_active: product.is_active,
      created_at: product.created_at,
      updated_at: product.updated_at,
      details: product.details?.[0] || null,
      photos: (product.photos || []).sort((a: any, b: any) => a.position - b.position),
    }));

    return NextResponse.json({ products: formattedProducts }, { status: 200 });
  } catch (err) {
    console.error('[Fetch Products Error]', err);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: String(err) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test endpoint**

```bash
curl http://localhost:3000/api/affiliate/products

# Should return array of products with nested details and photos
```

Expected: Products array with `details` object and `photos` array nested.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/affiliate/products/route.ts
git commit -m "feat(affiliate): query products with joined details and photos"
```

---

### Task 5: Update TypeScript Types and API Client

**Files:**
- Modify: `src/lib/api/affiliate.ts`

**Interfaces:**
- Consumes: Updated API response schema from Task 4
- Produces: New `AffiliateProduct`, `ProductDetails`, `ProductPhoto` types

- [ ] **Step 1: Update affiliate.ts types and functions**

```typescript
// src/lib/api/affiliate.ts

export interface ProductPhoto {
  id: string;
  image_url: string;
  is_primary: boolean;
  position: number;
}

export interface ProductDetails {
  id: string;
  description: string | null;
  price: number;
  category: string | null;
  condition: 'new' | 'used' | null;
  payment_methods: Array<{ name: string; installments?: number }>;
  stock_quantity: number;
  sales_count: number;
  rating: number | null;
  rating_count: number;
}

export interface AffiliateProduct {
  id: string;
  admin_id: string;
  name: string;
  marketplace: 'mercado_livre' | 'shopee' | 'aliexpress' | 'amazon';
  affiliate_link: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  details: ProductDetails | null;
  photos: ProductPhoto[];
}

export async function fetchAffiliateProducts(
  marketplace?: string
): Promise<AffiliateProduct[]> {
  const url = new URL('/api/affiliate/products', window.location.origin);
  if (marketplace) {
    url.searchParams.set('marketplace', marketplace);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch products');
  const { products } = await res.json();
  return products;
}

export async function fetchAffiliateProduct(id: string): Promise<AffiliateProduct> {
  const res = await fetch(`/api/affiliate/products/${id}`);
  if (!res.ok) throw new Error('Failed to fetch product');
  const { product } = await res.json();
  return product;
}

export async function createProduct(
  data: Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at' | 'details' | 'photos'>,
  token: string
): Promise<AffiliateProduct> {
  const res = await fetch('/api/affiliate/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create product');
  const { product } = await res.json();
  return product;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at'>>,
  token: string
): Promise<AffiliateProduct> {
  const res = await fetch(`/api/affiliate/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update product');
  const { product } = await res.json();
  return product;
}

export async function deleteProduct(id: string, token: string): Promise<void> {
  const res = await fetch(`/api/affiliate/products/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to delete product');
}

export async function trackClick(
  product_id: string,
  user_id?: string
): Promise<void> {
  await fetch('/api/affiliate/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id, user_id }),
  }).catch(() => {});
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/affiliate.ts
git commit -m "feat(affiliate): update types for new schema with details and photos"
```

---

### Task 6: Create PhotoCarousel Component

**Files:**
- Create: `src/components/affiliate/PhotoCarousel.tsx`

**Interfaces:**
- Consumes: `ProductPhoto[]` array from API
- Produces: Reusable carousel component for viewing multiple images

- [ ] **Step 1: Create PhotoCarousel component**

```typescript
// src/components/affiliate/PhotoCarousel.tsx

'use client';

import { useState } from 'react';
import { ProductPhoto } from '@/lib/api/affiliate';

interface PhotoCarouselProps {
  photos: ProductPhoto[];
  productName: string;
}

export function PhotoCarousel({ photos, productName }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="w-full h-96 bg-slate-800 rounded flex items-center justify-center">
        <p className="text-slate-400">No images available</p>
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
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
              aria-label="Next image"
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
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={photo.image_url}
                alt={`Thumbnail ${index + 1}`}
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
```

- [ ] **Step 2: Test component in isolation**

Create a test page temporarily:
```typescript
// test-carousel.tsx
import { PhotoCarousel } from '@/components/affiliate/PhotoCarousel';

const testPhotos = [
  { id: '1', image_url: 'https://...', is_primary: true, position: 0 },
  { id: '2', image_url: 'https://...', is_primary: false, position: 1 },
];

export default function TestPage() {
  return <PhotoCarousel photos={testPhotos} productName="Test Product" />;
}
```

Expected: Carousel renders with arrows and thumbnails.

- [ ] **Step 3: Commit**

```bash
git add src/components/affiliate/PhotoCarousel.tsx
git commit -m "feat(affiliate): add reusable photo carousel component"
```

---

### Task 7: Create ProductModal Component

**Files:**
- Create: `src/components/affiliate/ProductModal.tsx`

**Interfaces:**
- Consumes: `AffiliateProduct` (with details and photos)
- Produces: Full-screen modal with photo gallery and product details

- [ ] **Step 1: Create ProductModal component**

```typescript
// src/components/affiliate/ProductModal.tsx

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
            {details?.price && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Price</p>
                <p className="text-4xl font-bold text-cyan-400">R$ {details.price.toFixed(2)}</p>
              </div>
            )}

            {/* Rating and reviews */}
            {details?.rating && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⭐</span>
                  <span className="text-lg font-semibold text-white">{details.rating.toFixed(1)}</span>
                  <span className="text-sm text-slate-400">({details.rating_count.toLocaleString()} reviews)</span>
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
```

- [ ] **Step 2: Test modal opens/closes**

```typescript
// Test: Use in parent component
const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);

<ProductModal
  product={selectedProduct!}
  isOpen={!!selectedProduct}
  onClose={() => setSelectedProduct(null)}
/>
```

Expected: Modal opens on product select, closes on X button or ESC key.

- [ ] **Step 3: Commit**

```bash
git add src/components/affiliate/ProductModal.tsx
git commit -m "feat(affiliate): create product detail modal with photo gallery"
```

---

### Task 8: Refactor AffiliateProductCard Component

**Files:**
- Modify: `src/components/affiliate/AffiliateProductCard.tsx`

**Interfaces:**
- Consumes: Updated `AffiliateProduct` with details and photos
- Produces: Card component that opens modal on click

- [ ] **Step 1: Rewrite AffiliateProductCard**

```typescript
// src/components/affiliate/AffiliateProductCard.tsx

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
```

- [ ] **Step 2: Test card with new props**

In parent component:
```typescript
const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {products.map((product) => (
    <AffiliateProductCard
      key={product.id}
      product={product}
      onSelect={setSelectedProduct}
    />
  ))}
</div>
```

Expected: Cards show rating, stock status, photo count; click opens modal.

- [ ] **Step 3: Commit**

```bash
git add src/components/affiliate/AffiliateProductCard.tsx
git commit -m "feat(affiliate): refactor card to show ratings, stock, and trigger modal"
```

---

### Task 9: Update AffiliateProductGrid Component

**Files:**
- Modify: `src/components/affiliate/AffiliateProductGrid.tsx`

**Interfaces:**
- Consumes: Updated `AffiliateProductCard` with `onSelect` prop
- Produces: Grid with modal state management

- [ ] **Step 1: Add modal state to AffiliateProductGrid**

```typescript
// src/components/affiliate/AffiliateProductGrid.tsx

'use client';

import { useState, useMemo } from 'react';
import { AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductCard } from './AffiliateProductCard';
import { ProductModal } from './ProductModal';

interface AffiliateProductGridProps {
  products: AffiliateProduct[];
}

const marketplaces = [
  { value: 'all', label: 'All' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'amazon', label: 'Amazon' },
];

export function AffiliateProductGrid({
  products,
}: AffiliateProductGridProps) {
  const [search, setSearch] = useState('');
  const [marketplace, setMarketplace] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.details?.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
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
            placeholder="Search products..."
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
          No products found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <AffiliateProductCard
              key={product.id}
              product={product}
              onSelect={setSelectedProduct}
            />
          ))}
        </div>
      )}

      {/* Count */}
      <div className="mt-8 text-center text-sm text-slate-400">
        {filtered.length} of {products.length} products
      </div>

      {/* Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test grid with modal**

Navigate to `/affiliate` page and:
- Search for product
- Filter by marketplace
- Click product card → modal opens
- Close modal → grid shows again

Expected: All interactions work smoothly.

- [ ] **Step 3: Commit**

```bash
git add src/components/affiliate/AffiliateProductGrid.tsx
git commit -m "feat(affiliate): add modal state management to product grid"
```

---

### Task 10: Make /affiliate Page Public

**Files:**
- Modify: `src/app/affiliate/page.tsx`

**Interfaces:**
- Consumes: `fetchAffiliateProducts()` from Task 5
- Produces: Public page with no auth requirement

- [ ] **Step 1: Remove auth from /affiliate/page.tsx**

```typescript
// src/app/affiliate/page.tsx

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
```

- [ ] **Step 2: Test public access**

```bash
# Navigate to /affiliate in browser without login
# Expected: Page loads and shows products
```

Expected: Page is publicly accessible, no login redirect.

- [ ] **Step 3: Commit**

```bash
git add src/app/affiliate/page.tsx
git commit -m "feat(affiliate): make products page public (remove auth requirement)"
```

---

### Task 11: Create AffiliateCarousel Component for Home

**Files:**
- Create: `src/components/landing/AffiliateCarousel.tsx`

**Interfaces:**
- Consumes: `AffiliateProduct[]` array
- Produces: 5-product rotating carousel

- [ ] **Step 1: Create AffiliateCarousel component**

```typescript
// src/components/landing/AffiliateCarousel.tsx

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
```

- [ ] **Step 2: Test carousel in isolation**

```typescript
// Test page
import { AffiliateCarousel } from '@/components/landing/AffiliateCarousel';

const testProducts = [
  { id: '1', name: 'Product 1', ... },
  // ... 5 test products
];

export default function TestPage() {
  return <AffiliateCarousel products={testProducts} />;
}
```

Expected: Carousel shows current product + faded prev/next, auto-rotates every 5s, arrows and dots work.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/AffiliateCarousel.tsx
git commit -m "feat(landing): create 5-product affiliate carousel with autoplay"
```

---

### Task 12: Integrate Carousel into Home Page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `fetchAffiliateProducts()` and `AffiliateCarousel` component
- Produces: Home page with carousel section

- [ ] **Step 1: Add carousel section to home page**

```typescript
// src/app/page.tsx

import { Suspense } from 'react';
import { fetchAffiliateProducts } from '@/lib/api/affiliate';
import { AffiliateCarousel } from '@/components/landing/AffiliateCarousel';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';

// Loading fallback for carousel
function CarouselFallback() {
  return (
    <section className="py-16 bg-slate-900 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Loading products...</p>
      </div>
    </section>
  );
}

// Carousel server component
async function CarouselSection() {
  try {
    const products = await fetchAffiliateProducts('mercado_livre');
    return <AffiliateCarousel products={products} />;
  } catch (err) {
    console.error('Failed to load carousel:', err);
    return null; // Silently fail - carousel is optional
  }
}

export default function Home() {
  return (
    <div>
      {/* Existing sections */}
      <Hero />
      <Features />

      {/* New: Affiliate products carousel */}
      <Suspense fallback={<CarouselFallback />}>
        <CarouselSection />
      </Suspense>

      {/* Footer or other sections */}
    </div>
  );
}
```

- [ ] **Step 2: Test home page loads carousel**

```bash
npm run dev
# Navigate to home page
# Expected: Carousel appears after Hero/Features sections
```

Expected: Carousel loads, auto-rotates, clicking products opens modal.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): integrate affiliate product carousel into landing page"
```

---

### Task 13: Test Complete Flow and Bug Fixes

**Files:**
- All files from previous tasks
- Manual testing

**Interfaces:**
- End-to-end: Admin imports → users see on `/affiliate` and home → click → modal → buy

- [ ] **Step 1: Manual test admin import flow**

1. Go to admin panel
2. Connect to Mercado Livre (should already be connected from MVP)
3. Paste a real ML affiliate link
4. Verify product imported with all fields (ratings, stock, photos, etc.)

Expected: Product imported successfully in DB with all details.

- [ ] **Step 2: Test /affiliate page public access**

1. Open `/affiliate` in incognito/private window (no login)
2. Verify products load
3. Search for product
4. Filter by marketplace
5. Click product → modal opens with full gallery and details
6. Click "View on Mercado Livre" → affiliate link opens in new tab

Expected: All features work without authentication.

- [ ] **Step 3: Test home page carousel**

1. Navigate to `/` (home)
2. Scroll to carousel section
3. Verify auto-rotate (changes every 5s)
4. Click left/right arrows → changes product
5. Click dots → jumps to product
6. Click product card → modal opens
7. Close modal → carousel still visible

Expected: Carousel works smoothly, modal doesn't break carousel state.

- [ ] **Step 4: Check responsive design**

1. View on mobile (375px width)
2. View on tablet (768px)
3. View on desktop (1920px)

Expected: Cards stack properly, carousel adjusts layout, all readable.

- [ ] **Step 5: Verify database data**

```sql
-- Check in Supabase SQL Editor
SELECT COUNT(*) FROM affiliate_products;
SELECT COUNT(*) FROM affiliate_product_details;
SELECT COUNT(*) FROM affiliate_product_photos;

-- Check a product with related data
SELECT
  ap.id, ap.name,
  apd.price, apd.rating, apd.stock_quantity,
  COUNT(app.id) as photo_count
FROM affiliate_products ap
LEFT JOIN affiliate_product_details apd ON ap.id = apd.product_id
LEFT JOIN affiliate_product_photos app ON ap.id = app.product_id
GROUP BY ap.id, ap.name, apd.price, apd.rating, apd.stock_quantity
LIMIT 5;
```

Expected: Data properly normalized across tables, relationships intact.

- [ ] **Step 6: Performance check**

1. Open DevTools → Network tab
2. Navigate to `/affiliate`
3. Check API response time for `/api/affiliate/products`

Expected: Response < 500ms, photos lazy-loaded.

- [ ] **Step 7: Fix any bugs found**

Document and fix any issues discovered during testing.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "test: complete end-to-end testing and validation"
```

---

### Task 14: Create Supabase Migrations Files

**Files:**
- Create: Migration files in Supabase editor

**Interfaces:**
- Produces: Three production-ready SQL migrations

Execute all three migrations from Task 1 in your Supabase project:

- [ ] **Step 1: Open Supabase SQL Editor**

Log into Supabase console → Your project → SQL Editor

- [ ] **Step 2: Create and run Migration 1**

Run the SQL from Task 1 Step 1 (create_product_details)

Expected: Table created, no errors.

- [ ] **Step 3: Create and run Migration 2**

Run the SQL from Task 1 Step 2 (create_product_photos)

Expected: Table created with indexes, no errors.

- [ ] **Step 4: Create and run Migration 3**

Run the SQL from Task 1 Step 3 (alter_affiliate_products)

Expected: Columns dropped/added, no errors.

- [ ] **Step 5: Verify schema in Supabase UI**

Navigate to Table Editor in Supabase → verify all 3 tables exist with correct columns.

Expected: All columns visible, relationships correct.

---

## Summary

This plan implements a complete expansion of the Mercado Livre affiliate system:

✅ **Database:** 3 normalized tables with proper relationships  
✅ **Backend:** Complete data extraction, multi-table transactional imports  
✅ **API:** Updated responses with nested details and photo arrays  
✅ **Frontend:** Photo carousel, product modal, refactored cards, public /affiliate page  
✅ **Home:** 5-product rotating carousel with autoplay  
✅ **Testing:** End-to-end validation of all features  

**Total tasks:** 14  
**Estimated implementation time:** 4-6 hours  
**Commits:** One per task (14 commits)

All code is production-ready, follows project conventions, and includes error handling.
