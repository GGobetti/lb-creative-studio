# Mercado Livre Integration Expansion - Design Spec

**Date:** 2026-06-25  
**Status:** ✅ Implementado em produção (main) — Carousel pendente de teste  
**Branch:** `main`

---

## 📋 Overview

Expand the current Mercado Livre MVP to capture complete product data, support multi-image galleries, normalize the database schema, and make the affiliate products page public with a landing page carousel.

**Success Criteria:**
- Admin can import products with complete data (photos, ratings, sales, stock, payment methods, condition, categories)
- Users see `/affiliate` page publicly (no auth required)
- Home/landing has a 5-product carousel
- Clicking a product opens modal with full gallery + all details
- Database schema supports future scaling and efficient queries

---

## 🗄️ Database Schema

### Migration 1: Create `affiliate_product_details` table

```sql
CREATE TABLE affiliate_product_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(255),
  condition VARCHAR(50), -- 'new' or 'used'
  payment_methods JSONB, -- Array of payment options
  stock_quantity INT,
  sales_count INT DEFAULT 0,
  rating DECIMAL(2, 1), -- 0-5
  rating_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_details_product_id ON affiliate_product_details(product_id);
```

### Migration 2: Create `affiliate_product_photos` table

```sql
CREATE TABLE affiliate_product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
  image_url VARCHAR(2048) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  position INT DEFAULT 0,
  source_id VARCHAR(255), -- ML photo ID for dedup
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_photos_product_id ON affiliate_product_photos(product_id);
CREATE INDEX idx_product_photos_source_id ON affiliate_product_photos(source_id);
```

### Migration 3: Alter `affiliate_products` table

Remove columns moved to `affiliate_product_details`:
```sql
ALTER TABLE affiliate_products DROP COLUMN image_url;
ALTER TABLE affiliate_products DROP COLUMN description;
ALTER TABLE affiliate_products DROP COLUMN price;
```

---

## 🔌 Backend - Data Fetching

### Update `lib/mercado-livre.ts`

Expand `transformMLProductData()` to extract:
- ✅ `pictures[]` → all images with secure_url
- ✅ `price`, `sale_price`
- ✅ `category_id` + fetch category name via API
- ✅ `sold_quantity`
- ✅ `rating` (average_rating + rating_count)
- ✅ `available_quantity`
- ✅ `payment_methods` (all available methods)
- ✅ `condition` ('new' or 'used')
- ✅ Full `description` (concat multiple if needed)

Return structure:
```typescript
{
  productBase: { name, marketplace, affiliate_link },
  details: { description, price, category, condition, payment_methods, stock_quantity, sales_count, rating, rating_count },
  photos: [ { url, is_primary, source_id }, ... ]
}
```

### Update `api/affiliate/import-mercado-livre/route.ts`

1. Fetch ML product data (full extraction)
2. Insert into `affiliate_products` (name, marketplace, link, is_active)
3. Insert into `affiliate_product_details` (all detail fields)
4. Insert into `affiliate_product_photos` (all photos, sorted by position)
5. Handle duplicates gracefully (check `source_id` to avoid re-importing same photos)

---

## 🎨 Frontend Components

### 1. `components/affiliate/AffiliateProductCard.tsx` (modified)

Display:
- Primary image
- Product name (truncated)
- Price (bold, cyan)
- Rating + count (e.g., ⭐ 4.5 (2,341 reviews))
- "View Details" button

On click → opens `ProductModal`

### 2. `components/affiliate/ProductModal.tsx` (new)

Large modal with:

**Left side (60%):**
- Photo carousel (prev/next buttons)
- Thumbnails at bottom for quick jump
- Zoom on hover (optional)

**Right side (40%):**
- Product name (heading)
- Price (large, cyan)
- Rating + review count with link to ML site
- Stock status (✓ In stock / ⚠️ Low stock / ✗ Out of stock)
- Condition badge (New/Used)
- **Specs section:**
  - Category (as tag)
  - Sales count (e.g., "2,341 sold")
