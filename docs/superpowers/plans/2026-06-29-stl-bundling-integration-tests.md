# STL Bundling Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `tests/integration/stl-bundling.test.ts` with 3 passing integration tests that verify bundle acquisition, idempotency, and RLS enforcement against the real Supabase project.

**Architecture:** Tests use the real remote Supabase project (no Docker/local — Docker is not running). A service-role client creates test fixtures (auth users, STL rows, profiles); anon clients authenticated as specific users call `rpc('acquire_stl_bundle')` and query `vw_user_stl_portfolio`. Each test is fully isolated: setup inserts with unique IDs and teardown deletes by those IDs.

**Tech Stack:** Jest (to be installed), ts-jest, @supabase/supabase-js (already in deps), dotenv, TypeScript.

## Global Constraints

- No mocks — all assertions hit the real Supabase remote project (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`).
- Tests must be fully independent: each creates its own data and tears it down in `afterEach`.
- No secrets in committed files — env vars loaded at runtime from `.env.local`.
- Jest config must not conflict with Next.js build (`next.config.ts`) — keep it separate in `jest.config.ts`.
- TypeScript `moduleResolution: bundler` is set in the project tsconfig but Jest cannot use it; override in `tsconfig.test.json`.
- The Supabase `auth.users` table cannot be inserted into directly via SQL from the service-role JS client; use `supabase.auth.admin.createUser()` (Admin API) instead.
- Acquired STL records go into `public.user_acquired_stls`; the trigger `trg_auto_bundle` fires on INSERT and calls `insert_stl_bundle` automatically.
- The RPC `acquire_stl_bundle(p_stl_id, p_source, p_credit_cost)` requires the caller to be authenticated (uses `auth.uid()` internally). Call it via a user-scoped anon client that has a valid JWT (obtained from `auth.admin.createUser` + `auth.admin.generateLink` or a direct sign-in).
- `telegram_indexed_stls` rows need: `title`, `telegram_group_id`, `telegram_group_name`, `telegram_message_id`, `file_name`, `file_size_bytes`, `tags`. Insert via service-role client (bypasses `admin all` RLS).
- `profiles` rows are auto-created by trigger on `auth.users` insert; do not insert them manually.
- `vw_user_stl_portfolio` has RLS (`auth.uid() = user_id`) — query it via user-scoped client.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `jest.config.ts` | Create | Jest configuration: ts-jest transform, testMatch glob, dotenv setup, 30 s timeout |
| `tsconfig.test.json` | Create | TypeScript config for tests — inherits from `tsconfig.json`, overrides `moduleResolution: node`, excludes Next.js plugins |
| `tests/integration/helpers/supabase.ts` | Create | Factory functions: `makeAdminClient()`, `makeUserClient(jwt)`, `createTestUser()`, `deleteTestUser()`, `createTestStl()`, `deleteTestStl()` |
| `tests/integration/stl-bundling.test.ts` | Create | The 3 integration tests |

## Task Right-Sizing

Each task ends with a runnable check. Task 1 sets up the toolchain; Tasks 2–4 add code in TDD order.

---

### Task 1: Install Jest + ts-jest + configure TypeScript for tests

**Files:**
- Modify: `package.json` (add devDependencies + `"test"` script)
- Create: `jest.config.ts`
- Create: `tsconfig.test.json`

**Interfaces:**
- Produces: `npm test` command that discovers `tests/**/*.test.ts`

- [ ] **Step 1: Install test dependencies**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npm install --save-dev jest ts-jest @types/jest dotenv
```

Expected: packages added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Add test script to package.json**

Open `package.json` and add to `"scripts"`:

```json
"test": "jest"
```

So the scripts block becomes:

```json
"scripts": {
  "dev": "next dev --webpack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "jest"
}
```

- [ ] **Step 3: Create `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react",
    "noEmit": false,
    "plugins": []
  },
  "include": [
    "tests/**/*.ts",
    "tests/**/*.tsx"
  ]
}
```

- [ ] **Step 4: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  setupFiles: ['<rootDir>/tests/integration/helpers/loadEnv.ts'],
  testTimeout: 30000,
}

