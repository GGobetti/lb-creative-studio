# Bulk STL Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admins to categorize multiple STLs at once in PhotoCurator using a unified floating menu with category checkboxes, displaying assigned categories as badges on each STL.

**Architecture:** 
- Extend PhotoCurator component to track selected categories separately from the merge UI
- Add a new "Categorizar" tab to the bulk-actions menu 
- Fetch existing categories from `category_votes` table on mount
- Add category badges rendering under each STL title
- Create new API endpoint handler for bulk category assignment
- Categories accumulate (don't replace) via `UPDATE ... array_append()` in Supabase

**Tech Stack:** React/Next.js, Supabase (PostgreSQL), Lucide icons, TailwindCSS

## Global Constraints

- Reuse existing `STL_CATEGORIES` constant from `src/types/games.ts`
- Use same auth pattern as photo-curator API (Bearer token via `getToken()`)
- Follow existing component style (dark mode compatible, responsive)
- Category selection happens only when confirmed, no optimistic updates until API succeeds
- Target: commit-by-commit, 8-10 small PRs or 1 bundled PR (user preference in execution phase)

---

## File Structure

**Modified:**
- `src/components/dashboard/PhotoCurator.tsx` — add category selection state, render badges, extend bulk-actions menu
- `src/app/api/admin/photo-curator/route.ts` — add `bulk_categorize_stls` action handler

**New:**
- `src/components/dashboard/PhotoCuratorCategoryTab.tsx` — extracted category selection UI (reusable)

**Tests:**
- `src/components/dashboard/__tests__/PhotoCurator.categorization.test.tsx` — category badge rendering, selection, bulk apply

---

## Task 1: Load Existing Categories on PhotoCurator Mount

**Files:**
- Modify: `src/components/dashboard/PhotoCurator.tsx:1-260`
- Test: Write test case (inline, not separate file yet)

**Interfaces:**
- Consumes: `getSupabaseBrowser()`, `rows` state
- Produces: `categoryCache` state (Record<stlId, Set<string>>)

**Steps:**

- [ ] **Step 1:** Add new state to track loaded categories at the top of PhotoCurator function, after `const [reviewed, setReviewed] = useState<Set<string>>(new Set())`

```typescript
// Categorias já atribuídas a cada STL: stl_id -> Set de categorias
const [categoryCache, setCategoryCache] = useState<Record<string, Set<string>>>({})
const [loadingCategories, setLoadingCategories] = useState(false)
```

- [ ] **Step 2:** Create a new function `fetchCategoryVotes` (inside PhotoCurator) to load existing categories from `category_votes` table

```typescript
const fetchCategoryVotes = useCallback(async () => {
  if (rows.length === 0) return
  setLoadingCategories(true)
  try {
    const supabase = getSupabaseBrowser()
    const stlIds = rows.map((r) => r.id)
    
    // Fetch em chunks de 100 pra não estourar limite
    const CHUNK = 100
    const allVotes: any[] = []
    for (let i = 0; i < stlIds.length; i += CHUNK) {
      const chunk = stlIds.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from("category_votes")
        .select("stl_id, categories")
        .in("stl_id", chunk)
      if (error) throw error
      allVotes.push(...(data || []))
    }
    
    // Monta cache: stl_id -> Set<categories>
    const cache: Record<string, Set<string>> = {}
    for (const vote of allVotes) {
      cache[vote.stl_id] = new Set(vote.categories || [])
    }
    setCategoryCache(cache)
  } catch (err) {
    console.error("Erro ao carregar categorias:", err)
  } finally {
    setLoadingCategories(false)
  }
}, [rows.length])
```

- [ ] **Step 3:** Add useEffect to call `fetchCategoryVotes` after `fetchRows` and `fetchBucket` complete

```typescript
useEffect(() => { fetchRows(); fetchBucket() }, [fetchRows, fetchBucket])

// Novo useEffect:
useEffect(() => {
  if (rows.length > 0) {
    fetchCategoryVotes()
  }
}, [rows.length, fetchCategoryVotes])
```

- [ ] **Step 4:** Verify by checking browser console — should log no errors after PhotoCurator loads

---

## Task 2: Render Category Badges Under Each STL Title

**Files:**
- Modify: `src/components/dashboard/PhotoCurator.tsx:1058-1075`

**Interfaces:**
- Consumes: `categoryCache` state from Task 1
- Produces: JSX badges element (visual only, no interaction)

**Steps:**

- [ ] **Step 1:** Find the section where STL title is rendered (around line 1058: `<p className="text-sm font-medium break-words">`)

- [ ] **Step 2:** Add badge rendering after the title paragraph, before the metadata text:

```typescript
<div className="mt-1.5 flex flex-wrap gap-1">
  {Array.from(categoryCache[row.id] || []).map((cat) => (
    <span
      key={cat}
      className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-medium"
    >
      {cat}
    </span>
  ))}
</div>
```

- [ ] **Step 3:** Test visually — reload PhotoCurator, should see category badges under STLs that have them (if any exist)

---

## Task 3: Create Separate CategoryTab Component

**Files:**
- Create: `src/components/dashboard/PhotoCuratorCategoryTab.tsx`

**Interfaces:**
- Consumes: 
  - `selectedCategories: Set<string>` 
  - `toggleCategory: (cat: string) => void`
  - `handleRemoveSuggestion: (cat: string) => void`
  - `suggestion: string`
  - `setSuggestion: (val: string) => void`
  - `setShowSuggestionInput: (val: boolean) => void`
- Produces: React component that renders category selection UI

**Steps:**

- [ ] **Step 1:** Create the new file with this skeleton:

```typescript
"use client"

import React from "react"
import { Plus, X } from "lucide-react"
import { STL_CATEGORIES } from "@/types/games"
import { cn } from "@/lib/utils"

interface PhotoCuratorCategoryTabProps {
  selectedCategories: Set<string>
  toggleCategory: (cat: string) => void
  handleRemoveSuggestion: (cat: string) => void
  suggestion: string
  setSuggestion: (val: string) => void
  setShowSuggestionInput: (val: boolean) => void
}

export function PhotoCuratorCategoryTab({
  selectedCategories,
  toggleCategory,
  handleRemoveSuggestion,
  suggestion,
  setSuggestion,
  setShowSuggestionInput,
}: PhotoCuratorCategoryTabProps) {
  return (
    <div className="space-y-3 max-h-[40vh] overflow-y-auto">
      <p className="text-xs text-muted-foreground">
        Selecione uma ou mais categorias para aplicar em massa aos selecionados:
      </p>

      {/* Grid de categorias padrão */}
      <div className="grid grid-cols-2 gap-2">
        {STL_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition",
              selectedCategories.has(cat)
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted/50"
            )}
          >
            <input
              type="checkbox"
              checked={selectedCategories.has(cat)}
              onChange={() => toggleCategory(cat)}
              className="accent-primary"
            />
            <span>{cat}</span>
          </label>
        ))}
      </div>

      {/* Sugestões customizadas */}
      {selectedCategories.size > 0 && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedCategories)
              .filter((c) => !STL_CATEGORIES.includes(c))
              .map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs"
                >
                  {cat}
                  <button
                    onClick={() => handleRemoveSuggestion(cat)}
                    className="opacity-60 hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>

          {!setShowSuggestionInput ? (
            <button
              onClick={() => setShowSuggestionInput(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-muted"
            >
              <Plus className="w-3 h-3" /> Sugerir categoria customizada
            </button>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Ex: Sonic, Mario..."
                className="flex-1 px-2 py-1 rounded text-xs border border-border bg-background"
                autoFocus
              />
              <button
                onClick={() => {
                  if (suggestion.trim()) {
                    toggleCategory(suggestion.trim())
                    setSuggestion("")
                    setShowSuggestionInput(false)
                  }
                }}
                className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setSuggestion("")
                  setShowSuggestionInput(false)
                }}
                className="px-2 py-1 rounded text-xs border border-border hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Test that it compiles by importing it (don't render yet, just check no TS errors)

---

## Task 4: Extend Bulk-Actions Menu with Category Tab

**Files:**
- Modify: `src/components/dashboard/PhotoCurator.tsx:104-902`

**Interfaces:**
- Consumes: `selected` state, `categoryCache`, `PhotoCuratorCategoryTab` component
- Produces: Updated floating menu with tabs

**Steps:**

- [ ] **Step 1:** Add new state variables for category tab at top of PhotoCurator (after existing state):

```typescript
const [bulkAction, setBulkAction] = useState<"none" | "validate" | "categorize" | "merge">("none")
const [bulkSelectedCategories, setBulkSelectedCategories] = useState<Set<string>>(new Set())
const [bulkSuggestion, setBulkSuggestion] = useState("")
const [showBulkSuggestionInput, setShowBulkSuggestionInput] = useState(false)
const [bulkCategorizing, setBulkCategorizing] = useState(false)
```

- [ ] **Step 2:** Add helper function to toggle categories in bulk mode:

```typescript
const toggleBulkCategory = useCallback((cat: string) => {
  setBulkSelectedCategories((prev) => {
    const next = new Set(prev)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    return next
  })
}, [])

const handleBulkRemoveSuggestion = useCallback((cat: string) => {
  setBulkSelectedCategories((prev) => {
    const next = new Set(prev)
    next.delete(cat)
    return next
  })
}, [])
```

- [ ] **Step 3:** Import the new component at the top of PhotoCurator:

```typescript
import { PhotoCuratorCategoryTab } from "./PhotoCuratorCategoryTab"
```

- [ ] **Step 4:** Replace the existing bulk-actions menu (the sticky div around line 824) with a tabbed version. Find this section:

```typescript
{selected.size > 0 && (
  <div className="sticky top-0 z-30 mb-4 rounded-xl border border-primary/40 bg-background/95 backdrop-blur shadow-lg p-3">
```

And replace the entire section (lines 823-905) with a tabbed UI that shows/hides content based on `bulkAction` state.

- [ ] **Step 5:** Verify tabs appear and switch between them in browser (no API calls yet)

---

## Task 5: Implement `bulkApplyCategories` Function

**Files:**
- Modify: `src/components/dashboard/PhotoCurator.tsx:282-430`

**Interfaces:**
- Consumes: `selected`, `bulkSelectedCategories`, `callApi`, `categoryCache`
- Produces: API call to bulk_categorize endpoint

**Steps:**

- [ ] **Step 1:** Add the function before the toggle filters section:

```typescript
const bulkApplyCategories = useCallback(async () => {
  if (bulkSelectedCategories.size === 0 || selected.size === 0) return
  setBulkCategorizing(true)

  const stlIds = [...selected]
  const categories = [...bulkSelectedCategories]
  const standardCategories = categories.filter((c) => STL_CATEGORIES.includes(c))
  const suggestedCategories = categories.filter((c) => !STL_CATEGORIES.includes(c))

  // Otimista: atualiza categoryCache localmente
  const optimisticCache = { ...categoryCache }
  for (const stlId of stlIds) {
    const currentCats = optimisticCache[stlId] || new Set<string>()
    optimisticCache[stlId] = new Set([...currentCats, ...categories])
  }
  setCategoryCache(optimisticCache)

  try {
    await callApi({
      action: "bulk_categorize_stls",
      stl_ids: stlIds,
      categories: standardCategories,
      suggested_categories: suggestedCategories,
    })
    // Sucesso - mantém cache otimista
    setBulkAction("none")
    setBulkSelectedCategories(new Set())
    alert(`✅ Categorias aplicadas a ${stlIds.length} arquivo(s)`)
  } catch (e: any) {
    console.error("Falha ao aplicar categorias:", e)
    // Rollback
    setCategoryCache(categoryCache)
    alert(`Erro ao aplicar categorias: ${e.message}`)
  } finally {
    setBulkCategorizing(false)
  }
}, [bulkSelectedCategories, selected, categoryCache, callApi])
```

- [ ] **Step 2:** Add import for `STL_CATEGORIES` at the top of PhotoCurator

- [ ] **Step 3:** Test by selecting STLs, going to Categorizar tab, picking categories, and clicking "Aplicar em Massa" — should show error (endpoint doesn't exist yet) but no crashes

---

## Task 6: Create Backend Endpoint Handler

**Files:**
- Modify: `src/app/api/admin/photo-curator/route.ts`

**Interfaces:**
- Consumes: Request with `bulk_categorize_stls` action, `stl_ids`, `categories`, `suggested_categories`
- Produces: Updates to `category_votes` table

**Steps:**

- [ ] **Step 1:** Read the existing photo-curator API file

- [ ] **Step 2:** Find the main handler function and locate where actions are dispatched

- [ ] **Step 3:** Add the `bulk_categorize_stls` action handler before the final `return` statement

- [ ] **Step 4:** Verify TS types compile

---

## Task 7: Write Tests for Category Badge Rendering

**Files:**
- Create: `src/components/dashboard/__tests__/PhotoCurator.categorization.test.tsx`

**Interfaces:**
- Consumes: PhotoCurator component, mock Supabase responses
- Produces: Test suite covering category display and bulk apply

**Steps:**

- [ ] Create test file with basic structure and at least one test case

---

## Task 8: End-to-End Manual Test

**Files:**
- Test: Browser + PhotoCurator page

**Steps:**

- [ ] Start dev server
- [ ] Navigate to `/dashboard/photo-curator`
- [ ] Select 2+ STLs, categorize, verify badges appear
- [ ] Test accumulation by applying different categories

---

## Task 9: Commit and Documentation

**Files:**
- Commit: all changes from Tasks 1-8

**Steps:**

- [ ] Stage, commit, and push all changes
