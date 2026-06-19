# XP, Badges & Gamification Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de XP separado de créditos — usuários ganham XP nos jogos, sobem de nível (desbloqueando badges + créditos automáticos), e podem resgatar XP por créditos manualmente.

**Architecture:** Ledger imutável `xp_transactions` registra todo XP ganho/resgatado. RPCs SECURITY DEFINER isolam a lógica de negócio (award_xp, redeem_xp, get_xp_summary). Frontend consome via store Zustand com slice `XpSlice`; gráficos via ECharts.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Supabase · Zustand 5 + Immer · ECharts via `echarts-for-react` · Tailwind CSS 4 · TypeScript 5

## Global Constraints

- Todos os arquivos novos em `src/` devem ter `'use client'` se usarem hooks ou browser APIs
- Padrão de autenticação em API routes: `Authorization: Bearer <token>` header + `getSupabaseUserClient(token)`
- RPCs de escrita são SECURITY DEFINER e chamadas apenas server-side (API routes)
- `get_xp_summary()` usa `auth.uid()` internamente — pode ser chamado browser-side via `getSupabaseBrowser().rpc('get_xp_summary')`
- Nível é calculado sobre `xp_earned_total` (XP bruto acumulado); resgatar XP nunca rebaixa nível
- Sem hardcode de valores de XP, nomes de níveis ou taxas — tudo lido do banco
- Branch de trabalho: `sprint-8-xp-badges`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260620_xp_gamification.sql` | Criar | Tabelas, seed, alter, RPCs |
| `src/types/xp.ts` | Criar | Tipos TypeScript compartilhados |
| `src/store/store.ts` | Modificar | Adicionar XpSlice |
| `src/app/api/games/xp-summary/route.ts` | Criar | GET xp-summary via RPC |
| `src/app/api/games/award-xp/route.ts` | Criar | POST award_xp RPC |
| `src/app/api/games/redeem-xp/route.ts` | Criar | POST redeem_xp RPC |
| `src/app/api/games/photo-match-answer/route.ts` | Modificar | Chamar award_xp após resposta correta |
| `src/app/api/games/tag-detective-vote/route.ts` | Modificar | Chamar award_xp após voto |
| `src/app/api/games/category-vote/route.ts` | Modificar | Chamar award_xp após voto |
| `src/app/api/games/audit-vote/route.ts` | Modificar | Chamar award_xp após voto |
| `src/components/Navbar.tsx` | Modificar | Adicionar pill de XP |
| `src/app/dashboard/profile/page.tsx` | Modificar | Adicionar tab XP & Badges |
| `src/components/profile/XpTab.tsx` | Criar | Container da aba XP |
| `src/components/profile/XpHeroCard.tsx` | Criar | Badge atual + barra de progresso + streak |
| `src/components/profile/XpLevelTrail.tsx` | Criar | Timeline horizontal dos 6 níveis |
| `src/components/profile/XpChart.tsx` | Criar | Gráfico ECharts acumulado/atividade |
| `src/components/profile/XpRedeemCard.tsx` | Criar | Resgate de XP por créditos |
| `src/components/profile/XpBadgesGrid.tsx` | Criar | Grid de badges desbloqueadas |
| `src/components/admin/XpConfigPanel.tsx` | Criar | Editor de XP config + níveis + por-jogo |
| `src/app/dashboard/admin/page.tsx` | Modificar | Adicionar tab "xp" + import XpConfigPanel |
| `package.json` | Modificar | Adicionar echarts + echarts-for-react |

---

## Task 1: Instalar ECharts + Migration SQL (tabelas + RPCs)

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/20260620_xp_gamification.sql`

**Interfaces:**
- Produces: tabelas `xp_transactions`, `xp_levels`, `user_badges`, `xp_config`; coluna `game_rewards_config.xp_per_action`; RPCs `award_xp`, `redeem_xp`, `get_xp_summary`

---

- [ ] **Step 1: Instalar dependências ECharts**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npm install echarts echarts-for-react
```

Verificar que `package.json` agora lista `"echarts"` e `"echarts-for-react"` em `dependencies`.

- [ ] **Step 2: Criar migration SQL**

Criar `supabase/migrations/20260620_xp_gamification.sql` com o seguinte conteúdo:

```sql
-- ============================================================
-- XP Gamification System
-- ============================================================

-- ─── xp_config (singleton) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_config (
  id                  int PRIMARY KEY DEFAULT 1,
  xp_to_credits_rate  numeric(6,2) NOT NULL DEFAULT 2.0,
  min_redeem_xp       int          NOT NULL DEFAULT 100,
  max_redeem_per_day  int          NOT NULL DEFAULT 5000,
  updated_at          timestamptz  NOT NULL DEFAULT now()
);
INSERT INTO public.xp_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.xp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_config: authenticated read"
  ON public.xp_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "xp_config: admin write"
  ON public.xp_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── xp_levels ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_levels (
  level          int  PRIMARY KEY,
  name           text NOT NULL,
  xp_required    int  NOT NULL,
  badge_icon     text NOT NULL DEFAULT '🥉',
  badge_color    text NOT NULL DEFAULT 'zinc-400',
  credits_reward int  NOT NULL DEFAULT 0
);

ALTER TABLE public.xp_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_levels: all read"
  ON public.xp_levels FOR SELECT USING (true);
CREATE POLICY "xp_levels: admin write"
  ON public.xp_levels FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.xp_levels (level, name, xp_required, badge_icon, badge_color, credits_reward) VALUES
  (1, 'Rookie',          0,     '🥉', 'zinc-400',   0),
  (2, 'Prototipador',    500,   '🥈', 'blue-400',   100),
  (3, 'Maker',           1500,  '🥇', 'violet-500', 250),
  (4, 'Artesão Digital', 4000,  '🏆', 'amber-500',  500),
  (5, 'Mestre 3D',       10000, '💎', 'cyan-400',   1000),
  (6, 'Lenda Criativa',  25000, '👑', 'yellow-400', 2500)
ON CONFLICT (level) DO NOTHING;

