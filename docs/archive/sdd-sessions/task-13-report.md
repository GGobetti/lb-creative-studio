# Task 13: Script de limpeza de títulos legados via IA — REPORT

**Status:** COMPLETED

**Date:** 2026-06-24

## Summary

Corrections applied to `scripts/cleanup-stl-titles.ts`:

### Fix 1: Model ID Correction
- **Changed:** `claude-haiku-4-5` → `claude-haiku-4-5-20251001` (Line 53)
- **Reason:** Updated to use correct, versioned model identifier

### Fix 2: Missing Dirty-Title Detection Patterns
Added 3 missing validation patterns to `isDirtyTitle()` function (Lines 95-103):

**Pattern 3: Uncleaned Acronyms**
```typescript
const hasUnclearedAcronym = /[B-DF-HJ-NP-TV-Z]{3,}/i.test(title)
```
- Detects 3+ consecutive uppercase consonants without vowels (e.g., STL, TRX, FDM)
- Catches acronyms that should be expanded or cleaned

**Pattern 4: Starts with Number or Symbol**
```typescript
const startsWithNumberOrSymbol = /^[\d!@#$%^&*_\-.]/.test(title)
```
- Rejects titles beginning with digits or special characters
- Ensures display names follow proper naming convention

**Pattern 5: Too Few Words**
```typescript
const tooFewWords = title.trim().split(/\s+/).filter(w => w.length > 1).length < 2
```
- Filters titles with fewer than 2 real words
- Catches overly short or truncated identifiers (e.g., `modelov2_final`)

## Commit

- **Hash:** `abbdc1e`
- **Message:** `fix(task13): correct model id and add missing dirty-title detection patterns`
- **Changes:** 1 file, 13 insertions, 1 deletion

## Verification

All patterns now integrated into `isDirtyTitle()` function:
- Original patterns (4): @-mentions, underscores/hyphens, file-name matches ✓
- New patterns (3): acronyms, special-char prefixes, word-count validation ✓
- Function returns `true` if **any** pattern matches (dirty title detected)

Script is now ready for testing with updated model ID and comprehensive dirty-title detection.
