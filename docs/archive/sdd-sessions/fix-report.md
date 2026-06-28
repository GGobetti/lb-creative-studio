# Affiliate Products System — Fix Report

**Status:** DONE

All 4 reviewer issues (2 CRITICAL, 2 IMPORTANT) fixed. `npx tsc --noEmit` introduces
zero new errors (15 pre-existing errors confirmed identical before and after; all in
unrelated Stripe/billing/CreditModal files).

---

## Issue #1 (CRITICAL) — Admin auth model broken — FIXED

The project's canonical admin model is `profiles.role = 'sysadmin'`, queried directly in
API routes (matching the existing pattern in `src/app/api/admin/audit-queue/route.ts`)
and exposed as `public.is_admin()` for RLS. The old `user_metadata.is_admin === true`
check matched no user.

Fixed in 3 places:

1. **`src/app/api/affiliate/products/route.ts`** (POST) — replaced the
   `user_metadata?.is_admin` check with a `profiles.select('role')` lookup, gated on
   `profile?.role !== 'sysadmin'`.

2. **`src/app/api/affiliate/products/[id]/route.ts`** (`getAdminUser`, used by PUT &
   DELETE) — same replacement: query `profiles.role`, return null unless `'sysadmin'`.

3. **`src/lib/db/migrations/20260620_affiliate_products.sql`** — `admin_read_clicks` RLS
   policy now uses `public.is_admin()` instead of the `raw_user_meta_data` EXISTS subquery.

---

## Issue #2 (CRITICAL) — `next/image` crashes public page — FIXED

`AffiliateProductCard` rendered external marketplace `image_url`s through `next/image`,
which would crash with "hostname is not configured" since `next.config.ts` has no
`images.remotePatterns`. Marketplace hosts are open-ended (AliExpress/Shopee/etc. use many
CDN subdomains), so enumerating remotePatterns is fragile.

**`src/components/affiliate/AffiliateProductCard.tsx`** — switched from `<Image fill>` to a
plain `<img>` with `absolute inset-0 w-full h-full object-cover` (reproduces the `fill`
layout), `loading="lazy"`, and the existing `onError` placeholder fallback preserved.
Removed the now-unused `next/image` import.

---

## Issue #3 (IMPORTANT) — PUT nulled unspecified fields — FIXED

The active-toggle calls `updateProduct(id, { is_active })` with only that field. The old
PUT spread all destructured fields into `.update()`, so unspecified ones became `undefined`
→ `NULL`, violating NOT NULL constraints (name, price, image_url, affiliate_link,
marketplace).

**`src/app/api/affiliate/products/[id]/route.ts`** (PUT) — now builds a partial `updates`
object, adding each column only when its key is present in the request body
(`if ('name' in data) updates.name = data.name; ...`). `updated_at` is always set.
Single-field updates no longer touch other columns.

---

## Issue #4 (IMPORTANT) — `useAuth.loading` was fake — FIXED

`loading` was `true` for one render then permanently `false` via a no-dependency
`useEffect`, regardless of real auth state. Critically, the Zustand store's `partialize`
does NOT persist `user`/`profile`, so on hard reload `user` is `null` until Supabase's
async `onAuthStateChange` fires — meaning a logged-in user briefly saw the `/affiliate`
login redirect (`if (!loading && !user) redirect`).

Fix uses real auth state:

- **`src/store/store.ts`** — added `authInitialized: boolean` (default `false`) and
  `setAuthInitialized` to the auth slice. Not persisted (consistent with `user`/`profile`),
  so it correctly resets to `false` on each load.
- **`src/components/AuthProvider.tsx`** — `onAuthStateChange` now calls
  `setAuthInitialized(true)` on its first event (initial session resolution, logged in or
  out). Added to the effect's dependency array.
- **`src/lib/hooks/useAuth.ts`** — `loading` now derives from `!authInitialized`, so it
  stays `true` until the real session resolves. Removed the fake `useState`/`useEffect`.

Verified `src/app/affiliate/page.tsx` consumes this correctly: its
`if (!loading && !user)` guard now waits for real auth init before redirecting.

---

## Test results

- **Compile (`npx tsc --noEmit`):** No new errors. Confirmed 15 pre-existing errors on the
  clean tree (via `git stash`) — identical count with changes applied. None in any edited
  file (verified by grepping tsc output for affiliate/useAuth/store/AuthProvider).
- **Manual tests:** Not run (no live admin session / dev server in this environment).
  Recommended before launch: POST `/api/affiliate/products` as a `sysadmin` user (expect
  201) and as a non-admin (expect 403); load `/affiliate` and confirm external images
  render; toggle a product's active state in the admin tab and confirm other fields persist.

## Remaining concerns (non-blocking, out of scope)

- **Cross-admin ownership:** Both API routes still gate writes on
  `existing.admin_id !== adminUser.id`, and the `admin_manage_all_products` RLS policy uses
  `auth.uid() = admin_id`. With multiple sysadmins, admin B cannot edit/delete a product
  created by admin A. If all sysadmins should manage all products, change the ownership
  check and that RLS policy to `public.is_admin()`. Left as-is since the reviewer scoped
  only `admin_read_clicks`.
- The migration file (`src/lib/db/migrations/...`) was edited but, if the table already
  exists in the deployed DB, the `admin_read_clicks` policy must be re-applied manually
  (`DROP POLICY ... ; CREATE POLICY ... USING (public.is_admin());`).