-- ─── xp_transactions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type  text        NOT NULL,
  xp_amount  int         NOT NULL,
  source     text        NOT NULL CHECK (source IN ('earned', 'redeemed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_tx_user_idx  ON public.xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS xp_tx_date_idx  ON public.xp_transactions(user_id, created_at);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_transactions: own read"
  ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);
-- Writes only via SECURITY DEFINER RPCs

-- ─── user_badges ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level           int         NOT NULL REFERENCES public.xp_levels(level),
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  credits_awarded int         NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_level_idx ON public.user_badges(user_id, level);
CREATE INDEX        IF NOT EXISTS user_badges_user_idx       ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges: own read"
  ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

-- ─── game_rewards_config: add xp_per_action ──────────────────
ALTER TABLE public.game_rewards_config
  ADD COLUMN IF NOT EXISTS xp_per_action int NOT NULL DEFAULT 10;

UPDATE public.game_rewards_config SET xp_per_action = 10 WHERE game_type = 'photo-match';
UPDATE public.game_rewards_config SET xp_per_action = 8  WHERE game_type = 'tag-detective';
UPDATE public.game_rewards_config SET xp_per_action = 8  WHERE game_type = 'category-sort';
UPDATE public.game_rewards_config SET xp_per_action = 15 WHERE game_type = 'quality-audit';

-- ─── RPC: award_xp ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id   uuid,
  p_game_type text,
  p_xp_amount int
)
RETURNS TABLE (
  xp_earned      int,
  xp_total       bigint,
  level_up       boolean,
  new_level      int,
  credits_awarded int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_earned_total bigint;
  v_new_level       int := NULL;
  v_credits         int := 0;
  v_level           record;
BEGIN
  INSERT INTO public.xp_transactions (user_id, game_type, xp_amount, source)
  VALUES (p_user_id, p_game_type, p_xp_amount, 'earned');

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_earned_total
  FROM public.xp_transactions
  WHERE user_id = p_user_id AND source = 'earned';

  -- Detect first unlocked level above threshold (only one level-up per action)
  SELECT l.level, l.credits_reward INTO v_level
  FROM public.xp_levels l
  WHERE l.xp_required > 0
    AND l.xp_required <= v_xp_earned_total
    AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = p_user_id AND ub.level = l.level
    )
  ORDER BY l.level ASC
  LIMIT 1;

  IF v_level IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, level, credits_awarded)
    VALUES (p_user_id, v_level.level, v_level.credits_reward)
    ON CONFLICT (user_id, level) DO NOTHING;

    IF v_level.credits_reward > 0 THEN
      UPDATE public.profiles
        SET credits = credits + v_level.credits_reward, updated_at = now()
        WHERE id = p_user_id;
      INSERT INTO public.transactions (user_id, credits_added, description)
        VALUES (p_user_id, v_level.credits_reward, 'Level up: nível ' || v_level.level);
    END IF;

    v_new_level := v_level.level;
    v_credits   := v_level.credits_reward;
  END IF;

  RETURN QUERY
  SELECT
    p_xp_amount,
    COALESCE(SUM(t.xp_amount), 0),
    v_new_level IS NOT NULL,
    v_new_level,
    v_credits
  FROM public.xp_transactions t
  WHERE t.user_id = p_user_id;
END;
$$;

-- ─── RPC: redeem_xp ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_xp(
  p_user_id      uuid,
  p_xp_to_redeem int
)
RETURNS TABLE (
  credits_earned int,
  xp_redeemed    int,
  xp_remaining   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_available    bigint;
  v_redeemed_today  bigint;
  v_config          record;
  v_credits_earned  int;
BEGIN
  SELECT * INTO v_config FROM public.xp_config WHERE id = 1;

  IF p_xp_to_redeem < v_config.min_redeem_xp THEN
    RAISE EXCEPTION 'Mínimo para resgate é % XP', v_config.min_redeem_xp;
  END IF;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_available
  FROM public.xp_transactions WHERE user_id = p_user_id;

  IF v_xp_available < p_xp_to_redeem THEN
    RAISE EXCEPTION 'Saldo de XP insuficiente';
  END IF;

  SELECT COALESCE(ABS(SUM(xp_amount)), 0) INTO v_redeemed_today
  FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND source = 'redeemed'
    AND created_at >= date_trunc('day', now());

  IF v_redeemed_today + p_xp_to_redeem > v_config.max_redeem_per_day THEN
    RAISE EXCEPTION 'Limite diário de resgate atingido';
  END IF;

  v_credits_earned := floor(p_xp_to_redeem::numeric / v_config.xp_to_credits_rate)::int;

  INSERT INTO public.xp_transactions (user_id, game_type, xp_amount, source)
  VALUES (p_user_id, 'redemption', -p_xp_to_redeem, 'redeemed');

  UPDATE public.profiles
    SET credits = credits + v_credits_earned, updated_at = now()
    WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, credits_added, description)
  VALUES (p_user_id, v_credits_earned, 'Resgate de XP: ' || p_xp_to_redeem || ' XP → ' || v_credits_earned || ' créditos');

  RETURN QUERY
  SELECT
    v_credits_earned,
    p_xp_to_redeem,
    COALESCE(SUM(t.xp_amount), 0)
  FROM public.xp_transactions t
  WHERE t.user_id = p_user_id;
END;
$$;

-- ─── RPC: get_xp_summary ────────────────────────────────────
-- Usa auth.uid() internamente — seguro para chamar do browser
CREATE OR REPLACE FUNCTION public.get_xp_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_xp_total        bigint := 0;
  v_xp_earned_total bigint := 0;
  v_current_level   record;
  v_next_level      record;
  v_badges          json;
  v_current_streak  int := 0;
  v_best_streak     int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_total
  FROM public.xp_transactions WHERE user_id = v_uid;

  SELECT COALESCE(SUM(xp_amount), 0) INTO v_xp_earned_total
  FROM public.xp_transactions WHERE user_id = v_uid AND source = 'earned';

  SELECT * INTO v_current_level
  FROM public.xp_levels
  WHERE xp_required <= v_xp_earned_total
  ORDER BY level DESC LIMIT 1;

  IF v_current_level IS NULL THEN
    SELECT * INTO v_current_level FROM public.xp_levels WHERE level = 1;
  END IF;

  SELECT * INTO v_next_level
  FROM public.xp_levels WHERE level = v_current_level.level + 1;

  SELECT json_agg(
    json_build_object(
      'level', ub.level, 'unlocked_at', ub.unlocked_at,
      'credits_awarded', ub.credits_awarded,
      'name', xl.name, 'badge_icon', xl.badge_icon, 'badge_color', xl.badge_color
    ) ORDER BY ub.level
  ) INTO v_badges
  FROM public.user_badges ub
  JOIN public.xp_levels xl ON xl.level = ub.level
  WHERE ub.user_id = v_uid;

  -- Current streak: consecutive ISO weeks counting backwards from now
  WITH weekly AS (
    SELECT DISTINCT date_trunc('week', created_at)::date AS ws
    FROM public.xp_transactions
    WHERE user_id = v_uid AND source = 'earned'
  ),
  numbered AS (
    SELECT ws, row_number() OVER (ORDER BY ws DESC) AS rn FROM weekly
  )
  SELECT COUNT(*)::int INTO v_current_streak
  FROM numbered
  WHERE ws = (date_trunc('week', now())::date
              - ((rn - 1) * INTERVAL '7 days')::interval)::date;

  -- Best streak: longest consecutive run
  WITH weekly AS (
    SELECT DISTINCT date_trunc('week', created_at)::date AS ws
    FROM public.xp_transactions
    WHERE user_id = v_uid AND source = 'earned'
    ORDER BY ws
  ),
  with_prev AS (
    SELECT ws, lag(ws) OVER (ORDER BY ws) AS prev_ws FROM weekly
  ),
  groups AS (
    SELECT ws,
           SUM(CASE WHEN prev_ws IS NULL OR ws - prev_ws > 7 THEN 1 ELSE 0 END)
             OVER (ORDER BY ws) AS grp
    FROM with_prev
  )
  SELECT COALESCE(MAX(cnt), 0)::int INTO v_best_streak
  FROM (SELECT grp, COUNT(*) AS cnt FROM groups GROUP BY grp) sub;

  RETURN json_build_object(
    'xp_total',             v_xp_total,
    'xp_earned_total',      v_xp_earned_total,
    'current_level',        row_to_json(v_current_level),
    'next_level',           row_to_json(v_next_level),
    'current_streak_weeks', COALESCE(v_current_streak, 0),
    'best_streak_weeks',    COALESCE(v_best_streak, 0),
    'badges',               COALESCE(v_badges, '[]'::json)
  );
