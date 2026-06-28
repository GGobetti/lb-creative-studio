# Task 9: Update AffiliateProductGrid Component

**Objective:** Update `src/components/affiliate/AffiliateProductGrid.tsx` to manage modal state and integrate ProductModal with refactored AffiliateProductCard.

## Current Behavior

Grid currently:
- Displays products in grid layout
- Has search + marketplace filter
- Cards are static (no click handler integration)

## New Behavior Required

Grid must:
1. Manage modal state (selectedProduct + isOpen)
2. Pass onSelect callback to each card
3. Render ProductModal when modal is open
4. Handle marketplace filter with new product structure (details)
5. Update search to include details fields

## Component Updates

1. **State Management:**
   - `selectedProduct: AffiliateProduct | null`
   - Modal opens/closes via card click

2. **Props to Pass to Cards:**
   - product (AffiliateProduct)
   - onSelect (callback to set selectedProduct)

3. **Modal Integration:**
   - Render `<ProductModal product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} />`

4. **Search Logic:**
   - Search in name (existing)
   - Also search in details.description

5. **Filter Logic:**
   - Keep marketplace filter (matches marketplace field)
   - Only show active and public products (this is done server-side now)

## Success Criteria

✅ Modal state managed in grid
✅ onSelect callback passed to cards
✅ ProductModal renders with correct props
✅ Search includes description
✅ Filter by marketplace works
✅ Modal opens/closes smoothly
✅ No breaking changes to layout

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 9)
