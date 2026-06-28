# Task 11: Create AffiliateCarousel Component

**Objective:** Create a rotating carousel component displaying 5 affiliate products on the home/landing page.

## Component: AffiliateCarousel

**Location:** `src/components/landing/AffiliateCarousel.tsx`

**Props:**
```typescript
interface AffiliateCarouselProps {
  products: AffiliateProduct[];
}
```

## Features

1. **Product Display**
   - Show max 5 products
   - Current product prominent in center
   - Previous/next products faded/smaller on sides

2. **Navigation**
   - Left/Right arrow buttons (cyan, hover effects)
   - Dot navigation (shows current position, click to jump)
   - Auto-rotate every 5 seconds (can pause on hover)
   - Disable buttons if <2 products

3. **Product Cards**
   - Use AffiliateProductCard component
   - Current product: normal size
   - Adjacent products: smaller, faded
   - Responsive layout

4. **Modal Integration**
   - Clicking a product opens ProductModal
   - Modal state managed in carousel
   - Modal closes, carousel visible again

5. **Section**
   - Heading: "Recommended Products"
   - "View all products →" link to /affiliate page
   - Dark background section with padding

## Styling

- Use Tailwind (slate-*, cyan-*)
- Smooth transitions between products
- Responsive (mobile: single column, desktop: 3 visible)
- Dark theme matching project

## Success Criteria

✅ Shows 5 products max
✅ Current product prominent
✅ Auto-rotates every 5 seconds
✅ Arrows and dots navigate
✅ Clicking product opens modal
✅ Mobile responsive
✅ "View all" link to /affiliate
✅ Smooth transitions

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 11)