END;
$$;
```

- [ ] **Step 3: Aplicar migration no Supabase**

Abrir Supabase Dashboard → SQL Editor → colar o conteúdo da migration → executar.

Ou via CLI se estiver usando Supabase local:
```bash
supabase db push
```

- [ ] **Step 4: Verificar migration no Supabase SQL Editor**

```sql
-- Verificar tabelas e seed
SELECT level, name, xp_required, credits_reward FROM xp_levels ORDER BY level;
-- Esperado: 6 linhas (Rookie → Lenda Criativa)

SELECT * FROM xp_config;
-- Esperado: 1 linha com rate=2.0, min=100, max=5000

SELECT game_type, xp_per_action FROM game_rewards_config ORDER BY game_type;
-- Esperado: quality-audit=15, photo-match=10, tag-detective=8, category-sort=8

-- Verificar RPCs
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('award_xp', 'redeem_xp', 'get_xp_summary');
-- Esperado: 3 linhas
```

- [ ] **Step 5: Testar RPC award_xp manualmente**

No Supabase SQL Editor, substituindo `<uuid-de-um-usuario-real>`:
```sql
SELECT * FROM award_xp('<uuid-de-um-usuario-real>', 'photo-match', 10);
-- Esperado: xp_earned=10, xp_total=10, level_up=false, new_level=null, credits_awarded=0

SELECT * FROM award_xp('<uuid-de-um-usuario-real>', 'photo-match', 500);
-- Após acumular 510 XP, level_up=true, new_level=2, credits_awarded=100

SELECT * FROM xp_transactions WHERE user_id = '<uuid>';
-- Esperado: linhas com source='earned'
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
git add supabase/migrations/20260620_xp_gamification.sql package.json package-lock.json
git commit -m "feat(xp): migration tabelas + RPCs + instalar echarts"
```

---

## Task 2: TypeScript types + XP Store Slice

**Files:**
- Create: `src/types/xp.ts`
- Modify: `src/store/store.ts`

**Interfaces:**
- Produces: `XpSummary`, `XpLevel`, `UserBadge`, `AwardXpResult`, `RedeemXpResult`, `XpConfig`, `GameRewardsConfig` (usados em todos os tasks seguintes)
- Produces: `useConfiguratorStore().xpSummary`, `useConfiguratorStore().refreshXpSummary()`

---

- [ ] **Step 1: Criar `src/types/xp.ts`**

```typescript
// src/types/xp.ts

export interface XpLevel {
  level: number
  name: string
  xp_required: number
  badge_icon: string
  badge_color: string
  credits_reward: number
}

export interface UserBadge {
  level: number
  unlocked_at: string
  credits_awarded: number
  name: string
  badge_icon: string
  badge_color: string
}

export interface XpSummary {
  xp_total: number
  xp_earned_total: number
  current_level: XpLevel
  next_level: XpLevel | null
  current_streak_weeks: number
  best_streak_weeks: number
  badges: UserBadge[]
}

export interface AwardXpResult {
  xp_earned: number
  xp_total: number
  level_up: boolean
  new_level: number | null
  credits_awarded: number
}

export interface RedeemXpResult {
  credits_earned: number
  xp_redeemed: number
  xp_remaining: number
}

export interface XpConfig {
  id: number
  xp_to_credits_rate: number
  min_redeem_xp: number
  max_redeem_per_day: number
}

export interface GameRewardsConfig {
  game_type: string
  actions_per_reward: number
  credits_per_reward: number
  xp_per_action: number
}
```

- [ ] **Step 2: Adicionar XpSlice ao `src/store/store.ts`**

Após os imports existentes, adicionar:
```typescript
import type { XpSummary } from '@/types/xp'
import { getSupabaseBrowser } from '@/lib/supabase'
```

Adicionar interface ao final das interfaces de slice (antes do `type ConfiguratorStore`):
```typescript
// ─── XP Slice ────────────────────────────────────────────────

interface XpSlice {
  xpSummary: XpSummary | null
  setXpSummary: (summary: XpSummary | null) => void
  refreshXpSummary: () => Promise<void>
}
```

Adicionar `XpSlice` ao type union de `ConfiguratorStore` — localizar a linha com `type ConfiguratorStore = AuthSlice & CatalogSlice & ...` e adicionar `& XpSlice`.

Adicionar implementação no objeto de estado (após o bloco `logout`):
```typescript
// ── XP ───────────────────────────────────────────────────────
xpSummary: null,
setXpSummary: (summary) =>
  set((s) => {
    s.xpSummary = summary
  }),
refreshXpSummary: async () => {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase.rpc('get_xp_summary')
  if (!error && data) {
    set((s) => {
      s.xpSummary = data as XpSummary
    })
  }
},
```

- [ ] **Step 3: Verificar que TypeScript compila sem erros**

```bash
cd "/Users/ggobetti/Projetos Pessoais/lb-creative-studio"
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros relacionados a XpSlice.

- [ ] **Step 4: Commit**

```bash
git add src/types/xp.ts src/store/store.ts
git commit -m "feat(xp): tipos TypeScript + XpSlice no store Zustand"
```

---

## Task 3: Novas API Routes (xp-summary, award-xp, redeem-xp)

**Files:**
- Create: `src/app/api/games/xp-summary/route.ts`
- Create: `src/app/api/games/award-xp/route.ts`
- Create: `src/app/api/games/redeem-xp/route.ts`

**Interfaces:**
- Consumes: `getSupabaseUserClient(token)` de `@/lib/supabase`
- Produces: endpoints usados pelas game routes (Task 4) e pelo frontend

---

- [ ] **Step 1: Criar `src/app/api/games/xp-summary/route.ts`**

