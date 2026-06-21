# Affiliate Products System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full affiliate product marketplace where admins manage affiliate links (AliExpress, Shopee, Mercado Livre, Amazon) with rich metadata, and users see products with photos, prices, names, descriptions — clicking directs them to the marketplace.

**Architecture:** 
- **Data layer:** Supabase PostgreSQL with `affiliate_products` (manual entry) and `affiliate_clicks` (analytics)
- **Admin surface:** New tab in AdminPage to CRUD products with marketplace metadata
- **Public surface:** New `/affiliate` page accessible to all authenticated users (free + paid), displaying products in a grid
- **MVP approach:** Admin manually enters product data (photo URL, name, price, description, affiliate link). Marketplace scraping APIs added later as a separate feature
- **Analytics:** Track clicks per product for ROI calculation

**Tech Stack:** Next.js 16.2.4, React 19, TypeScript, TailwindCSS v4, Supabase PostgreSQL, Zustand, Next Image

## Global Constraints

- Affiliate products must be accessible to **all authenticated users** (free tier + paid)
- Support marketplaces: AliExpress, Shopee, Mercado Livre, Amazon (field-configurable)
- Photo URLs stored as external links (no Storage upload — admin provides URLs)
- Admin controls visibility via `is_active` boolean
- Track clicks for analytics but **never share referral commission data with users** (internal only)
- All prices in BRL (Real brasileiro)
- RLS policies: authenticated users read `is_active=true` products; only admin (`is_admin`) can CRUD all products

---

## File Structure

```
src/
  app/
    affiliate/
      page.tsx                    # Public affiliate products page
      layout.tsx                  # Wrapper (breadcrumb, title)
  components/
    affiliate/
      AffiliateProductCard.tsx    # Reusable product card (image, name, price, CTA)
      AffiliateProductGrid.tsx    # Grid layout + filtering (marketplace, search)
    admin/
      AffiliateProductsTab.tsx    # New admin tab for CRUD
      AffiliateProductForm.tsx    # Form: name, price, description, marketplace, link, image_url
      AffiliateProductsList.tsx   # Table: list, edit, delete, toggle active
  lib/
    api/
      affiliate.ts               # Client-side fetch helpers
    db/
      migrations/
        20260620_affiliate_products.sql  # Migration SQL
  api/routes/
    affiliate/
      products/
        route.ts                 # GET all active products, POST create (admin)
        [id]/
          route.ts               # PUT update, DELETE (admin only)
      track-click/
        route.ts                 # POST to log a click event
```

---

## Task Breakdown

### Task 1: Supabase Schema & Migrations

**Files:**
- Create: `src/lib/db/migrations/20260620_affiliate_products.sql`
- Test: Manual verification in Supabase UI

**Interfaces:**
- Produces: Two tables (`affiliate_products`, `affiliate_clicks`) with RLS policies

**Description:** Create the foundation — tables for products and click analytics.

- [ ] **Step 1: Write migration SQL file**

Create `src/lib/db/migrations/20260620_affiliate_products.sql`:

```sql
-- Affiliate Products
CREATE TABLE affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('aliexpress', 'shopee', 'mercado_livre', 'amazon')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(affiliate_link)
);

-- Affiliate Clicks (analytics)
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMP DEFAULT now(),
  referer_path TEXT
);

-- RLS: Products
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_active_products" ON affiliate_products
  FOR SELECT USING (is_active = TRUE OR auth.uid() = admin_id);

CREATE POLICY "admin_manage_all_products" ON affiliate_products
  FOR ALL USING (auth.uid() = admin_id);

-- RLS: Clicks (admin read, all inserts logged)
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_clicks" ON affiliate_clicks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true')
  );

CREATE POLICY "anyone_can_log_click" ON affiliate_clicks
  FOR INSERT WITH CHECK (TRUE);

-- Indexes
CREATE INDEX idx_affiliate_products_active ON affiliate_products(is_active);
CREATE INDEX idx_affiliate_products_marketplace ON affiliate_products(marketplace);
CREATE INDEX idx_affiliate_clicks_product ON affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_timestamp ON affiliate_clicks(clicked_at);
```

