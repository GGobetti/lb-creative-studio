# Task 7: Create ProductModal Component

**Objective:** Create a full-featured modal displaying complete product details with photo gallery, ratings, stock status, payment methods, etc.

## Component: ProductModal

**Location:** `src/components/affiliate/ProductModal.tsx`

**Props:**
```typescript
interface ProductModalProps {
  product: AffiliateProduct;
  isOpen: boolean;
  onClose: () => void;
}
```

## Layout

**2-column grid (responsive):**
- Left (60%): PhotoCarousel component
- Right (40%): Product details

## Right Panel: Product Details

**Header:**
- Product name (h2)
- Marketplace icon badge
- Close button (X)

**Details sections:**
1. **Price** — Large cyan text, R$ format
2. **Rating** — Star icon, rating (X.X), review count
3. **Stock Status** — Icon + status text (in stock / low stock / out of stock)
4. **Condition** — New or Used badge
5. **Sales** — "X sold" text
6. **Category** — Tag with cyan background
7. **Payment Methods** — List of icons + method names + installments
8. **Description** — Scrollable text area (line-clamp-4)
9. **CTA Button** — Large button to visit product link (marketplace name in button)

## Styling & Behavior

- Modal: Fixed overlay with dark background (black/80)
- Container: glass-panel with white border
- Close on X, ESC key, or background click
- Smooth transitions
- Responsive (stack on mobile)
- Marketplace icons (🇧🇷, 🛒, 🌐, 📦)

## Success Criteria

✅ Modal opens/closes smoothly
✅ All product details displayed correctly
✅ PhotoCarousel integrates cleanly
✅ Payment methods show installments
✅ Stock status conditional icons
✅ Link opens in new tab
✅ Mobile responsive
✅ Follows project styling conventions

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 7)
