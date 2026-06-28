# XP Gamification — Fix Report

## Fix 1 — CRITICAL: p_user_id spoofing (security)

**File:** `supabase/migrations/20260620_xp_security_fix.sql`

Added `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;` at the top of both `award_xp` and `redeem_xp` SECURITY DEFINER functions. Any call where the supplied `p_user_id` does not match the authenticated session's `auth.uid()` will raise an exception and abort the function, preventing XP minting for other users.

## Fix 2 — IMPORTANT: xp_per_action from DB config

**Files modified:**
- `src/app/api/games/photo-match-answer/route.ts` — replaced `p_xp_amount: 10` with DB lookup
- `src/app/api/games/tag-detective-vote/route.ts` — replaced `p_xp_amount: 8` with DB lookup
- `src/app/api/games/category-vote/route.ts` — replaced `p_xp_amount: 8` with DB lookup
- `src/app/api/games/audit-vote/route.ts` — replaced `p_xp_amount: 15` with DB lookup

Each route now queries `game_rewards_config.xp_per_action` for the relevant `game_type` before calling `award_xp`. Falls back to the previous hardcoded value if config row is missing.

## Fix 3 — IMPORTANT: Level-up credits refresh in navbar

**Files modified:**
- `src/components/games/PhotoMatch.tsx`
- `src/components/games/TagDetective.tsx`
- `src/components/games/CategorySort.tsx`
- `src/components/games/QualityAudit.tsx`

All four game components now check the API response for `level_up: true`. When detected:
1. `refreshXpSummary()` is called to update the XP pill in the navbar
2. A fresh profile fetch from Supabase re-reads the actual `credits` balance
3. `refreshCredits(credits)` is called to update the credits pill in the navbar

The credit refresh is wrapped in try/catch and is non-fatal in all cases. For fire-and-forget patterns (PhotoMatch, TagDetective, CategorySort), the `.catch(console.error)` was extended to `.then(async (res) => { ... }).catch(console.error)`. For QualityAudit (which already awaits), the check was added inline after the fetch response.

## TypeScript

`npx tsc --noEmit` passes with zero errors.

---

# Leaderboard Final Review — Fix Report

Date: 2026-06-20

## Files Modified

### supabase/migrations/20260620_leaderboard_rankings_fn.sql

**[C1] SQL SECURITY DEFINER sem SET search_path**
- Adicionado `SET search_path = public;` na declaração final da função após `SECURITY DEFINER`, eliminando o risco de search_path injection.

**[I4] COALESCE em full_name**
- Trocado `p.full_name as name` por `COALESCE(p.full_name, 'Maker') as name` na CTE `user_xp`, evitando nome `null` no leaderboard quando o perfil não tem `full_name` preenchido.

---

### src/components/games/LeaderboardCard.tsx

**[I1] Importação de tipos locais substituída por shared**
- Removidas as definições locais de `LeaderboardUser` e `LeaderboardResponse`.
- Adicionado `import type { LeaderboardUser, LeaderboardResponse } from '@/types/leaderboard'`.

**[I2] Strings hardcoded em PT substituídas por i18n**
- Adicionado `import { useTranslation } from '@/lib/translations'`.
- Adicionado `const { t } = useTranslation()` dentro do componente.
- `"Ranking Semanal"` → `{t('leaderboard.title')}`.
- `"Ver ranking completo"` → `{t('leaderboard.viewFullRanking')}`.
- Strings sem chave i18n (`"Erro ao carregar ranking"`, `"Nenhum jogador essa semana"`) mantidas em PT conforme instrução.

---

### src/components/games/LeaderboardTable.tsx

**[I3] Empty state com " (essa semana)" hardcoded**
- Adicionada chave `noGamesWeek` em todas as 3 línguas no `translations.ts` (pt/en/es).
- Substituído `{t('leaderboard.noGamesYet')}{period === 'week' ? ' (essa semana)' : ''}` por `{period === 'week' ? t('leaderboard.noGamesWeek') : t('leaderboard.noGamesYet')}`.

---

### src/lib/translations.ts

- Adicionada chave `noGamesWeek` nas seções `pt`, `en` e `es` do objeto `leaderboard`:
  - pt: `"Nenhum maker jogou essa semana"`
  - en: `"No makers played this week"`
  - es: `"Ningún maker jugó esta semana"`

---

## TypeScript

- `npx tsc --noEmit`: zero erros nos arquivos de leaderboard. Erros pré-existentes em `api/cancel-subscription`, `api/subscription-change`, `dashboard/billing` e `CreditModal.tsx` (todos Stripe-related, fora do escopo desta fix).
