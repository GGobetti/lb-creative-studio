# Task 8: Refactor AffiliateProductCard Component

**Objective:** Update existing `src/components/affiliate/AffiliateProductCard.tsx` to work with new normalized schema (details, photos) and trigger ProductModal.

## Current State

Old component:
- Takes: product with flat structure (image_url, description, price directly on product)
- Shows: photo, name, description, price
- On click: opens external affiliate link

## New Behavior Required

Updated component must:
- Accept: product (AffiliateProduct with details and photos array)
- Show: primary photo, name, description (from details), price (from details), rating, photo count
- On click: trigger onSelect callback to open ProductModal
- Pass photo_count badge if multiple photos

## Updated Props

```typescript
interface AffiliateProductCardProps {
  product: AffiliateProduct;
  onSelect: (product: AffiliateProduct) => void;
}
```

## Display Elements

1. **Image** — Get primary photo from product.photos
2. **Photo Count Badge** — Show if multiple photos (📷 N)
3. **Marketplace Badge** — Icon (existing)
4. **Name** — line-clamp-2
5. **Description** — line-clamp-2 (from details.description)
6. **Rating** — ⭐ rating (from details.rating)
7. **Price** — Cyan text, R$ format (from details.price)
8. **Stock Status** — Conditional text (from details.stock_quantity)
9. **View Button** — Calls onSelect(product) instead of opening link

## Success Criteria

✅ Uses new AffiliateProduct type with details and photos
✅ Gets primary photo from photos array (is_primary=true)
✅ Shows photo count badge if >1 photos
✅ Displays rating from details.rating
✅ Displays price from details.price
✅ Description from details.description
✅ Stock status from details.stock_quantity
✅ onSelect callback triggers modal
✅ No breaking changes to grid usage
✅ Mobile responsive

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 8)
