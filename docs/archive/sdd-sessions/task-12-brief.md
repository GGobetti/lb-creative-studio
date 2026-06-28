# Task 12: Integrate Carousel into Home Page

**Objective:** Add AffiliateCarousel section to the home/landing page (`src/app/page.tsx`).

## Current State

Home page has:
- Hero section
- Features section
- Maybe other sections
- Footer

## New Behavior Required

Add new section:
1. After Features (before footer)
2. Fetch affiliate products server-side
3. Pass products to AffiliateCarousel
4. Show loading fallback while fetching
5. Handle fetch errors gracefully

## Implementation

1. **Create async component** (CarouselSection):
   - Call fetchAffiliateProducts('mercado_livre')
   - Return `<AffiliateCarousel products={products} />`
   - Handle errors (return null silently)

2. **Add Suspense fallback**:
   - Show "Loading products..." spinner
   - Placeholder section

3. **Integrate into page.tsx**:
   ```jsx
   <Suspense fallback={<CarouselFallback />}>
     <CarouselSection />
   </Suspense>
   ```

4. **Position**:
   - After existing sections
   - Before footer

## Success Criteria

✅ Carousel renders on home page
✅ Products load from API
✅ Loading fallback shows
✅ Responsive design works
✅ Modal opens from carousel
✅ Graceful error handling
✅ Page performance intact

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 12)
File: `src/app/page.tsx`