- **Payment methods:** Icons + names (e.g., 💳 Credit Card, 🏦 Debit, Pix)
- Description (scrollable if long)
- "Buy on Mercado Livre" button (opens affiliate link in new tab)
- Marketplace badge

Close with X or ESC key.

### 3. `components/landing/AffiliateCarousel.tsx` (new)

5-product carousel for home/landing page:
- Prev/Next buttons
- Auto-rotate (optional: 5s interval)
- Responsive (full width on mobile, constrained on desktop)
- Shows only `is_active=true` products
- Uses `AffiliateProductCard` inside

### 4. Update `app/affiliate/page.tsx`

Remove `useAuth()` → make page **public**  
Keep filters, search, grid layout  
Use updated schema

---

## 📊 API Changes

### `GET /api/affiliate/products`

**Response:**
```json
{
  "products": [
    {
      "id": "uuid",
      "admin_id": "uuid",
      "name": "Product Name",
      "marketplace": "mercado_livre",
      "affiliate_link": "url",
      "is_active": true,
      "created_at": "2026-06-25T...",
      "details": {
        "price": 99.99,
        "description": "...",
        "category": "Electronics",
        "condition": "new",
        "stock_quantity": 42,
        "sales_count": 2341,
        "rating": 4.5,
        "rating_count": 1203
      },
      "photos": [
        { "id": "uuid", "image_url": "...", "is_primary": true, "position": 0 },
        { "id": "uuid", "image_url": "...", "is_primary": false, "position": 1 }
      ],
      "payment_methods": [
        { "name": "Credit Card", "installments": 12 },
        { "name": "Debit Card" },
        { "name": "Pix" }
      ]
    }
  ]
}
```

### `POST /api/affiliate/import-mercado-livre`

Same endpoint, enhanced to handle multi-table insert with transaction.

---

## 🎯 User Journeys

**Admin: Import Product**
1. Navigate to `/dashboard/admin/affiliate-products`
2. Paste Mercado Livre link
3. System fetches all data, photos, ratings, etc.
4. Product appears in list with preview image
5. Can toggle `is_active` to show/hide from public

**User: Browse Home**
1. Land on home page
2. See "Recommended Products" carousel
3. Click left/right to browse 5 products
4. Click a product → opens modal with full gallery + details
5. Click "Buy on Mercado Livre" → affiliate link

**User: Browse All Affiliate Products**
1. Click link to `/affiliate` (no login required)
2. See grid of all products
3. Filter by marketplace, search
4. Click to open modal for any product

---

## 🔒 Security & Privacy

- ✅ Admin-only import (sysadmin role check)
- ✅ Public read access to `/affiliate` (no data leakage)
- ✅ Affiliate links preserved (ML tracking intact)
- ✅ Photos served via direct ML URLs (no proxying needed)

---

## 🚀 Implementation Order

1. **Database** — Create migrations for new tables
2. **Backend** — Update `mercado-livre.ts` to extract full data
3. **Backend** — Update import endpoint to handle multi-table insert
4. **Backend** — Update GET `/api/affiliate/products` response
5. **Frontend** — Create `ProductModal` component
6. **Frontend** — Update `AffiliateProductCard`
7. **Frontend** — Create `AffiliateCarousel` for landing
8. **Frontend** — Remove auth from `/affiliate/page.tsx`
9. **Frontend** — Integrate carousel into home/landing page
10. **Testing** — Manual test: import, view modal, carousel, public access

---

## 📝 Notes

- Backwards compatible? New columns, old data handled gracefully (null values)
- Performance? Indexed FK queries, photos lazy-loaded in carousel
- ML API rate limits? Respected (one call per import, no polling)
- Future scaling? Schema supports analytics, custom sorting, per-product stats

---

## ✅ Sign-Off

Design complete. Ready for user review and implementation plan.