export default config
```

- [ ] **Step 5: Create env loader helper**

Create `tests/integration/helpers/loadEnv.ts`:

```typescript
import { config } from 'dotenv'
import path from 'path'

config({ path: path.resolve(process.cwd(), '.env.local') })
```

- [ ] **Step 6: Verify Jest finds no tests yet (OK)**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npm test -- --listTests
```

Expected: output shows `tests/integration/stl-bundling.test.ts` once created (currently prints no test files or the file if pre-existing).

- [ ] **Step 7: Commit**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
git add jest.config.ts tsconfig.test.json package.json package-lock.json tests/integration/helpers/loadEnv.ts
git commit -m "chore: install jest + ts-jest for integration tests"
```

---

### Task 2: Create Supabase test helpers

**Files:**
- Create: `tests/integration/helpers/supabase.ts`

**Interfaces:**
- Produces:
  - `makeAdminClient(): SupabaseClient` — service-role, bypasses RLS
  - `createTestUser(): Promise<{ userId: string; jwt: string; email: string }>` — creates auth user + returns session JWT
  - `deleteTestUser(userId: string): Promise<void>` — deletes auth user (cascades to profile + acquired_stls)
  - `createTestStl(overrides?: Partial<StlInsert>): Promise<{ id: string }>` — inserts a telegram_indexed_stls row, returns its UUID
  - `deleteTestStls(ids: string[]): Promise<void>` — deletes STL rows by IDs

- [ ] **Step 1: Create the helpers file**

Create `tests/integration/helpers/supabase.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

/** Service-role client — bypasses RLS. Use only for test setup/teardown. */
export function makeAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

/** User-scoped anon client — respects RLS, acts as the authenticated user. */
export function makeUserClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

export interface TestUser {
  userId: string
  email: string
  jwt: string
}

/**
 * Creates a real auth.users row + profile (via trigger) and returns a valid JWT.
 * The email is unique per call so tests don't collide.
 */
export async function createTestUser(): Promise<TestUser> {
  const admin = makeAdminClient()
  const email = `test-stl-${Date.now()}-${Math.random().toString(36).slice(2)}@lb-test.invalid`
  const password = 'Test1234!'

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  const userId = data.user.id

  // Sign in as this user to get a real JWT the anon client can use
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data: session, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !session.session) {
    throw new Error(`signIn failed: ${signInError?.message}`)
  }

  return { userId, email, jwt: session.session.access_token }
}

/** Deletes the auth user. Cascades to profiles and user_acquired_stls. */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = makeAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) console.warn(`deleteTestUser(${userId}) warning: ${error.message}`)
}

export interface StlInsert {
  title: string
  telegram_group_id: string
  telegram_group_name: string
  telegram_message_id: number
  file_name: string
  file_size_bytes: number
  tags: string[]
  parent_id: string | null
  parts_count: number
}

/**
 * Inserts a telegram_indexed_stls row via service-role (bypasses RLS).
 * Returns the generated UUID.
 */
export async function createTestStl(overrides: Partial<StlInsert> = {}): Promise<{ id: string }> {
  const admin = makeAdminClient()
  const defaults: StlInsert = {
    title: `Test STL ${Date.now()}`,
    telegram_group_id: 'test-group-01',
    telegram_group_name: 'Test Group',
    telegram_message_id: Math.floor(Math.random() * 1_000_000),
    file_name: `test-${Date.now()}.stl`,
    file_size_bytes: 1024,
    tags: [],
    parent_id: null,
    parts_count: 0,
    ...overrides,
  }

  const { data, error } = await admin
    .from('telegram_indexed_stls')
    .insert(defaults)
    .select('id')
    .single()

  if (error || !data) throw new Error(`createTestStl failed: ${error?.message}`)
  return { id: data.id }
}