```typescript
import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase.rpc('get_xp_summary')
    if (error) {
      console.error('[XP-SUMMARY] RPC error:', error)
      return NextResponse.json({ error: 'Erro ao buscar resumo de XP' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[XP-SUMMARY] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Criar `src/app/api/games/award-xp/route.ts`**

```typescript
import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { game_type } = await request.json()
    if (!game_type) return NextResponse.json({ error: 'game_type obrigatório' }, { status: 400 })

    const VALID_GAME_TYPES = ['photo-match', 'tag-detective', 'category-sort', 'quality-audit']
    if (!VALID_GAME_TYPES.includes(game_type)) {
      return NextResponse.json({ error: 'game_type inválido' }, { status: 400 })
    }

    // Ler xp_per_action da config
    const { data: config } = await supabase
      .from('game_rewards_config')
      .select('xp_per_action')
      .eq('game_type', game_type)
      .single() as any

    const xp_amount = config?.xp_per_action ?? 10

    const { data, error } = await supabase
      .rpc('award_xp', { p_user_id: user.id, p_game_type: game_type, p_xp_amount: xp_amount })
      .single() as any

    if (error) {
      console.error('[AWARD-XP] RPC error:', error)
      return NextResponse.json({ error: 'Erro ao registrar XP', debug: error }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('[AWARD-XP] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Criar `src/app/api/games/redeem-xp/route.ts`**

```typescript
import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { xp_to_redeem } = await request.json()
    if (!xp_to_redeem || typeof xp_to_redeem !== 'number' || xp_to_redeem <= 0) {
      return NextResponse.json({ error: 'xp_to_redeem deve ser um número positivo' }, { status: 400 })
    }

    const { data, error } = await supabase
      .rpc('redeem_xp', { p_user_id: user.id, p_xp_to_redeem: xp_to_redeem })
      .single() as any

    if (error) {
      // O RPC lança RAISE EXCEPTION com mensagens amigáveis
      const message = error.message?.includes('insuficiente')
        ? 'Saldo de XP insuficiente'
        : error.message?.includes('Mínimo')
        ? error.message
        : error.message?.includes('diário')
        ? 'Limite diário de resgate atingido'
        : 'Erro ao processar resgate'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('[REDEEM-XP] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Testar as rotas com curl**

```bash
# Primeiro obter um token válido (copiar do DevTools → Application → localStorage → supabase.auth.token → access_token)
TOKEN="<access_token>"

# GET xp-summary
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/games/xp-summary | jq .
# Esperado: JSON com xp_total, current_level.name, badges array

# POST award-xp
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_type":"photo-match"}' \
  http://localhost:3000/api/games/award-xp | jq .
# Esperado: {success:true, xp_earned:10, xp_total:..., level_up:false}

# POST redeem-xp (precisa ter XP suficiente)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"xp_to_redeem":100}' \
  http://localhost:3000/api/games/redeem-xp | jq .
# Esperado: {success:true, credits_earned:50, xp_redeemed:100}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/games/xp-summary src/app/api/games/award-xp src/app/api/games/redeem-xp
git commit -m "feat(xp): API routes xp-summary, award-xp, redeem-xp"
```

---

## Task 4: Integrar award_xp nas rotas de jogos existentes

**Files:**
- Modify: `src/app/api/games/photo-match-answer/route.ts`
- Modify: `src/app/api/games/tag-detective-vote/route.ts`
- Modify: `src/app/api/games/category-vote/route.ts`
- Modify: `src/app/api/games/audit-vote/route.ts`

**Interfaces:**
- Consumes: `getSupabaseUserClient(token)` já presente em cada rota
- Produces: cada resposta passa a incluir `xp_earned`, `level_up`, `new_level`, `credits_awarded`

**Padrão a seguir em todas as 4 rotas:** após o `record_game_action` existente ter sucesso, adicionar a chamada ao RPC `award_xp`. O XP é sempre concedido quando há `can_continue = true` (a mesma condição para créditos). Falha no `award_xp` não deve bloquear a resposta — logar e continuar.

---

- [ ] **Step 1: Modificar `photo-match-answer/route.ts`**

Após a linha `creditsEarned = actionResult?.credits_earned || 0` (somente dentro do bloco `if (is_correct)`), adicionar antes do insert de `photo_match_answers`:

```typescript
// Award XP
let xpResult: any = null
const { data: xpData, error: xpError } = await supabase
  .rpc('award_xp', {
    p_user_id: user.id,
    p_game_type: 'photo-match',
    p_xp_amount: 10,
  })
  .single() as any
if (xpError) {
  console.error('[PHOTO-MATCH] XP error (non-fatal):', xpError)
} else {
  xpResult = xpData
}
```

Na resposta final, adicionar `xp_earned`, `level_up`, `new_level`, `credits_awarded` ao JSON retornado:
```typescript
return NextResponse.json({
  success: true,
  credits_earned: creditsEarned,
  is_correct,
  xp_earned: xpResult?.xp_earned ?? 0,
  level_up: xpResult?.level_up ?? false,
  new_level: xpResult?.new_level ?? null,
  xp_credits_awarded: xpResult?.credits_awarded ?? 0,
})
```

- [ ] **Step 2: Modificar `tag-detective-vote/route.ts`**

Após `const creditsEarned = actionResult?.credits_earned || 0` e antes do insert em `tag_detective_votes`, adicionar:

```typescript
// Award XP
const { data: xpData, error: xpError } = await supabase
  .rpc('award_xp', {
    p_user_id: user.id,
    p_game_type: 'tag-detective',
    p_xp_amount: 8,
  })
  .single() as any
if (xpError) console.error('[TAG-DETECTIVE] XP error (non-fatal):', xpError)
```

Na resposta:
```typescript
return NextResponse.json({
  success: true,
  credits_earned: creditsEarned,
  xp_earned: xpData?.xp_earned ?? 0,
  level_up: xpData?.level_up ?? false,
  new_level: xpData?.new_level ?? null,
})
```

- [ ] **Step 3: Modificar `category-vote/route.ts`**

Após `const creditsEarned = actionResult?.credits_earned || 0` e antes do insert em `category_votes`:

```typescript
// Award XP
const { data: xpData, error: xpError } = await supabase
  .rpc('award_xp', {
    p_user_id: user.id,
    p_game_type: 'category-sort',
    p_xp_amount: 8,
  })
  .single() as any
if (xpError) console.error('[CATEGORY-VOTE] XP error (non-fatal):', xpError)
```

Na resposta:
```typescript
return NextResponse.json({
  success: true,
  credits_earned: creditsEarned,
  xp_earned: xpData?.xp_earned ?? 0,
  level_up: xpData?.level_up ?? false,
  new_level: xpData?.new_level ?? null,
})
```

- [ ] **Step 4: Modificar `audit-vote/route.ts`**

Após `const creditsEarned = actionResult?.credits_earned || 0` e a verificação `if (!canContinue)`, adicionar antes do insert em `quality_audit_votes`:

```typescript
// Award XP
const { data: xpData, error: xpError } = await supabase
  .rpc('award_xp', {
    p_user_id: user.id,
    p_game_type: game_type,
    p_xp_amount: 15,
  })
  .single() as any
if (xpError) console.error('[AUDIT-VOTE] XP error (non-fatal):', xpError)
```

Na resposta final adicionar `xp_earned`, `level_up`, `new_level` ao JSON.

- [ ] **Step 5: Verificar no Supabase que XP aparece após jogar**

```sql
-- Após uma sessão de jogo, verificar:
SELECT xp_amount, game_type, source, created_at
FROM xp_transactions
ORDER BY created_at DESC LIMIT 10;
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/games/photo-match-answer/route.ts \
        src/app/api/games/tag-detective-vote/route.ts \
        src/app/api/games/category-vote/route.ts \
        src/app/api/games/audit-vote/route.ts
git commit -m "feat(xp): integrar award_xp nas rotas de jogos existentes"
```

---

## Task 5: Navbar — Pill de XP

**Files:**
- Modify: `src/components/Navbar.tsx`

**Interfaces:**
- Consumes: `useConfiguratorStore().xpSummary` (XpSummary | null), `useConfiguratorStore().refreshXpSummary`

---

- [ ] **Step 1: Adicionar import e hook ao `Navbar.tsx`**

Adicionar import:
```typescript
import { Star } from 'lucide-react'
```

Adicionar ao corpo do componente `Navbar`, logo após a desestruturação do store existente:
```typescript
const { profile, logout, xpSummary, refreshXpSummary } = useConfiguratorStore()
```

Adicionar `useEffect` para carregar o resumo de XP quando o perfil carregar:
```typescript
import { useEffect } from 'react'
// ...
useEffect(() => {
  if (profile) refreshXpSummary()
}, [profile?.id])
```

- [ ] **Step 2: Adicionar pill de XP no JSX**

Logo após o pill de créditos existente (o `<div>` com `Zap`), adicionar:
```tsx
{profile && xpSummary && (
  <Link
    href="/dashboard/profile?tab=xp"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
               bg-amber-500/10 border border-amber-500/20
               hover:bg-amber-500/20 transition-colors"
  >
    <span className="text-sm">{xpSummary.current_level.badge_icon}</span>
    <span className="text-sm font-semibold text-amber-500">
      {xpSummary.xp_total.toLocaleString('pt-BR')} XP
    </span>
    <span className="text-xs text-amber-500/60 hidden sm:inline">
      · {xpSummary.current_level.name}
    </span>
  </Link>
)}
```

- [ ] **Step 3: Verificar no browser**

Rodar `npm run dev`, fazer login e confirmar que o pill de XP aparece ao lado dos créditos na navbar. Em mobile (< 640px), o nome do nível deve ser oculto.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(xp): pill de XP na navbar"
```

---

## Task 6: Profile — Tab Shell + XpHeroCard + XpLevelTrail

**Files:**
- Modify: `src/app/dashboard/profile/page.tsx`
- Create: `src/components/profile/XpTab.tsx`
- Create: `src/components/profile/XpHeroCard.tsx`
- Create: `src/components/profile/XpLevelTrail.tsx`

**Interfaces:**
- Consumes: `XpSummary` de `@/types/xp`, `useConfiguratorStore().xpSummary`
- Produces: aba "XP & Badges" navegável via `?tab=xp`

---

- [ ] **Step 1: Adicionar tab switcher em `profile/page.tsx`**

Adicionar import e leitura de searchParams:
```typescript
import { useSearchParams, useRouter } from 'next/navigation'
// ...
const searchParams = useSearchParams()
const router = useRouter()
const activeTab = (searchParams.get('tab') || 'profile') as 'profile' | 'xp'
```

Adicionar o tab switcher no JSX, antes do conteúdo principal da página:
```tsx
{/* Tab switcher */}
<div className="flex gap-1 p-1 rounded-xl bg-muted border border-border mb-6">
  {(['profile', 'xp'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => router.push(`/dashboard/profile?tab=${tab}`)}
      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {tab === 'profile' ? 'Perfil' : '⭐ XP & Badges'}
    </button>
  ))}
</div>

{activeTab === 'profile' && (
  <> {/* todo o conteúdo existente da página envolto aqui */} </>
)}
{activeTab === 'xp' && <XpTab />}
```

Adicionar import:
```typescript
import { XpTab } from '@/components/profile/XpTab'
```

- [ ] **Step 2: Criar `src/components/profile/XpTab.tsx`**

```typescript
'use client'

import { useConfiguratorStore } from '@/store/store'
import { XpHeroCard } from './XpHeroCard'
import { XpLevelTrail } from './XpLevelTrail'
import { XpChart } from './XpChart'
import { XpRedeemCard } from './XpRedeemCard'
import { XpBadgesGrid } from './XpBadgesGrid'
import { Loader2 } from 'lucide-react'

export function XpTab() {
  const { xpSummary } = useConfiguratorStore()

  if (!xpSummary) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" />
        Carregando XP...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <XpHeroCard summary={xpSummary} />
      <XpLevelTrail summary={xpSummary} />
      <XpChart />
      <XpRedeemCard summary={xpSummary} />
      <XpBadgesGrid summary={xpSummary} />
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/components/profile/XpHeroCard.tsx`**

```typescript
'use client'

import type { XpSummary } from '@/types/xp'
import { Flame } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpHeroCard({ summary }: Props) {
  const { current_level, next_level, xp_earned_total, current_streak_weeks, best_streak_weeks } = summary

  const progressPct = next_level
    ? Math.min(
        100,
        Math.round(
          ((xp_earned_total - current_level.xp_required) /
            (next_level.xp_required - current_level.xp_required)) *
            100
        )
      )
    : 100

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="text-5xl">{current_level.badge_icon}</div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-foreground">{current_level.name}</h2>
          <p className="text-sm text-muted-foreground">
            {xp_earned_total.toLocaleString('pt-BR')} XP acumulados
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <Flame size={20} className="text-orange-500" />
          <span className="text-2xl font-black text-orange-500">{current_streak_weeks}</span>
          <span className="text-xs text-muted-foreground">
            {current_streak_weeks === 1 ? 'semana' : 'semanas'}
          </span>
          {best_streak_weeks > 0 && (
            <span className="text-xs text-muted-foreground/50">
              recorde: {best_streak_weeks}
            </span>
          )}
        </div>
      </div>

      {next_level && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{current_level.name}</span>
            <span>{next_level.name} — {next_level.xp_required.toLocaleString('pt-BR')} XP</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {progressPct}% — faltam{' '}
            {(next_level.xp_required - xp_earned_total).toLocaleString('pt-BR')} XP
            {next_level.credits_reward > 0 && (
              <> · desbloqueia {next_level.credits_reward} créditos</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Criar `src/components/profile/XpLevelTrail.tsx`**

```typescript
'use client'

import type { XpSummary } from '@/types/xp'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import type { XpLevel } from '@/types/xp'
import { Lock } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpLevelTrail({ summary }: Props) {
  const [allLevels, setAllLevels] = useState<XpLevel[]>([])

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_levels')
      .select('*')
      .order('level')
      .then(({ data }) => { if (data) setAllLevels(data) })
  }, [])

  const unlockedLevels = new Set(summary.badges.map((b) => b.level))

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
        Trilha de Níveis
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {allLevels.map((level, idx) => {
          const unlocked = unlockedLevels.has(level.level)
          const isCurrent = level.level === summary.current_level.level
          const badge = summary.badges.find((b) => b.level === level.level)

          return (
            <div key={level.level} className="flex flex-col items-center gap-2 min-w-[80px]">
              {/* Connector line */}
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 ${unlocked ? 'bg-amber-500/60' : 'bg-muted'}`} />
                )}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all
                    ${isCurrent ? 'border-amber-500 shadow-lg shadow-amber-500/30 scale-110' : ''}
                    ${unlocked && !isCurrent ? 'border-border bg-card' : ''}
                    ${!unlocked ? 'border-muted bg-muted/30 grayscale opacity-50' : ''}
                  `}
                >
                  {unlocked ? level.badge_icon : <Lock size={16} className="text-muted-foreground" />}
                </div>
                {idx < allLevels.length - 1 && (
                  <div className={`flex-1 h-0.5 ${unlocked ? 'bg-amber-500/60' : 'bg-muted'}`} />
                )}
              </div>
              <span className={`text-xs font-medium text-center ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                {level.name}
              </span>
              {badge ? (
                <span className="text-xs text-muted-foreground/60">
                  {new Date(badge.unlocked_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/40">
                  {level.xp_required > 0 ? `${level.xp_required.toLocaleString('pt-BR')} XP` : '—'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verificar no browser**

Acessar `/dashboard/profile?tab=xp`. Confirmar:
- Tab switcher funciona entre "Perfil" e "⭐ XP & Badges"
- Hero card exibe nível, barra de progresso e streak
- Level trail mostra os 6 níveis com estado correto (desbloqueados coloridos, bloqueados acinzentados)

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/profile/page.tsx \
        src/components/profile/XpTab.tsx \
        src/components/profile/XpHeroCard.tsx \
        src/components/profile/XpLevelTrail.tsx
git commit -m "feat(xp): profile tab + hero card + level trail"
```

---

## Task 7: XpChart (ECharts — gráfico de timeline)

**Files:**
- Create: `src/components/profile/XpChart.tsx`

**Interfaces:**
- Consumes: `getSupabaseBrowser()` para buscar `xp_transactions` do usuário
- Produces: componente com toggle Acumulado/Atividade e filtro de período

---

- [ ] **Step 1: Criar `src/components/profile/XpChart.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useConfiguratorStore } from '@/store/store'
import dynamic from 'next/dynamic'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

type Period = '4w' | '3m' | 'all'
type View = 'cumulative' | 'activity'

const GAME_COLORS: Record<string, string> = {
  'photo-match':   '#8b5cf6',
  'tag-detective': '#06b6d4',
  'category-sort': '#f59e0b',
  'quality-audit': '#10b981',
}

const GAME_LABELS: Record<string, string> = {
  'photo-match':   'PhotoMatch',
  'tag-detective': 'TagDetective',
  'category-sort': 'CategorySort',
  'quality-audit': 'QualityAudit',
}

interface XpTx {
  xp_amount: number
  game_type: string
  source: string
  created_at: string
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function XpChart() {
  const { profile } = useConfiguratorStore()
  const [txs, setTxs] = useState<XpTx[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('cumulative')
  const [period, setPeriod] = useState<Period>('3m')

  useEffect(() => {
    if (!profile?.id) return
    const supabase = getSupabaseBrowser()
    supabase
      .from('xp_transactions')
      .select('xp_amount, game_type, source, created_at')
      .eq('user_id', profile.id)
      .eq('source', 'earned')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTxs(data || [])
        setLoading(false)
      })
  }, [profile?.id])

  const filtered = (() => {
    const now = Date.now()
    if (period === '4w') return txs.filter((t) => now - new Date(t.created_at).getTime() <= 28 * 86400000)
    if (period === '3m') return txs.filter((t) => now - new Date(t.created_at).getTime() <= 90 * 86400000)
    return txs
  })()

  const cumulativeOption = (() => {
    let total = 0
    const points = filtered.map((t) => {
      total += t.xp_amount
      return [t.created_at, total]
    })
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: (p: any) => `${new Date(p[0].axisValue).toLocaleDateString('pt-BR')} — ${p[0].value[1].toLocaleString('pt-BR')} XP` },
      xAxis: { type: 'time', axisLabel: { color: '#6b7280', fontSize: 11 }, axisLine: { lineStyle: { color: '#374151' } } },
      yAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11, formatter: (v: number) => v.toLocaleString('pt-BR') }, splitLine: { lineStyle: { color: '#1f2937' } } },
      grid: { left: 55, right: 20, top: 20, bottom: 40 },
      series: [{
        type: 'line',
        data: points,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#f59e0b' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(245,158,11,0.3)' }, { offset: 1, color: 'rgba(245,158,11,0)' }] } },
      }],
    }
  })()

  const activityOption = (() => {
    const weekMap: Record<string, Record<string, number>> = {}
    for (const t of filtered) {
      const w = isoWeek(new Date(t.created_at))
      weekMap[w] = weekMap[w] || {}
      weekMap[w][t.game_type] = (weekMap[w][t.game_type] || 0) + t.xp_amount
    }
    const weeks = Object.keys(weekMap).sort()
    const gameTypes = ['photo-match', 'tag-detective', 'category-sort', 'quality-audit']
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: gameTypes.map((g) => GAME_LABELS[g]), textStyle: { color: '#9ca3af', fontSize: 11 }, bottom: 0 },
      xAxis: { type: 'category', data: weeks, axisLabel: { color: '#6b7280', fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: '#374151' } } },
      yAxis: { type: 'value', axisLabel: { color: '#6b7280', fontSize: 11 }, splitLine: { lineStyle: { color: '#1f2937' } } },
      grid: { left: 50, right: 20, top: 20, bottom: 60 },
      series: gameTypes.map((g) => ({
        name: GAME_LABELS[g],
        type: 'bar',
        stack: 'total',
        data: weeks.map((w) => weekMap[w]?.[g] || 0),
        itemStyle: { color: GAME_COLORS[g] },
      })),
    }
  })()

  if (loading) return (
    <div className="rounded-2xl border border-border bg-card p-6 h-64 flex items-center justify-center text-muted-foreground text-sm">
      Carregando gráfico...
    </div>
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Histórico de XP
        </h3>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted text-xs">
            {(['cumulative', 'activity'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md transition-colors ${view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {v === 'cumulative' ? 'Acumulado' : 'Atividade'}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted text-xs">
            {(['4w', '3m', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2 py-1 rounded-md transition-colors ${period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {p === '4w' ? '4 sem' : p === '3m' ? '3 meses' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ReactECharts
        option={view === 'cumulative' ? cumulativeOption : activityOption}
        style={{ height: 260 }}
        theme="dark"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar no browser**

Acessar `/dashboard/profile?tab=xp`. Confirmar:
- Gráfico renderiza sem erros de SSR
- Toggle Acumulado/Atividade troca o tipo de visualização
- Filtro de período funciona
- Barras têm cores distintas por jogo no modo Atividade

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/XpChart.tsx
git commit -m "feat(xp): gráfico ECharts acumulado/atividade com filtro de período"
```

---

## Task 8: XpRedeemCard + XpBadgesGrid

**Files:**
- Create: `src/components/profile/XpRedeemCard.tsx`
- Create: `src/components/profile/XpBadgesGrid.tsx`

**Interfaces:**
- Consumes: `XpSummary`, `useConfiguratorStore().refreshXpSummary()`, `useConfiguratorStore().refreshCredits()`
- Produces: UI de resgate e grid de badges

---

- [ ] **Step 1: Criar `src/components/profile/XpRedeemCard.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { XpSummary, XpConfig } from '@/types/xp'
import { useConfiguratorStore } from '@/store/store'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useEffect } from 'react'
import { Loader2, ArrowRightLeft } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpRedeemCard({ summary }: Props) {
  const { refreshXpSummary, refreshCredits } = useConfiguratorStore()
  const [config, setConfig] = useState<XpConfig | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_config')
      .select('*')
      .single()
      .then(({ data }) => { if (data) setConfig(data as XpConfig) })
  }, [])

  const xpNum = parseInt(amount) || 0
  const creditsPreview = config ? Math.floor(xpNum / config.xp_to_credits_rate) : 0
  const canRedeem = config && xpNum >= config.min_redeem_xp && xpNum <= summary.xp_total

  const handleRedeem = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Sessão expirada'); setLoading(false); return }

      const res = await fetch('/api/games/redeem-xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ xp_to_redeem: xpNum }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); setShowConfirm(false); return }

      setSuccess(`+${data.credits_earned} créditos adicionados!`)
      setAmount('')
      setShowConfirm(false)
      await refreshXpSummary()
      // Refresh credits in store
      const { data: profileData } = await supabase.from('profiles').select('credits').single()
      if (profileData) refreshCredits(profileData.credits)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Resgatar XP por Créditos
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">XP disponível</span>
          <span className="font-bold text-foreground">{summary.xp_total.toLocaleString('pt-BR')} XP</span>
        </div>
        {config && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa</span>
            <span className="text-muted-foreground">
              {config.xp_to_credits_rate} XP = 1 crédito
              <span className="ml-2 text-muted-foreground/50">(mín. {config.min_redeem_xp} XP)</span>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); setSuccess(null) }}
            placeholder={`Quantidade de XP (mín. ${config?.min_redeem_xp ?? 100})`}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => { setShowConfirm(true); setError(null) }}
            disabled={!canRedeem}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold
                       disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
          >
            <ArrowRightLeft size={15} />
            Resgatar
          </button>
        </div>
        {xpNum > 0 && config && (
          <p className="text-xs text-muted-foreground">
            {xpNum.toLocaleString('pt-BR')} XP → <span className="font-semibold text-amber-500">{creditsPreview} créditos</span>
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <h4 className="text-lg font-bold text-foreground">Confirmar resgate</h4>
            <p className="text-sm text-muted-foreground">
              Trocar <span className="font-semibold text-foreground">{xpNum.toLocaleString('pt-BR')} XP</span> por{' '}
              <span className="font-semibold text-amber-500">{creditsPreview} créditos</span>?
              <br />Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleRedeem}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/profile/XpBadgesGrid.tsx`**

```typescript
'use client'

import type { XpSummary, XpLevel } from '@/types/xp'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'

interface Props { summary: XpSummary }

export function XpBadgesGrid({ summary }: Props) {
  const [allLevels, setAllLevels] = useState<XpLevel[]>([])

  useEffect(() => {
    getSupabaseBrowser()
      .from('xp_levels')
      .select('*')
      .order('level')
      .then(({ data }) => { if (data) setAllLevels(data) })
  }, [])

  const unlockedMap = Object.fromEntries(summary.badges.map((b) => [b.level, b]))

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Badges
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {allLevels.map((level) => {
          const badge = unlockedMap[level.level]
          const unlocked = !!badge

          return (
            <div
              key={level.level}
              className={`rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all
                ${unlocked
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border bg-muted/20 opacity-50 grayscale'
                }`}
            >
              <div className="text-3xl">{unlocked ? level.badge_icon : <Lock size={24} className="text-muted-foreground" />}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{level.name}</p>
                {unlocked ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {new Date(badge.unlocked_at).toLocaleDateString('pt-BR')}
                    </p>
                    {badge.credits_awarded > 0 && (
                      <p className="text-xs text-amber-500">+{badge.credits_awarded} créditos</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {level.xp_required > 0 ? `${level.xp_required.toLocaleString('pt-BR')} XP` : '—'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar no browser**

- Redeem card exibe saldo disponível e taxa correta da `xp_config`
- Input de quantidade ativa o preview em créditos
- Modal de confirmação abre ao clicar "Resgatar"
- Após confirmar: XP diminui, créditos aumentam, navbar atualiza
- Badges grid mostra todos os níveis, desbloqueados coloridos e bloqueados em cinza

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/XpRedeemCard.tsx src/components/profile/XpBadgesGrid.tsx
git commit -m "feat(xp): redeem card + badges grid no perfil"
```

---

## Task 9: Admin — XP Config Panel

**Files:**
- Create: `src/components/admin/XpConfigPanel.tsx`
- Modify: `src/app/dashboard/admin/page.tsx`

**Interfaces:**
- Consumes: `getSupabaseBrowser()`, tabelas `xp_config`, `xp_levels`, `game_rewards_config`
- Produces: interface editável para admins configurarem XP sem tocar no banco

---

- [ ] **Step 1: Criar `src/components/admin/XpConfigPanel.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { XpConfig, XpLevel, GameRewardsConfig } from '@/types/xp'
import { Save, Loader2, Check } from 'lucide-react'

export function XpConfigPanel() {
  const [config, setConfig] = useState<XpConfig | null>(null)
  const [levels, setLevels] = useState<XpLevel[]>([])
  const [gameConfigs, setGameConfigs] = useState<GameRewardsConfig[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    Promise.all([
      supabase.from('xp_config').select('*').single(),
      supabase.from('xp_levels').select('*').order('level'),
      supabase.from('game_rewards_config').select('game_type, actions_per_reward, credits_per_reward, xp_per_action').order('game_type'),
    ]).then(([c, l, g]) => {
      if (c.data) setConfig(c.data as XpConfig)
      if (l.data) setLevels(l.data as XpLevel[])
      if (g.data) setGameConfigs(g.data as GameRewardsConfig[])
    })
  }, [])

  const saveConfig = async () => {
    if (!config) return
    setSaving('config')
    await getSupabaseBrowser().from('xp_config').update({
      xp_to_credits_rate: config.xp_to_credits_rate,
      min_redeem_xp: config.min_redeem_xp,
      max_redeem_per_day: config.max_redeem_per_day,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(null)
    setSaved('config')
    setTimeout(() => setSaved(null), 2000)
  }

  const saveLevel = async (level: XpLevel) => {
    setSaving(`level-${level.level}`)
    await getSupabaseBrowser().from('xp_levels').update({
      name: level.name,
      xp_required: level.xp_required,
      badge_icon: level.badge_icon,
      badge_color: level.badge_color,
      credits_reward: level.credits_reward,
    }).eq('level', level.level)
    setSaving(null)
    setSaved(`level-${level.level}`)
    setTimeout(() => setSaved(null), 2000)
  }

  const saveGameConfig = async (gc: GameRewardsConfig) => {
    setSaving(`game-${gc.game_type}`)
    await getSupabaseBrowser().from('game_rewards_config').update({
      xp_per_action: gc.xp_per_action,
    }).eq('game_type', gc.game_type)
    setSaving(null)
    setSaved(`game-${gc.game_type}`)
    setTimeout(() => setSaved(null), 2000)
  }

  const updateLevel = (index: number, field: keyof XpLevel, value: string | number) => {
    setLevels((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  const updateGame = (index: number, value: number) => {
    setGameConfigs((prev) => prev.map((g, i) => i === index ? { ...g, xp_per_action: value } : g))
  }

  if (!config) return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={18} />Carregando...</div>

  return (
    <div className="flex flex-col gap-6">
      {/* Global config */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">Configuração Global de XP</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Taxa XP → Créditos', field: 'xp_to_credits_rate' as const, hint: 'XP ÷ taxa = créditos' },
            { label: 'Mínimo por resgate (XP)', field: 'min_redeem_xp' as const, hint: 'Ex: 100' },
            { label: 'Limite diário de resgate (XP)', field: 'max_redeem_per_day' as const, hint: 'Ex: 5000' },
          ].map(({ label, field, hint }) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              <input
                type="number"
                value={config[field] as number}
                onChange={(e) => setConfig((c) => c ? { ...c, [field]: parseFloat(e.target.value) } : c)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground/50 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
        <button
          onClick={saveConfig}
          disabled={saving === 'config'}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {saving === 'config' ? <Loader2 size={14} className="animate-spin" /> : saved === 'config' ? <Check size={14} /> : <Save size={14} />}
          {saved === 'config' ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* XP per game */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">XP por Ação (por jogo)</h3>
        <div className="flex flex-col gap-3">
          {gameConfigs.map((gc, i) => (
            <div key={gc.game_type} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-40 shrink-0 capitalize">
                {gc.game_type.replace('-', ' ')}
              </span>
              <input
                type="number"
                value={gc.xp_per_action}
                onChange={(e) => updateGame(i, parseInt(e.target.value))}
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground">XP / ação</span>
              <button
                onClick={() => saveGameConfig(gc)}
                disabled={saving === `game-${gc.game_type}`}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-medium hover:bg-muted/80 disabled:opacity-60"
              >
                {saving === `game-${gc.game_type}` ? <Loader2 size={12} className="animate-spin" /> : saved === `game-${gc.game_type}` ? <Check size={12} /> : <Save size={12} />}
                {saved === `game-${gc.game_type}` ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Levels */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground mb-4">Níveis e Badges</h3>
        <div className="flex flex-col gap-3">
          {levels.map((level, i) => (
            <div key={level.level} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-lg">{level.badge_icon}</span>
                <input
                  value={level.name}
                  onChange={(e) => updateLevel(i, 'name', e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Nome"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">XP necessário</label>
                <input type="number" value={level.xp_required}
                  onChange={(e) => updateLevel(i, 'xp_required', parseInt(e.target.value))}
                  disabled={level.level === 1}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Ícone (emoji)</label>
                <input value={level.badge_icon}
                  onChange={(e) => updateLevel(i, 'badge_icon', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">Créditos reward</label>
                <input type="number" value={level.credits_reward}
                  onChange={(e) => updateLevel(i, 'credits_reward', parseInt(e.target.value))}
                  disabled={level.level === 1}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <button
                onClick={() => saveLevel(level)}
                disabled={saving === `level-${level.level}`}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
              >
                {saving === `level-${level.level}` ? <Loader2 size={12} className="animate-spin" /> : saved === `level-${level.level}` ? <Check size={12} /> : <Save size={12} />}
                {saved === `level-${level.level}` ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar tab "xp" ao `src/app/dashboard/admin/page.tsx`**

Localizar o tipo do `activeTab`:
```typescript
const [activeTab, setActiveTab] = useState<"features" | "models" | "users" | "scraper" | "analytics" | "tickets" | "flags" | "acervo">("features")
```
Adicionar `"xp"` ao union type:
```typescript
const [activeTab, setActiveTab] = useState<"features" | "models" | "users" | "scraper" | "analytics" | "tickets" | "flags" | "acervo" | "xp">("features")
```

Adicionar import no topo do arquivo:
```typescript
import { XpConfigPanel } from '@/components/admin/XpConfigPanel'
```

Localizar o array/JSX de tabs e adicionar o item de XP. O padrão do projeto usa botões de tab — adicionar junto aos outros:
```tsx
<button
  onClick={() => setActiveTab('xp')}
  className={`... ${activeTab === 'xp' ? 'ativo' : ''}`}
>
  XP & Badges
</button>
```

No bloco de conteúdo condicional, adicionar:
```tsx
{activeTab === 'xp' && <XpConfigPanel />}
```

- [ ] **Step 3: Verificar no browser**

Acessar `/dashboard/admin` com conta sysadmin e clicar na tab "XP & Badges". Confirmar:
- Taxa, mínimo e limite diário são editáveis e salvam
- XP por jogo é editável por linha
- Níveis exibem nome, XP necessário, ícone e créditos reward editáveis

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/XpConfigPanel.tsx src/app/dashboard/admin/page.tsx
git commit -m "feat(xp): painel admin configurável — XP config, níveis e por-jogo"
```

---

## Checklist de Self-Review

- [x] **Spec coverage:**
  - `xp_transactions`, `xp_levels`, `user_badges`, `xp_config` → Task 1
  - `award_xp`, `redeem_xp`, `get_xp_summary` RPCs → Task 1
  - `game_rewards_config.xp_per_action` → Task 1
  - TypeScript types → Task 2
  - Store `xpSummary` + `refreshXpSummary` → Task 2
  - API routes xp-summary, award-xp, redeem-xp → Task 3
  - Integração nos 4 jogos → Task 4
  - Navbar pill → Task 5
  - Hero card, level trail → Task 6
  - Timeline chart (ECharts, toggle acumulado/atividade, filtro período) → Task 7
  - Redeem card (com modal de confirmação e taxa lida do banco) → Task 8
  - Badges grid → Task 8
  - Admin XP config (taxa, mínimo, limite, XP/jogo, níveis) → Task 9

- [x] **Streak semanal:** calculado no RPC `get_xp_summary` e exibido no `XpHeroCard`
- [x] **Nível baseado em `xp_earned_total`** (não em `xp_total`) — resgatar XP não rebaixa nível
- [x] **Sem hardcode:** todos os valores lidos de `xp_levels`, `xp_config`, `game_rewards_config`
- [x] **ECharts:** carregado via `dynamic(() => import(...), { ssr: false })` — sem erros de SSR
- [x] **Nomes de tipos consistentes:** `XpSummary`, `XpLevel`, `UserBadge`, `XpConfig`, `GameRewardsConfig` — usados identicamente em todos os tasks
