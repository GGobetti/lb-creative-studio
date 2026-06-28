# Task 5: Update TypeScript Types and API Client

**Objective:** Update `src/lib/api/affiliate.ts` to define new types matching the expanded schema and API responses.

## Types to Create/Update

1. **ProductPhoto** interface:
   - id: string
   - image_url: string
   - is_primary: boolean
   - position: number

2. **ProductDetails** interface:
   - id: string
   - description: string | null
   - price: number
   - category: string | null
   - condition: 'new' | 'used' | null
   - payment_methods: Array<{ name: string; installments?: number }>
   - stock_quantity: number
   - sales_count: number
   - rating: number | null
   - rating_count: number

3. **AffiliateProduct** interface (update):
   - id: string
   - admin_id: string
   - name: string
   - marketplace: 'mercado_livre' | 'shopee' | 'aliexpress' | 'amazon'
   - affiliate_link: string
   - is_active: boolean
   - created_at: string
   - updated_at: string
   - details: ProductDetails | null (new)
   - photos: ProductPhoto[] (new)

## Functions to Add/Update

1. **fetchAffiliateProducts(marketplace?: string)** — Add optional marketplace filter
2. **fetchAffiliateProduct(id: string)** — New: fetch single product
3. Keep existing: createProduct, updateProduct, deleteProduct, trackClick

## Response Types

All functions should return the new AffiliateProduct with nested details and photos.

## Success Criteria

✅ All 3 new/updated interfaces created
✅ Types match API responses from Task 4
✅ No `any` types (type-safe)
✅ All existing functions still work
✅ TypeScript compiles without errors

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 5)
File: `src/lib/api/affiliate.ts`