/** Deletes STL rows by IDs. Cascades to user_acquired_stls. */
export async function deleteTestStls(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const admin = makeAdminClient()
  const { error } = await admin
    .from('telegram_indexed_stls')
    .delete()
    .in('id', ids)
  if (error) console.warn(`deleteTestStls warning: ${error.message}`)
}
```

- [ ] **Step 2: Verify the helpers file compiles**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npx tsc --project tsconfig.test.json --noEmit 2>&1 | head -30
```

Expected: no errors (or only unrelated pre-existing errors).

- [ ] **Step 3: Commit**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
git add tests/integration/helpers/supabase.ts
git commit -m "test: add Supabase test helpers for integration tests"
```

---

### Task 3: Write the 3 integration tests

**Files:**
- Create: `tests/integration/stl-bundling.test.ts`

**Interfaces:**
- Consumes:
  - `createTestUser()`, `deleteTestUser()`, `createTestStls()`, `deleteTestStls()`, `makeAdminClient()`, `makeUserClient(jwt)` from `./helpers/supabase`
  - RPC `acquire_stl_bundle(p_stl_id, p_source, p_credit_cost)` on the remote Supabase project
  - Table `user_acquired_stls`
  - View `vw_user_stl_portfolio`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/stl-bundling.test.ts`:

```typescript
import {
  createTestUser,
  deleteTestUser,
  createTestStl,
  deleteTestStls,
  makeAdminClient,
  makeUserClient,
  TestUser,
} from './helpers/supabase'

// ─── Test state ──────────────────────────────────────────────────
// Each test declares its own locals; afterEach cleans up.
// We track created resource IDs here so teardown is always correct
// even when a test fails mid-way.

describe('STL Bundling Integration', () => {
  // ─── Test 1: bundle acquisition inserts parent + children ─────
  describe('should insert bundle when acquiring parent STL', () => {
    let user: TestUser
    let parentId: string
    let child1Id: string
    let child2Id: string

    beforeEach(async () => {
      user = await createTestUser()

      // Create parent STL first
      const parent = await createTestStl({ title: 'Parent STL', parts_count: 2 })
      parentId = parent.id

      // Create 2 children that reference the parent
      const child1 = await createTestStl({
        title: 'Child STL 1',
        parent_id: parentId,
      })
      child1Id = child1.id

      const child2 = await createTestStl({
        title: 'Child STL 2',
        parent_id: parentId,
      })
      child2Id = child2.id
    })

    afterEach(async () => {
      // Delete STLs first (cascades to user_acquired_stls), then user
      await deleteTestStls([child1Id, child2Id, parentId])
      await deleteTestUser(user.userId)
    })

    it('inserts 3 rows (parent + 2 children) on first acquisition', async () => {
      const userClient = makeUserClient(user.jwt)

      // Call the RPC as the authenticated user
      const { data, error } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })

      expect(error).toBeNull()
      expect(data).toMatchObject({ ok: true })

      // Verify 3 rows in user_acquired_stls (parent + 2 children)
      const admin = makeAdminClient()
      const { data: rows, error: queryError } = await admin
        .from('user_acquired_stls')
        .select('stl_id, source')
        .eq('user_id', user.userId)

      expect(queryError).toBeNull()
      expect(rows).toHaveLength(3)

      const stlIds = rows!.map((r) => r.stl_id)
      expect(stlIds).toContain(parentId)
      expect(stlIds).toContain(child1Id)
      expect(stlIds).toContain(child2Id)

      // Parent acquired with source='direct', children with 'bundle_child'
      const parentRow = rows!.find((r) => r.stl_id === parentId)
      const childRow = rows!.find((r) => r.stl_id === child1Id)
      expect(parentRow?.source).toBe('direct')
      expect(childRow?.source).toBe('bundle_child')
    })
  })

  // ─── Test 2: idempotency — double acquire doesn't duplicate ───
  describe('should prevent duplicate acquisitions (idempotency)', () => {
    let user: TestUser
    let parentId: string
    let child1Id: string
    let child2Id: string

    beforeEach(async () => {
      user = await createTestUser()

      const parent = await createTestStl({ title: 'Idempotent Parent', parts_count: 2 })
      parentId = parent.id

      const child1 = await createTestStl({ title: 'Idempotent Child 1', parent_id: parentId })
      child1Id = child1.id

      const child2 = await createTestStl({ title: 'Idempotent Child 2', parent_id: parentId })
      child2Id = child2.id
    })

    afterEach(async () => {
      await deleteTestStls([child1Id, child2Id, parentId])
      await deleteTestUser(user.userId)
    })

    it('results in exactly 3 rows after two acquisitions of the same STL', async () => {
      const userClient = makeUserClient(user.jwt)

      // First acquisition
      const { error: err1 } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(err1).toBeNull()

      // Second acquisition — should be idempotent (ON CONFLICT DO NOTHING)
      const { data: data2, error: err2 } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(err2).toBeNull()
      // Second call should return acquired: 0 (nothing new inserted)
      expect(data2).toMatchObject({ ok: true, acquired: 0 })

      // Verify still only 3 rows total — not 6
      const admin = makeAdminClient()
      const { data: rows, error: queryError } = await admin
        .from('user_acquired_stls')
        .select('id')
        .eq('user_id', user.userId)

      expect(queryError).toBeNull()
      expect(rows).toHaveLength(3)
    })
  })

  // ─── Test 3: RLS — User B cannot see User A's portfolio ───────
  describe('should enforce RLS - users cannot see others portfolios', () => {
    let userA: TestUser
    let userB: TestUser
    let stlId: string

    beforeEach(async () => {
      ;[userA, userB] = await Promise.all([createTestUser(), createTestUser()])
      const stl = await createTestStl({ title: 'RLS Test STL' })
      stlId = stl.id
    })

    afterEach(async () => {
      await deleteTestStls([stlId])
      await Promise.all([deleteTestUser(userA.userId), deleteTestUser(userB.userId)])
    })

    it("returns empty portfolio when querying as a different user (RLS blocks)", async () => {
      // User A acquires the STL
      const clientA = makeUserClient(userA.jwt)
      const { error: acquireError } = await clientA.rpc('acquire_stl_bundle', {
        p_stl_id: stlId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(acquireError).toBeNull()

      // User A can see their own portfolio
      const { data: portfolioA, error: errA } = await clientA
        .from('vw_user_stl_portfolio')
        .select('stl_id')

      expect(errA).toBeNull()
      expect(portfolioA).toHaveLength(1)
      expect(portfolioA![0].stl_id).toBe(stlId)

      // User B queries the same view — RLS must return empty (not User A's row)
      const clientB = makeUserClient(userB.jwt)
      const { data: portfolioB, error: errB } = await clientB
        .from('vw_user_stl_portfolio')
        .select('stl_id')

      expect(errB).toBeNull()
      expect(portfolioB).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to see them fail (or verify they compile)**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npm test -- tests/integration/stl-bundling.test.ts --verbose 2>&1 | tail -40
```

Expected at this step: tests either PASS (if DB is configured correctly) or fail with a meaningful error message about DB connectivity / missing env vars — NOT TypeScript compile errors.

If you get `Missing env:` error, the `.env.local` file is not being loaded — check that `tests/integration/helpers/loadEnv.ts` is listed in `jest.config.ts` `setupFiles` and that the file path `'.env.local'` exists at the project root.

- [ ] **Step 3: Fix any issues and re-run until 3/3 pass**

Common issues and fixes:

**Issue: `vw_user_stl_portfolio` has no RLS (policy on view not supported)**

If Supabase returns an error about RLS on views, the view uses `SECURITY INVOKER` (default), so RLS from the underlying `user_acquired_stls` table applies. The `CREATE POLICY` on the view may have silently failed. Test 3 should still pass because the underlying table policy (`auth.uid() = user_id`) filters rows. No code change needed — the assertion `toHaveLength(0)` is correct.

**Issue: `parts_count` column not accepting null/0**

The `parts_count` column was added as `integer DEFAULT 0` (migration `20260615211000_add_merge_and_heartbeat.sql`). Pass `parts_count: 0` (not `null`) in `createTestStl`.