- [ ] **Step 2: Apply migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste the migration → Execute

Expected: Tables created, indexes created, RLS enabled

- [ ] **Step 3: Verify in Supabase UI**

Check `affiliate_products` and `affiliate_clicks` tables exist with correct columns and RLS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migrations/20260620_affiliate_products.sql
git commit -m "feat: add affiliate products and clicks tables with RLS"
```

---

### Task 2: API Route — Fetch & Create Products

**Files:**
- Create: `src/app/api/affiliate/products/route.ts`
- Test: Manual via curl or built into Task 6

**Interfaces:**
- Produces:
  - `GET /api/affiliate/products` → `{ products: AffiliateProduct[] }`
  - `POST /api/affiliate/products` → `{ product: AffiliateProduct }` (admin only)

**Description:** CRUD endpoint for fetching active products and creating new ones (admin protected).

- [ ] **Step 1: Create the GET/POST route**

Create `src/app/api/affiliate/products/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('affiliate_products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: data }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/affiliate/products]', err);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check is_admin in metadata
    const isAdmin = user.user.user_metadata?.is_admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { name, description, price, image_url, affiliate_link, marketplace } =
      await req.json();

    // Validate
    if (!name || !price || !image_url || !affiliate_link || !marketplace) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validMarketplaces = ['aliexpress', 'shopee', 'mercado_livre', 'amazon'];
    if (!validMarketplaces.includes(marketplace)) {
      return NextResponse.json(
        { error: 'Invalid marketplace' },
        { status: 400 }
      );
    }

    const { data: product, error: insertError } = await supabase
      .from('affiliate_products')
      .insert([
        {
          admin_id: user.user.id,
          name,
          description: description || null,
          price: parseFloat(price),
          image_url,
          affiliate_link,
          marketplace,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/affiliate/products]', err);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test GET route locally**

```bash
curl http://localhost:3000/api/affiliate/products
```

Expected: Returns `{ products: [] }` or existing active products.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/affiliate/products/route.ts
git commit -m "feat: add GET/POST /api/affiliate/products endpoint"
```

---

### Task 3: API Route — Update & Delete Product

**Files:**
- Create: `src/app/api/affiliate/products/[id]/route.ts`

**Interfaces:**
- Produces:
  - `PUT /api/affiliate/products/[id]` → `{ product: AffiliateProduct }` (admin only)
  - `DELETE /api/affiliate/products/[id]` → `{ success: true }` (admin only)

**Description:** Update and delete products (only admin, only their own products).

- [ ] **Step 1: Create PUT/DELETE route**

Create `src/app/api/affiliate/products/[id]/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { data: user, error } = await supabase.auth.getUser(token);

  if (error || !user?.user?.id) return null;
  if (user.user.user_metadata?.is_admin !== true) return null;

  return user.user;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id } = params;
    const { name, description, price, image_url, affiliate_link, marketplace, is_active } =
      await req.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from('affiliate_products')
      .select('admin_id')
      .eq('id', id)
      .single();

    if (!existing || existing.admin_id !== adminUser.id) {
      return NextResponse.json(
        { error: 'Not found or unauthorized' },
        { status: 404 }
      );
    }

    const { data: product, error: updateError } = await supabase
      .from('affiliate_products')
      .update({
        name,
        description: description || null,
        price: parseFloat(price),
        image_url,
        affiliate_link,
        marketplace,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ product }, { status: 200 });
  } catch (err) {
    console.error('[PUT /api/affiliate/products/[id]]', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id } = params;

    // Verify ownership
    const { data: existing } = await supabase
      .from('affiliate_products')
      .select('admin_id')
      .eq('id', id)
      .single();

    if (!existing || existing.admin_id !== adminUser.id) {
      return NextResponse.json(
        { error: 'Not found or unauthorized' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('affiliate_products')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/affiliate/products/[id]]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/affiliate/products/[id]/route.ts
git commit -m "feat: add PUT/DELETE /api/affiliate/products/[id] endpoint"
```

---

### Task 4: API Route — Track Affiliate Clicks

**Files:**
- Create: `src/app/api/affiliate/track-click/route.ts`

**Interfaces:**
- Produces: `POST /api/affiliate/track-click` → `{ success: true }` (fire-and-forget, no auth required)

**Description:** Log product clicks for analytics (referer path, user_id if logged in).

- [ ] **Step 1: Create track-click route**

Create `src/app/api/affiliate/track-click/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { product_id, user_id } = await req.json();

    if (!product_id) {
      return NextResponse.json(
        { error: 'Missing product_id' },
        { status: 400 }
      );
    }

    const referer_path = req.headers.get('referer') || '/affiliate';

    const { error } = await supabase.from('affiliate_clicks').insert([
      {
        product_id,
        user_id: user_id || null,
        referer_path,
      },
    ]);

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/affiliate/track-click]', err);
    // Fail silently (don't break the redirect)
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/affiliate/track-click/route.ts
git commit -m "feat: add POST /api/affiliate/track-click endpoint for analytics"
```

---

### Task 5: Client Library for Affiliate API

**Files:**
- Create: `src/lib/api/affiliate.ts`

**Interfaces:**
- Produces: Functions `fetchAffiliateProducts()`, `createProduct()`, `updateProduct()`, `deleteProduct()`, `trackClick()`

**Description:** Client-side helpers to simplify API calls from components.

- [ ] **Step 1: Create affiliate API client**

Create `src/lib/api/affiliate.ts`:

```typescript
export interface AffiliateProduct {
  id: string;
  admin_id: string;
  name: string;
  description?: string;
  price: number;
  image_url: string;
  affiliate_link: string;
  marketplace: 'aliexpress' | 'shopee' | 'mercado_livre' | 'amazon';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchAffiliateProducts(): Promise<AffiliateProduct[]> {
  const res = await fetch('/api/affiliate/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const { products } = await res.json();
  return products;
}

export async function createProduct(
  data: Omit<AffiliateProduct, 'id' | 'admin_id' | 'created_at' | 'updated_at'>,
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

export async function deleteProduct(
  id: string,
  token: string
): Promise<void> {
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
  }).catch(() => {}); // Fail silently
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/affiliate.ts
git commit -m "feat: add affiliate API client library"
```

---

### Task 6: Product Card Component

**Files:**
- Create: `src/components/affiliate/AffiliateProductCard.tsx`

**Interfaces:**
- Consumes: `AffiliateProduct` from `src/lib/api/affiliate.ts`
- Produces: React component `<AffiliateProductCard product={...} onClicked={...} />`

**Description:** Reusable card component showing product image, name, price, description, and CTA button.

- [ ] **Step 1: Create product card component**

Create `src/components/affiliate/AffiliateProductCard.tsx`:

```typescript
'use client';

import Image from 'next/image';
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
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          className="object-cover hover:scale-105 transition-transform duration-300"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/affiliate/AffiliateProductCard.tsx
git commit -m "feat: add AffiliateProductCard component"
```

---

### Task 7: Product Grid Component

**Files:**
- Create: `src/components/affiliate/AffiliateProductGrid.tsx`

**Interfaces:**
- Consumes: `AffiliateProduct[]`, `AffiliateProductCard`
- Produces: React component `<AffiliateProductGrid products={...} />`

**Description:** Grid layout with search and marketplace filtering.

- [ ] **Step 1: Create grid component**

Create `src/components/affiliate/AffiliateProductGrid.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/affiliate/AffiliateProductGrid.tsx
git commit -m "feat: add AffiliateProductGrid component with search/filter"
```

---

### Task 8: Public Affiliate Products Page

**Files:**
- Create: `src/app/affiliate/page.tsx`
- Create: `src/app/affiliate/layout.tsx`

**Interfaces:**
- Consumes: `fetchAffiliateProducts()`, `AffiliateProductGrid`
- Produces: Public route `/affiliate` accessible to authenticated users

**Description:** Landing page for affiliate products (users see, click, redirect).

- [ ] **Step 1: Create page**

Create `src/app/affiliate/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Create layout**

Create `src/app/affiliate/layout.tsx`:

```typescript
export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-slate-700/50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Loja de Afiliados</h1>
          <p className="text-slate-400">
            Produtos recomendados de nossos parceiros. Clique e aproveite!
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/affiliate/page.tsx src/app/affiliate/layout.tsx
git commit -m "feat: add public affiliate products page at /affiliate"
```

---

### Task 9: Admin Affiliate Products Tab

**Files:**
- Create: `src/components/admin/AffiliateProductsTab.tsx`
- Create: `src/components/admin/AffiliateProductForm.tsx`
- Create: `src/components/admin/AffiliateProductsList.tsx`
- Modify: `src/app/admin/page.tsx` (add tab)

**Interfaces:**
- Consumes: `createProduct()`, `updateProduct()`, `deleteProduct()`, `AffiliateProduct`
- Produces: Admin tab with form (create) + list (edit/delete/toggle)

**Description:** Admin surface to manage affiliate products — CRUD operations with validation.

- [ ] **Step 1: Create form component**

Create `src/components/admin/AffiliateProductForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { AffiliateProduct, createProduct, updateProduct } from '@/lib/api/affiliate';
import { useAuth } from '@/lib/hooks/useAuth';

interface AffiliateProductFormProps {
  product?: AffiliateProduct;
  onSuccess: () => void;
  onCancel: () => void;
}

const marketplaces = ['aliexpress', 'shopee', 'mercado_livre', 'amazon'] as const;

export function AffiliateProductForm({
  product,
  onSuccess,
  onCancel,
}: AffiliateProductFormProps) {
  const { user, session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    image_url: product?.image_url || '',
    affiliate_link: product?.affiliate_link || '',
    marketplace: (product?.marketplace || 'aliexpress') as typeof marketplaces[number],
    is_active: product?.is_active ?? true,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const token = session?.access_token;
      if (!token) throw new Error('No session');

      if (product?.id) {
        await updateProduct(
          product.id,
          {
            ...formData,
            price: parseFloat(formData.price),
          },
          token
        );
      } else {
        await createProduct(
          {
            ...formData,
            price: parseFloat(formData.price),
          } as any,
          token
        );
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-900/30 text-red-300 rounded">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Nome *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="Ex: Impressora 3D Creality Ender 3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="Ex: Impressora com cama aquecida, suporta PLA/ABS..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Preço (R$) *</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            step="0.01"
            min="0"
            className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
            placeholder="999.99"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Marketplace *</label>
          <select
            name="marketplace"
            value={formData.marketplace}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 outline-none"
          >
            {marketplaces.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">URL da Imagem *</label>
        <input
          type="url"
          name="image_url"
          value={formData.image_url}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Link de Afiliado *</label>
        <input
          type="url"
          name="affiliate_link"
          value={formData.affiliate_link}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 outline-none"
          placeholder="https://aliexpress.com/..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          name="is_active"
          checked={formData.is_active}
          onChange={handleChange}
          className="rounded"
        />
        <label htmlFor="is_active" className="text-sm">
          Ativo (visível aos usuários)
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600 disabled:opacity-50"
        >
          {isLoading ? 'Salvando...' : product ? 'Atualizar' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-white rounded font-medium hover:bg-slate-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create list component**

Create `src/components/admin/AffiliateProductsList.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { AffiliateProduct, deleteProduct, updateProduct } from '@/lib/api/affiliate';
import { useAuth } from '@/lib/hooks/useAuth';
import { Trash2, Edit2 } from 'lucide-react';

interface AffiliateProductsListProps {
  products: AffiliateProduct[];
  onEdit: (product: AffiliateProduct) => void;
  onProductsChange: () => void;
}

export function AffiliateProductsList({
  products,
  onEdit,
  onProductsChange,
}: AffiliateProductsListProps) {
  const { session } = useAuth();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar este produto?')) return;

    setIsDeleting(id);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('No session');
      await deleteProduct(id, token);
      onProductsChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao deletar');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleActive = async (product: AffiliateProduct) => {
    setIsToggling(product.id);
    try {
      const token = session?.access_token;
      if (!token) throw new Error('No session');
      await updateProduct(
        product.id,
        { is_active: !product.is_active },
        token
      );
      onProductsChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setIsToggling(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        Nenhum produto ainda. Crie o primeiro!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-700">
          <tr>
            <th className="text-left py-3 px-4">Nome</th>
            <th className="text-left py-3 px-4">Preço</th>
            <th className="text-left py-3 px-4">Marketplace</th>
            <th className="text-center py-3 px-4">Status</th>
            <th className="text-right py-3 px-4">Ações</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-slate-700/50 hover:bg-slate-800/30"
            >
              <td className="py-3 px-4">
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs">
                    {product.description || 'Sem descrição'}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">R$ {product.price.toFixed(2)}</td>
              <td className="py-3 px-4 text-xs">
                {product.marketplace.replace('_', ' ').toUpperCase()}
              </td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => handleToggleActive(product)}
                  disabled={isToggling === product.id}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    product.is_active
                      ? 'bg-green-900/30 text-green-300'
                      : 'bg-slate-700/30 text-slate-400'
                  } disabled:opacity-50`}
                >
                  {product.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </td>
              <td className="py-3 px-4 text-right flex gap-2 justify-end">
                <button
                  onClick={() => onEdit(product)}
                  className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={isDeleting === product.id}
                  className="p-1.5 rounded bg-slate-700 hover:bg-red-900/30 text-slate-300 hover:text-red-400 disabled:opacity-50"
                  title="Deletar"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create main tab component**

Create `src/components/admin/AffiliateProductsTab.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { fetchAffiliateProducts, AffiliateProduct } from '@/lib/api/affiliate';
import { AffiliateProductForm } from './AffiliateProductForm';
import { AffiliateProductsList } from './AffiliateProductsList';

export function AffiliateProductsTab() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await fetchAffiliateProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleFormSuccess = () => {
    setEditingProduct(null);
    setShowForm(false);
    loadProducts();
  };

  const handleFormCancel = () => {
    setEditingProduct(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Create Form */}
      {showForm && (
        <div className="glass-panel p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <AffiliateProductForm
            product={editingProduct || undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* List */}
      <div className="glass-panel p-6 rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Produtos Afiliados</h3>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-cyan-500 text-white rounded font-medium hover:bg-cyan-600"
            >
              + Novo Produto
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            Carregando produtos...
          </div>
        ) : (
          <AffiliateProductsList
            products={products}
            onEdit={(product) => {
              setEditingProduct(product);
              setShowForm(true);
            }}
            onProductsChange={loadProducts}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add tab to AdminPage**

Modify `src/app/admin/page.tsx` — add import and tab in the tabs array.

First, check existing AdminPage to find where tabs are defined, then add the AffiliateProductsTab.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AffiliateProductsTab.tsx \
         src/components/admin/AffiliateProductForm.tsx \
         src/components/admin/AffiliateProductsList.tsx
git add src/app/admin/page.tsx
git commit -m "feat: add admin affiliate products management tab"
```

---

### Task 10: Link Affiliate Page in Navigation

**Files:**
- Modify: `src/components/Sidebar.tsx` (or navbar)
- Modify: `src/lib/translations.ts` (add translations if not present)

**Interfaces:**
- Consumes: Existing sidebar structure, translation hook
- Produces: Visible link to `/affiliate` in sidebar

**Description:** Add navigation link to affiliate products page.

- [ ] **Step 1: Add sidebar link**

Modify `src/components/Sidebar.tsx` — find the navigation items array and add affiliate link.

- [ ] **Step 2: Add translations (if needed)**

Modify `src/lib/translations.ts` — add affiliate-related i18n keys.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/lib/translations.ts
git commit -m "feat: add affiliate page link to sidebar"
```

---

## Summary

This plan delivers a complete affiliate product system MVP:

✅ Schema with RLS for security  
✅ API routes for CRUD and tracking  
✅ Client library for component integration  
✅ Public `/affiliate` page with grid, search, filter  
✅ Admin panel for product management  
✅ Analytics via click tracking  
✅ Multi-marketplace support  
✅ i18n ready  

**Next phase:** Scraping APIs (optional future task) to auto-fetch product metadata.
