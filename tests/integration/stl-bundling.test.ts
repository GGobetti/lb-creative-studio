/**
 * Integration tests — STL Bundling
 *
 * Uses the remote Supabase project.
 * - service role key  → admin operations (insert STLs, create auth users, cleanup)
 * - createClient per authenticated user → tests RPC + RLS from the user's perspective
 *
 * Run: npm test -- tests/integration/stl-bundling.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Admin client — bypasses RLS
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a real auth user and returns { userId, supabase } where supabase is
 *  a client authenticated as that user (using the user's JWT). */
async function createTestUser(email: string): Promise<{ userId: string; supabase: SupabaseClient }> {
  // Create user via admin API
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create user ${email}: ${error?.message}`)

  const userId = data.user.id

  // Sign in to get a session token
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password: 'TestPass123!',
  })
  if (signInError) throw new Error(`Failed to sign in ${email}: ${signInError.message}`)

  return { userId, supabase: userClient }
}

/** Deletes a user and all their data (cascade). */
async function deleteUser(userId: string) {
  await admin.auth.admin.deleteUser(userId)
}

/** Inserts a parent STL + N children using the service role.
 *  Returns { parentId, childIds } */
async function createParentWithChildren(
  label: string,
  childCount: number,
): Promise<{ parentId: string; childIds: string[] }> {
  // Insert parent
  const { data: parent, error: parentErr } = await admin
    .from('telegram_indexed_stls')
    .insert({
      title: `[TEST] Parent ${label}`,
      telegram_group_id: 'test-group',
      telegram_group_name: 'Test Group',
      telegram_message_id: Math.floor(Math.random() * 1_000_000),
      file_name: `parent_${label}.stl`,
      file_size_bytes: 1024,
    })
    .select('id')
    .single()

  if (parentErr || !parent) throw new Error(`Failed to create parent STL: ${parentErr?.message}`)

  const parentId: string = parent.id
  const childIds: string[] = []

  for (let i = 0; i < childCount; i++) {
    const { data: child, error: childErr } = await admin
      .from('telegram_indexed_stls')
      .insert({
        title: `[TEST] Child ${label} #${i + 1}`,
        telegram_group_id: 'test-group',
        telegram_group_name: 'Test Group',
        telegram_message_id: Math.floor(Math.random() * 1_000_000),
        file_name: `child_${label}_${i + 1}.stl`,
        file_size_bytes: 512,
        parent_id: parentId,
      })
      .select('id')
      .single()

    if (childErr || !child) throw new Error(`Failed to create child STL: ${childErr?.message}`)
    childIds.push(child.id)
  }

  return { parentId, childIds }
}

/** Deletes all test STLs (cascades to user_acquired_stls). */
async function deleteTestStls(ids: string[]) {
  if (ids.length === 0) return
  await admin.from('telegram_indexed_stls').delete().in('id', ids)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('STL Bundling Integration', () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────
  it('should insert bundle when acquiring parent STL', async () => {
    const EMAIL = `test-bundle-${Date.now()}@lb-test.dev`
    let userId = ''
    let stlIds: string[] = []

    try {
      // 1. Admin creates parent + 2 children
      const { parentId, childIds } = await createParentWithChildren('t1', 2)
      stlIds = [parentId, ...childIds]

      // 2. Create test user
      const { userId: uid, supabase: userClient } = await createTestUser(EMAIL)
      userId = uid

      // 3. Call RPC acquire_stl_bundle with parent ID
      const { data, error } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(error, `RPC error: ${error?.message}`).toBeNull()
      expect(data?.ok).toBe(true)

      // 4. Assert: user_acquired_stls has 3 rows (parent + 2 children)
      const { data: rows, error: rowErr } = await admin
        .from('user_acquired_stls')
        .select('stl_id, source')
        .eq('user_id', userId)

      expect(rowErr).toBeNull()
      expect(rows).toHaveLength(3)

      const acquiredIds = rows!.map((r) => r.stl_id).sort()
      expect(acquiredIds).toEqual([...stlIds].sort())

      // Parent has source 'direct'; children have 'bundle_child'
      const parentRow = rows!.find((r) => r.stl_id === parentId)
      expect(parentRow?.source).toBe('direct')

      const childRows = rows!.filter((r) => r.stl_id !== parentId)
      expect(childRows.every((r) => r.source === 'bundle_child')).toBe(true)
    } finally {
      if (userId) await deleteUser(userId)
      await deleteTestStls(stlIds)
    }
  })

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it('should prevent duplicates (idempotency)', async () => {
    const EMAIL = `test-idempotent-${Date.now()}@lb-test.dev`
    let userId = ''
    let stlIds: string[] = []

    try {
      // 1. Admin creates parent + 2 children
      const { parentId, childIds } = await createParentWithChildren('t2', 2)
      stlIds = [parentId, ...childIds]

      // 2. Create test user
      const { userId: uid, supabase: userClient } = await createTestUser(EMAIL)
      userId = uid

      // 3. Acquire parent — first time
      const { error: err1 } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(err1, `First acquire error: ${err1?.message}`).toBeNull()

      // 4. Acquire parent again — second time (idempotent)
      const { error: err2 } = await userClient.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(err2, `Second acquire error: ${err2?.message}`).toBeNull()

      // 5. Assert: still only 3 rows (not 6)
      const { data: rows, error: rowErr } = await admin
        .from('user_acquired_stls')
        .select('stl_id')
        .eq('user_id', userId)

      expect(rowErr).toBeNull()
      expect(rows).toHaveLength(3)
    } finally {
      if (userId) await deleteUser(userId)
      await deleteTestStls(stlIds)
    }
  })

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it('should enforce RLS — users cannot see others portfolios', async () => {
    const EMAIL_A = `test-rls-a-${Date.now()}@lb-test.dev`
    const EMAIL_B = `test-rls-b-${Date.now()}@lb-test.dev`
    let userAId = ''
    let userBId = ''
    let stlIds: string[] = []

    try {
      // 1. Admin creates parent + 2 children
      const { parentId, childIds } = await createParentWithChildren('t3', 2)
      stlIds = [parentId, ...childIds]

      // 2. Create both users
      const { userId: uidA, supabase: clientA } = await createTestUser(EMAIL_A)
      const { userId: uidB, supabase: clientB } = await createTestUser(EMAIL_B)
      userAId = uidA
      userBId = uidB

      // 3. User A acquires parent
      const { error: acquireErr } = await clientA.rpc('acquire_stl_bundle', {
        p_stl_id: parentId,
        p_source: 'direct',
        p_credit_cost: 0,
      })
      expect(acquireErr, `User A acquire error: ${acquireErr?.message}`).toBeNull()

      // Sanity check: admin sees User A's 3 rows
      const { data: adminRows } = await admin
        .from('user_acquired_stls')
        .select('stl_id')
        .eq('user_id', userAId)
      expect(adminRows).toHaveLength(3)

      // 4. User B queries vw_user_stl_portfolio
      //    RLS must return zero rows (User B sees only their own data)
      const { data: bRows, error: bErr } = await clientB
        .from('vw_user_stl_portfolio')
        .select('stl_id')

      expect(bErr).toBeNull()
      expect(bRows).toHaveLength(0)
    } finally {
      if (userAId) await deleteUser(userAId)
      if (userBId) await deleteUser(userBId)
      await deleteTestStls(stlIds)
    }
  })
})