**Issue: `acquire_stl_bundle` RPC parameter names**

The SQL function signature is `acquire_stl_bundle(p_stl_id UUID, p_source TEXT, p_credit_cost INT)`. The JS client passes these as an object: `{ p_stl_id, p_source, p_credit_cost }`. Confirm names match exactly.

**Issue: Trigger `trg_auto_bundle` fires on INSERT but test inserts via service-role**

The trigger fires on `user_acquired_stls` INSERT regardless of who inserts. But `insert_stl_bundle` calls `get_stl_group` which returns children. For Test 1 to pass, the children must exist in `telegram_indexed_stls` with `parent_id = parentId` BEFORE the acquisition RPC is called. `beforeEach` creates them in this order: parent → child1 → child2, so this is correct.

**Issue: `telegram_message_id` unique constraint**

If there is a unique constraint on `(telegram_group_id, telegram_message_id)`, use `Math.floor(Math.random() * 1_000_000)` (already in the helper) to avoid collisions. If tests still fail, add `telegram_group_id: \`test-${Date.now()}\`` in each `createTestStl` call.

- [ ] **Step 4: Confirm 3/3 pass**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npm test -- tests/integration/stl-bundling.test.ts --verbose
```

Expected output:
```
PASS tests/integration/stl-bundling.test.ts
  STL Bundling Integration
    should insert bundle when acquiring parent STL
      ✓ inserts 3 rows (parent + 2 children) on first acquisition (Xms)
    should prevent duplicate acquisitions (idempotency)
      ✓ results in exactly 3 rows after two acquisitions of the same STL (Xms)
    should enforce RLS - users cannot see others portfolios
      ✓ returns empty portfolio when querying as a different user (RLS blocks) (Xms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
git add tests/integration/stl-bundling.test.ts
git commit -m "test: add integration tests for STL bundling"
```

---

## Self-Review

### 1. Spec Coverage

| Spec requirement | Covered in |
|---|---|
| Test file at `tests/integration/stl-bundling.test.ts` | Task 3 |
| Test 1: acquire parent → 3 rows in `user_acquired_stls` | Task 3, Test 1 |
| Test 2: double acquire → still 2 records (spec says "2 records", meaning unique pairs) | Task 3, Test 2 — note: spec says "2 records" but the bundle has parent + 2 children = 3. The spec means "no duplicates" — so 3 rows not 6. Test asserts `toHaveLength(3)` which is the correct behavior. |
| Test 3: RLS blocks User B from seeing User A's portfolio | Task 3, Test 3 |
| Jest + Supabase real env (no mocks) | Task 1 + Task 2 |
| Each test independent (setup/teardown) | All tests use `beforeEach`/`afterEach` |
| `npm test -- tests/integration/stl-bundling.test.ts` passes | Task 3, Step 4 |
| Commit message "test: add integration tests for STL bundling" | Task 3, Step 5 |

### 2. Placeholder Scan

No TBD, TODO, or placeholder patterns found. All code blocks are complete.

### 3. Type Consistency

- `createTestStl` returns `{ id: string }` — used as `.id` in all tests. ✓
- `createTestUser` returns `{ userId, email, jwt }` — used as `.userId` and `.jwt` in all tests. ✓
- `makeUserClient(jwt)` — called with `user.jwt` everywhere. ✓
- RPC params `{ p_stl_id, p_source, p_credit_cost }` match SQL signature exactly. ✓
- `deleteTestStls([...])` takes `string[]` — always called with array literals. ✓

### Note on spec ambiguity — "2 records" in Test 2

The spec says "Assert: table tem apenas 2 registros (não 4)" for the idempotency test but that was for a simpler case (no bundle children). In our actual schema, acquiring a parent STL with 2 children creates 3 rows (parent + child1 + child2). Doing it twice should still result in 3 rows (not 6). The test asserts `toHaveLength(3)` which is the correct idempotency assertion. The intent of "not 4" in the spec is "no duplicates", which maps to "not 6" in our case.
