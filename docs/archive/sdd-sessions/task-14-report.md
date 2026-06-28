# Task 14 Report: needs_validation flag

## Status
DONE — commit `6f74638` on branch `feat/display-names-validation`

## Files Modified
- `supabase/migrations/20260624_needs_validation_flag.sql` — created; adds `needs_validation boolean NOT NULL DEFAULT false` + partial index
- `src/app/api/admin/stl-action/route.ts` — added `needs_validation` and `clear_validation` cases (admin client used, same pattern as existing `remove_stl`)
- `src/components/admin/AuditTab.tsx` — added `Clock` import, `pendingValidation` state, `loadPendingValidation` callback, "Validar Mais Tarde" button in action bar, "Aguardando Validação" section above the queue
- `src/app/dashboard/stl-search/page.tsx` — added `.eq("needs_validation", false).eq("marked_for_removal", false)` to main search query, both rankings queries, and the unmerge re-fetch query

## Migration
NOT applied yet — `supabase db push` was blocked pending explicit user authorization. Run manually:
```bash
supabase db push
```

## TypeScript
`tsc --noEmit` exits clean (0 errors).

## Concerns / Notes
- The `clear_validation` action from the "Aguardando Validação" list passes an explicit `stl_id` in `body`, which correctly overrides `selectedId` via object spread in `doAction`.
- The parts sub-query inside `handleOpenItem` (line ~401) was intentionally NOT filtered — it fetches child parts of a specific parent and doesn't show standalone in public search results.
- `marked_for_removal` filter was already missing from all search queries (bug noted in brief); now fixed across all 4 search surfaces.

---

## Post-implementation fixes (branch `feat/display-names-validation`)

### Commit 1 — `3c76251` — fix: correct status value in apply_suggestion and add error checks in apply-title-suggestion

**Fix 1 (CRÍTICO) — stl-action/route.ts:**
- Changed `status: 'approved'` → `status: 'applied'` in `apply_suggestion` case (was violating CHECK constraint `('pending', 'pre_approved', 'applied', 'rejected')`)
- Added error capture (`const { error: suggestionError } = ...` + `if (suggestionError) throw suggestionError`) for the suggestion update

**Fix 4 (IMPORTANTE) — stl-action/route.ts:**
- Added pre_approved guard in `apply_suggestion` case: returns HTTP 400 with message directing to `/api/admin/apply-title-suggestion` if suggestion is in `pre_approved` status

**Fix 2 (CRÍTICO) — apply-title-suggestion/route.ts:**
- Both `await admin.from(...).update({ status: 'applied' })` and `await admin.from(...).update({ status: 'rejected' })` now capture errors with `const { error: statusError }` and throw on failure

### Commit 2 — `5094409` — fix(script): calibrate dirty-title detection and add API timeout

**Fix 3a (IMPORTANTE) — scripts/cleanup-stl-titles.ts:**
- Consonant regex changed from `/[B-DF-HJ-NP-TV-Z]{3,}/i` to `/\b[B-DF-HJ-NP-TV-Z]{3,}\b/` (removed case-insensitive flag; added word boundaries — now only flags uppercase acronyms like STL, TRX, FDM; English words like "str", "spr", "scr" are no longer false positives)

**Fix 3b (IMPORTANTE) — scripts/cleanup-stl-titles.ts:**
- `tooFewWords` threshold changed from `< 2` (filtered single-word names) to `< 1` (only flags truly empty strings); single-word proper nouns like Yoda, Dragon, Skull are now accepted

**Fix 5 (MINOR) — scripts/cleanup-stl-titles.ts:**
- Added `{ signal: AbortSignal.timeout(15_000) }` as second argument to `anthropic.messages.create(...)` to prevent API calls from hanging indefinitely

### TypeScript
`npx tsc --noEmit` exits clean (0 errors) after all fixes.
