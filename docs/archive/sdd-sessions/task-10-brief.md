# Task 10: Make /affiliate Page Public

**Objective:** Remove authentication requirement from `/app/affiliate/page.tsx` so anyone can view products without login.

## Current Behavior

Page currently:
- Uses useAuth() hook
- Redirects to /login if user is not authenticated
- Requires session to view products

## New Behavior Required

Page must:
1. Remove useAuth() dependency
2. Remove redirect logic
3. Fetch products without authentication requirement
4. Still show loading/error states
5. Display AffiliateProductGrid as before

## Changes Needed

1. Remove `useAuth()` hook and imports
2. Remove auth check and redirect
3. Keep loading/error UI
4. Simplify component to just fetch + display grid
5. Page remains fully public

## Success Criteria

✅ Page loads without login required
✅ Products display correctly
✅ Search and filter work
✅ Modal opens on card click
✅ Loading states show
✅ Error handling intact
✅ No breaking changes to grid/modal

## Reference

Exact code in plan: docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md (Task 10)
File: `src/app/affiliate/page.tsx`
