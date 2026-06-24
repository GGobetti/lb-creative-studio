# Security Hardening + Display Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Corrigir todas as vulnerabilidades de segurança confirmadas no lb-creative-studio. (2) Implementar o fluxo de Display Names: sugestões de título via gamification → fila de pré-aprovação → admin aplica. (3) Script de limpeza de títulos legados via IA.

**Architecture:** Três sprints independentes. Sprint 1 quick wins de segurança (SQL + patches pequenos). Sprint 2 segurança estrutural (middleware, rate limiting, integração de award-xp). Sprint 3 Display Names (trigger de pré-aprovação + fila admin + script de IA).

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), Vercel, Upstash Redis (Sprint 2), Anthropic SDK `claude-sonnet-4-6` (Sprint 3 script)

## Global Constraints

- Não alterar contratos de API públicos (parâmetros que o frontend já envia) — só remover/ignorar campos inseguros no server
- Toda migration SQL deve ser criada em `supabase/migrations/` com timestamp no nome
- Padrão de auth existente: `Authorization: Bearer <token>` no header → `getSupabaseUserClient(token)` → `supabase.auth.getUser(token)`
- Factory de clientes em `src/lib/supabase.ts` — não criar clientes inline em routes
- Nunca usar `getSupabaseAdmin()` em rotas acessadas por usuários comuns

---

## SPRINT 1 — Quick Wins (P0)

---

### Task 1: RLS em `stl_removal_decisions`

**Files:**
- Create: `supabase/migrations/20260624_rls_stl_removal_decisions.sql`

**Interfaces:**
- Consumes: função existente `public.is_admin()` (já existe, SECURITY DEFINER)
- Produces: tabela protegida — apenas admins podem ler/inserir/atualizar

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260624_rls_stl_removal_decisions.sql

ALTER TABLE public.stl_removal_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on stl_removal_decisions"
  ON public.stl_removal_decisions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

- [ ] **Step 2: Aplicar via Supabase MCP**

Usar `mcp__6ad662db...__apply_migration` com o SQL acima, ou rodar:
```bash
supabase db push
```

- [ ] **Step 3: Verificar no Supabase Dashboard**

Acessar Table Editor → `stl_removal_decisions` → confirmar que RLS está ativo e a policy aparece.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624_rls_stl_removal_decisions.sql
git commit -m "security: enable RLS on stl_removal_decisions with admin-only policy"
```

---

### Task 2: UNIQUE constraints em votos de games

**Files:**
- Create: `supabase/migrations/20260624_unique_game_votes.sql`

**Interfaces:**
- Consumes: tabelas `tag_detective_votes` e `category_votes` (já existem)
- Produces: constraints que impedem voto duplo do mesmo user no mesmo STL

**Nota:** `tag_detective_votes` tem nível por tag (user pode votar em tags diferentes do mesmo STL), então o UNIQUE é em `(user_id, stl_id, tag)`. Já `category_votes` é um voto por STL, então `(user_id, stl_id)`.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260624_unique_game_votes.sql

-- tag_detective_votes: um voto por (user, stl, tag)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tag_detective_votes_user_stl_tag_unique'
      AND conrelid = 'public.tag_detective_votes'::regclass
  ) THEN
    ALTER TABLE public.tag_detective_votes
      ADD CONSTRAINT tag_detective_votes_user_stl_tag_unique
      UNIQUE (user_id, stl_id, tag);
  END IF;
END $$;

-- category_votes: um voto por (user, stl)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_votes_user_stl_unique'
      AND conrelid = 'public.category_votes'::regclass
  ) THEN
    ALTER TABLE public.category_votes
      ADD CONSTRAINT category_votes_user_stl_unique
      UNIQUE (user_id, stl_id);
  END IF;
END $$;
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push
```

- [ ] **Step 3: Verificar**

```sql
-- Executar no Supabase SQL Editor para confirmar:
SELECT conname, contype FROM pg_constraint
WHERE conrelid IN (
  'public.tag_detective_votes'::regclass,
  'public.category_votes'::regclass
)
AND contype = 'u';
-- Deve retornar as duas novas constraints
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624_unique_game_votes.sql
git commit -m "security: add UNIQUE constraints to prevent duplicate game votes"
```

---

### Task 3: Deletar endpoints `/api/test/*`

**Files:**
- Delete: `src/app/api/test/create-subscription/route.ts`
- Delete: `src/app/api/test/create-real-subscription/route.ts`
- Delete: `src/app/api/test/` (pasta vazia após remoção)

- [ ] **Step 1: Remover arquivos e pasta**

```bash
rm -rf src/app/api/test/
```

- [ ] **Step 2: Verificar que não há importações desses endpoints**

```bash
grep -r "api/test" src/ --include="*.ts" --include="*.tsx"
# Deve retornar vazio
```

- [ ] **Step 3: Commit**

```bash
git commit -m "security: remove test-only subscription endpoints from production"
```

---

### Task 4: Adicionar auth em `/api/affiliate/track-click`

**Files:**
- Modify: `src/app/api/affiliate/track-click/route.ts`

**Interfaces:**
- Consumes: `getSupabaseUserClient` de `@/lib/supabase`
- Produces: rota exige token válido; `user_id` vem sempre do token (não do body)

**Nota:** O client-side que chama essa rota precisa enviar o token. Verificar como as outras rotas de game enviam (padrão: `Authorization: Bearer <token>` no header fetch). O `user_id` do body deve ser **ignorado** — sempre usar `user.id` do token.

- [ ] **Step 1: Reescrever a route**

```typescript
// src/app/api/affiliate/track-click/route.ts
import { getSupabaseUserClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ success: true }, { status: 200 }) // fail silently
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    const { product_id } = await req.json()

    if (!product_id) {
      return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })
    }

    const referer_path = req.headers.get('referer') || '/affiliate'

    const { error } = await supabase.from('affiliate_clicks').insert([
      {
        product_id,
        user_id: authError || !user ? null : user.id,
        referer_path,
      },
    ])

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/affiliate/track-click]', err)
    return NextResponse.json({ success: true }, { status: 200 })
  }
}
```

**Atenção:** Mantemos o "fail silently" para não quebrar o redirect do usuário. O user_id agora vem do token quando disponível, ou `null` para não-autenticados.

- [ ] **Step 2: Verificar que o frontend envia o token**

```bash
grep -r "track-click" src/ --include="*.ts" --include="*.tsx" -l
# Abrir o arquivo encontrado e confirmar se envia Authorization header
# Se não enviar, precisa adicionar o header na chamada fetch do frontend
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/affiliate/track-click/route.ts
git commit -m "security: use auth token in affiliate track-click, drop unauthenticated user_id from body"
```

---

### Task 5: Security headers no `next.config.ts`

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Adicionar headers de segurança**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "three-csg-ts",
  ],
  turbopack: {},
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
```

**Nota:** CSP (Content-Security-Policy) foi deliberadamente omitido. Com Three.js, inline scripts e workers, configurar CSP sem quebrar a app requer análise cuidadosa. É P2 — deixar para após estabilizar os outros itens.

- [ ] **Step 2: Testar localmente**

```bash
npm run dev
# Acessar qualquer página e inspecionar os response headers no DevTools (Network tab)
# Confirmar que X-Frame-Options: DENY aparece
```

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "security: add HTTP security headers (X-Frame-Options, HSTS, etc)"
```

---

### Task 6: Correção parcial de `photo-match-answer` — server computa `is_correct`

**Files:**
- Modify: `src/app/api/games/photo-match-answer/route.ts`

**Interfaces:**
- Consumes: body `{ stl_id, user_answer: boolean, correct_answer: boolean }` (campo `is_correct` é **removido** do contrato)
- Produces: mesma resposta atual; `is_correct` computado no server como `user_answer === correct_answer`

**Nota de segurança:** Esta é uma correção **parcial**. O `correct_answer` ainda vem do client (porque o "ground truth" é gerado no browser pelo gameDataLoader). Um atacante pode enviar `user_answer: true, correct_answer: true` e ser creditado. A correção completa (session token) está no Sprint 2. Esta task elimina o exploit mais óbvio: `is_correct: true` com `user_answer: false`.

- [ ] **Step 1: Modificar a route para computar `is_correct` server-side**

Localizar `src/app/api/games/photo-match-answer/route.ts`, linha 18.

Substituir:
```typescript
const { stl_id, user_answer, correct_answer, is_correct } = await request.json()
```
Por:
```typescript
const { stl_id, user_answer, correct_answer } = await request.json()
const is_correct = user_answer === correct_answer
```

O restante do arquivo permanece idêntico — `is_correct` já é usado da mesma forma nas linhas seguintes.

- [ ] **Step 2: Verificar que o frontend não depende do campo `is_correct` no body da request**

```bash
grep -r "photo-match-answer" src/ --include="*.ts" --include="*.tsx" -l
# Abrir os arquivos e confirmar que apenas enviam user_answer e correct_answer (não is_correct)
```

- [ ] **Step 3: Testar o fluxo do Photo Match game manualmente**

Iniciar `npm run dev`, jogar uma rodada de Photo Match, confirmar que créditos/XP são concedidos corretamente.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/games/photo-match-answer/route.ts
git commit -m "security: compute is_correct server-side in photo-match-answer, reject client value"
```

---

## SPRINT 2 — Estrutural (P1)

---

### Task 7: `middleware.ts` — auth guard global

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: Supabase session via cookie (SSR)
- Produces: redireciona usuários não-autenticados de `/dashboard/*`; não bloqueia `/api/*` (rotas têm auth própria) nem rotas públicas

**Nota de design:** Rotas de API **não são protegidas aqui** porque cada route handler já valida o token via `getSupabaseUserClient`. O middleware cobre apenas o SSR de páginas — impede que usuários não-logados vejam o dashboard.

- [ ] **Step 1: Criar o middleware**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  if ((isDashboardRoute || isAdminRoute) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}
```

- [ ] **Step 2: Testar localmente**

```bash
npm run dev
# Testar: abrir /dashboard sem estar logado → deve redirecionar para /login
# Testar: fazer login → /dashboard deve funcionar normalmente
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "security: add Next.js middleware to guard dashboard and admin routes"
```

---

### Task 8: Integrar `award-xp` no fluxo de jogo — remover endpoint standalone

**Files:**
- Delete: `src/app/api/games/award-xp/route.ts`
- Modify: `src/app/api/games/photo-match-answer/route.ts` (já chama award_xp internamente — verificar)
- Modify: `src/app/api/games/tag-detective-vote/route.ts`
- Modify: `src/app/api/games/category-vote/route.ts`

**Interfaces:**
- Consumes: RPCs existentes `record_game_action` e `award_xp`
- Produces: XP é concedido **somente** como parte da resposta do voto/jogo, nunca por endpoint isolado

**Nota:** Antes de deletar, confirmar quais routes chamam `/api/games/award-xp` diretamente no frontend.

- [ ] **Step 1: Mapear quem chama o endpoint `award-xp`**

```bash
grep -r "award-xp" src/ --include="*.ts" --include="*.tsx"
```

Se o resultado mostrar chamadas diretas de componentes frontend, esses componentes precisam ser atualizados para não chamar mais `award-xp` diretamente. A lógica de XP deve ficar embutida na route do jogo.

- [ ] **Step 2: Verificar se photo-match-answer já chama `award_xp` internamente**

```bash
grep -n "award_xp" src/app/api/games/photo-match-answer/route.ts
# Esperado: sim, já chama na linha ~35
```

Se sim, o Photo Match já está correto. Verificar tag-detective-vote e category-vote:

```bash
grep -n "award_xp" src/app/api/games/tag-detective-vote/route.ts
grep -n "award_xp" src/app/api/games/category-vote/route.ts
```

- [ ] **Step 3: Adicionar XP nas routes que ainda não têm**

Se tag-detective-vote ou category-vote não chamam `award_xp`, adicionar o bloco após o `record_game_action` bem-sucedido:

```typescript
// Após o bloco de record_game_action existente:
const { data: xpConfig } = await supabase
  .from('game_rewards_config')
  .select('xp_per_action')
  .eq('game_type', 'tag-detective') // ou 'category-sort'
  .single() as any
const xpPerAction = xpConfig?.xp_per_action ?? 10

const { data: xpData } = await supabase
  .rpc('award_xp', {
    p_user_id: user.id,
    p_game_type: 'tag-detective', // ou 'category-sort'
    p_xp_amount: xpPerAction,
  })
  .single() as any
```

- [ ] **Step 4: Deletar o endpoint standalone**

```bash
rm src/app/api/games/award-xp/route.ts
# Se a pasta ficar vazia (não tem outros arquivos):
rmdir src/app/api/games/award-xp/ 2>/dev/null || true
```

- [ ] **Step 5: Confirmar que build passa**

```bash
npm run build
# Deve compilar sem erros
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "security: remove standalone award-xp endpoint, integrate XP into game vote routes"
```

---

### Task 9: Rate limiting com Upstash Redis

**Files:**
- Create: `src/lib/rateLimit.ts`
- Modify: `src/app/api/games/photo-match-answer/route.ts`
- Modify: `src/app/api/games/tag-detective-vote/route.ts`
- Modify: `src/app/api/games/category-vote/route.ts`
- Modify: `src/app/api/games/audit-vote/route.ts`

**Pré-requisito:** Conta no Upstash (free tier), `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` configuradas no Vercel e `.env.local`.

**Interfaces:**
- Consumes: `user.id` (string) como chave de rate limit
- Produces: 429 com `{ error: 'Rate limit excedido. Tente novamente em breve.' }` se passar do limite

- [ ] **Step 1: Instalar dependência**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Criar utilitário de rate limit**

```typescript
// src/lib/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 30 game actions por minuto por usuário
export const gameActionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:game',
})

// 5 checkouts por hora por usuário
export const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:checkout',
})
```

- [ ] **Step 3: Aplicar `gameActionLimiter` nas routes de game**

Em cada route de game (photo-match-answer, tag-detective-vote, category-vote, audit-vote), adicionar após a validação de auth:

```typescript
import { gameActionLimiter } from '@/lib/rateLimit'

// ... após confirmar user.id ...

const { success, limit, remaining } = await gameActionLimiter.limit(user.id)
if (!success) {
  return NextResponse.json(
    { error: 'Rate limit excedido. Tente novamente em breve.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      },
    }
  )
}
```

- [ ] **Step 4: Adicionar env vars no Vercel**

No painel Vercel → Settings → Environment Variables:
- `UPSTASH_REDIS_REST_URL` = (da conta Upstash)
- `UPSTASH_REDIS_REST_TOKEN` = (da conta Upstash)

- [ ] **Step 5: Testar localmente com `.env.local`**

Adicionar as vars no `.env.local` e rodar `npm run dev`. Fazer 35 requisições rápidas na mesma rota de game — a partir da 31ª deve retornar 429.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rateLimit.ts src/app/api/games/
npm run build # confirmar build ok
git commit -m "security: add Upstash rate limiting (30 req/min) to all game action routes"
```

---

## Checklist de verificação pós-Sprint 1

Execute após todos os commits do Sprint 1 para confirmar que nada quebrou:

```bash
# 1. Build sem erros
npm run build

# 2. Confirmar que test/ foi removido
ls src/app/api/test/ 2>/dev/null && echo "AINDA EXISTE" || echo "REMOVIDO OK"

# 3. Confirmar que affiliate/track-click não usa mais service role inline
grep -n "SUPABASE_SERVICE_ROLE_KEY" src/app/api/affiliate/track-click/route.ts
# Deve retornar vazio

# 4. Confirmar security headers
curl -I https://<seu-dominio>.vercel.app | grep -E "X-Frame|X-Content|Strict-Transport"
```

## Checklist de verificação pós-Sprint 2

```bash
# 1. Confirmar award-xp removido
ls src/app/api/games/award-xp/ 2>/dev/null && echo "AINDA EXISTE" || echo "REMOVIDO OK"

# 2. Confirmar middleware presente
ls src/middleware.ts

# 3. Testar dashboard sem auth → deve redirecionar
curl -s -o /dev/null -w "%{http_code}" https://<seu-dominio>.vercel.app/dashboard
# Deve retornar 307 (redirect)
```

---

## Itens fora do escopo deste plano

- Game session token (server-side ground truth para correct_answer) — refactor de 1-2 dias, separar em plano próprio
- Zod para validação de inputs — P2, separar em plano próprio
- Mobile responsiveness — P2, separar em plano próprio
- CSP headers — requer análise de inline scripts do Three.js
- Rotação de secrets (SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_PROXY_API_KEY) — ação manual no Supabase/Vercel, não requer código

---

## SPRINT 3 — Display Names / Títulos de Canais (P0 Produto)

**Contexto de design:**
- `telegram_indexed_stls` já tem `title` (nome exibido) e `file_name` (nome físico, nunca muda)
- `stl_audit_suggestions` já existe e aceita `suggested_title` via UI do Quality Audit (campo já renderizado em `QualityAudit.tsx`)
- `stl_audit_suggestion_upvotes` já conta votos e mantém `upvote_count` via trigger
- `stl_audit_results.final_status` já chega a `'approved'` quando 70% votam positivamente no STL
- **Decisão Q1:** quando consenso é atingido, a sugestão de título vai para fila de admin como `pre_approved` (não auto-aplica)
- **Decisão Q2:** script de IA limpa títulos legados agora; comunidade complementa no futuro

---

### Task 10: Migration — coluna `status` em `stl_audit_suggestions` + trigger de pré-aprovação

**Files:**
- Create: `supabase/migrations/20260624_title_suggestion_status.sql`

**Interfaces:**
- Consumes: `stl_audit_results.final_status`, `stl_audit_suggestions.upvote_count`, `stl_audit_suggestions.suggested_title`
- Produces: `stl_audit_suggestions.status` muda para `'pre_approved'` quando o STL é aprovado pela comunidade e existe sugestão de título

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260624_title_suggestion_status.sql

-- 1. Adicionar coluna de status às sugestões
ALTER TABLE public.stl_audit_suggestions
  ADD COLUMN IF NOT EXISTS status text
  NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'pre_approved', 'applied', 'rejected'));

CREATE INDEX IF NOT EXISTS stl_audit_suggestions_status_idx
  ON public.stl_audit_suggestions(status)
  WHERE status = 'pre_approved';

-- 2. Função: quando um STL é aprovado pela comunidade,
--    marca a sugestão de título mais votada como pre_approved
CREATE OR REPLACE FUNCTION public.mark_top_title_suggestion_pre_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_suggestion_id uuid;
BEGIN
  -- Só age quando final_status mudar para 'approved'
  IF NEW.final_status = 'approved' AND
     (OLD.final_status IS DISTINCT FROM 'approved') THEN

    -- Busca a sugestão de título mais votada para este STL
    SELECT id INTO v_top_suggestion_id
    FROM public.stl_audit_suggestions
    WHERE stl_id = NEW.stl_id
      AND suggested_title IS NOT NULL
      AND suggested_title <> ''
      AND status = 'pending'
    ORDER BY upvote_count DESC
    LIMIT 1;

    IF v_top_suggestion_id IS NOT NULL THEN
      UPDATE public.stl_audit_suggestions
      SET status = 'pre_approved'
      WHERE id = v_top_suggestion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_stl_audit_approved
  AFTER UPDATE OF final_status ON public.stl_audit_results
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_top_title_suggestion_pre_approved();

-- 3. Policy: admins podem atualizar status das sugestões
CREATE POLICY "Admins can update suggestion status"
  ON public.stl_audit_suggestions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push
```

- [ ] **Step 3: Verificar trigger no SQL Editor**

```sql
-- Simular manualmente: pegar um stl_id que existe em stl_audit_results
-- e tem suggestions com suggested_title, e mudar o final_status para 'approved'
-- Depois verificar se a suggestion mais votada ficou com status = 'pre_approved'
SELECT id, stl_id, suggested_title, upvote_count, status
FROM stl_audit_suggestions
WHERE status = 'pre_approved'
LIMIT 5;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624_title_suggestion_status.sql
git commit -m "feat: add status column to stl_audit_suggestions + trigger to pre-approve top title on STL approval"
```

---

### Task 11: API admin para aplicar ou rejeitar sugestão pré-aprovada

**Files:**
- Create: `src/app/api/admin/apply-title-suggestion/route.ts`

**Interfaces:**
- Consumes: `POST { suggestion_id: string, action: 'apply' | 'reject' }`
- Produces:
  - `apply`: atualiza `telegram_indexed_stls.title` com `suggested_title` da sugestão; marca sugestão como `applied`
  - `reject`: marca sugestão como `rejected`
  - Ambos requerem `role = 'sysadmin'`

- [ ] **Step 1: Criar a route**

```typescript
// src/app/api/admin/apply-title-suggestion/route.ts
import { getSupabaseUserClient, getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseUserClient(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { suggestion_id, action } = await request.json()

    if (!suggestion_id || !['apply', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Missing suggestion_id or invalid action' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Busca a sugestão
    const { data: suggestion, error: fetchError } = await admin
      .from('stl_audit_suggestions')
      .select('id, stl_id, suggested_title, status')
      .eq('id', suggestion_id)
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (suggestion.status !== 'pre_approved') {
      return NextResponse.json({ error: 'Suggestion is not in pre_approved status' }, { status: 400 })
    }

    if (action === 'apply') {
      if (!suggestion.suggested_title) {
        return NextResponse.json({ error: 'Suggestion has no title to apply' }, { status: 400 })
      }

      // Atualiza o título do STL
      const { error: updateError } = await admin
        .from('telegram_indexed_stls')
        .update({ title: suggestion.suggested_title })
        .eq('id', suggestion.stl_id)

      if (updateError) throw updateError

      // Marca a sugestão como aplicada
      await admin
        .from('stl_audit_suggestions')
        .update({ status: 'applied' })
        .eq('id', suggestion_id)

      return NextResponse.json({
        success: true,
        action: 'applied',
        new_title: suggestion.suggested_title,
      })
    }

    // action === 'reject'
    await admin
      .from('stl_audit_suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestion_id)

    return NextResponse.json({ success: true, action: 'rejected' })
  } catch (error) {
    console.error('[ADMIN-APPLY-TITLE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/apply-title-suggestion/route.ts
git commit -m "feat: add admin API to apply or reject pre-approved title suggestions"
```

---

### Task 12: UI admin — fila de títulos pré-aprovados no `AuditTab`

**Files:**
- Modify: `src/components/admin/AuditTab.tsx`

**Interfaces:**
- Consumes: endpoint `GET /api/admin/audit-queue` (já existe — verificar se retorna `pre_approved` suggestions)
- Consumes: novo endpoint `POST /api/admin/apply-title-suggestion`
- Produces: nova seção "Títulos Pré-Aprovados" no AuditTab com botões Aplicar / Rejeitar

**Nota:** Antes de implementar, verificar se `get_admin_audit_queue` RPC já retorna sugestões com `status = 'pre_approved'`. Se não, adicionar à query da RPC ou fazer uma query separada no componente.

- [ ] **Step 1: Verificar o que `get_admin_audit_queue` retorna**

```bash
# Procurar a função no banco
grep -r "get_admin_audit_queue" /Users/ggobetti/Projetos\ Pessoais/lb-creative-studio/supabase/migrations/*.sql
```

Se a função não inclui `status = 'pre_approved'` das suggestions, adicionar uma query adicional no componente:

```typescript
// Dentro do AuditTab.tsx, no useEffect de carregamento:
const { data: preTitleQueue } = await supabase
  .from('stl_audit_suggestions')
  .select(`
    id,
    stl_id,
    suggested_title,
    upvote_count,
    created_at,
    stl:telegram_indexed_stls!inner(id, title, photos)
  `)
  .eq('status', 'pre_approved')
  .order('upvote_count', { ascending: false })
  .limit(50)
```

- [ ] **Step 2: Adicionar seção "Títulos Pré-Aprovados" ao AuditTab**

Localizar o `return (` do `AuditTab.tsx` e adicionar um novo bloco antes ou após o painel de moderação existente:

```tsx
{/* ── Títulos Pré-Aprovados ── */}
{preTitleQueue && preTitleQueue.length > 0 && (
  <div className="mt-6">
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
      Títulos Pré-Aprovados pela Comunidade ({preTitleQueue.length})
    </h3>
    <div className="space-y-2">
      {preTitleQueue.map((item) => (
        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          {item.stl?.photos?.[0] && (
            <img
              src={item.stl.photos[0]}
              alt=""
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              Atual: <span className="text-foreground">{item.stl?.title}</span>
            </p>
            <p className="text-sm font-medium truncate">
              Novo: <span className="text-primary">{item.suggested_title}</span>
            </p>
            <p className="text-xs text-muted-foreground">{item.upvote_count} apoios</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleTitleAction(item.id, 'apply')}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Aplicar
            </button>
            <button
              onClick={() => handleTitleAction(item.id, 'reject')}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Rejeitar
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Implementar `handleTitleAction`**

```typescript
const handleTitleAction = async (suggestionId: string, action: 'apply' | 'reject') => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const res = await fetch('/api/admin/apply-title-suggestion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ suggestion_id: suggestionId, action }),
  })

  if (res.ok) {
    // Remover do estado local
    setPreTitleQueue((prev) => prev.filter((i) => i.id !== suggestionId))
  }
}
```

- [ ] **Step 4: Testar localmente**

```bash
npm run dev
# Acessar /admin como sysadmin
# Confirmar que a seção aparece (se houver suggestions pré-aprovadas no banco)
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AuditTab.tsx
git commit -m "feat: add pre-approved title queue to admin AuditTab with apply/reject actions"
```

---

### Task 13: Script de limpeza de títulos legados via IA

**Files:**
- Create: `scripts/cleanup-stl-titles.ts`

**Pré-requisito:**
- `ANTHROPIC_API_KEY` configurada em `.env.local`
- `@anthropic-ai/sdk` instalado (`npm install @anthropic-ai/sdk`)
- `tsx` disponível (`npx tsx`)

**Interfaces:**
- Consumes: `telegram_indexed_stls` (lê `id`, `title`)
- Produces: `telegram_indexed_stls.title` atualizado (somente em modo `--apply`)
- Modo padrão é dry run — imprime o que faria sem alterar nada

**Lógica de detecção de títulos sujos:**
Um título é candidato à limpeza se contiver qualquer um dos padrões:
- `@` (menção de canal)
- `_` (underscore — comum em nomes de arquivo)
- Sequência de maiúsculas com 3+ chars sem vogal (ex: `STL`, `TRX`, `FDM`)
- Começa com número ou símbolo especial
- Tem menos de 3 palavras reais (ex: `modelov2_final`)

- [ ] **Step 1: Instalar dependência se ainda não tiver**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Criar o script**

```typescript
// scripts/cleanup-stl-titles.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = !process.argv.includes('--apply')
const BATCH_SIZE = 20
const DELAY_MS = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function isDirtyTitle(title: string): boolean {
  if (!title) return false
  if (title.includes('@')) return true
  if (title.includes('_')) return true
  if (/[A-Z]{3,}/.test(title) && !/[aeiouAEIOU]/.test(title.replace(/[^A-Za-z]/g, ''))) return true
  if (/^\d/.test(title.trim())) return true
  const wordCount = title.trim().split(/\s+/).filter(w => w.length > 2).length
  if (wordCount < 2) return true
  return false
}

async function cleanTitle(originalTitle: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Você é um assistente de curadoria de STLs (modelos 3D para impressão).
Limpe o título abaixo removendo: nomes de canais Telegram (@canal), underscores, sufixos de versão (v1, v2, _final), abreviações desnecessárias e símbolos especiais.
Deixe o resultado em português brasileiro, descritivo e com no mínimo 2 palavras.
Responda APENAS com o título limpo, sem explicações.

Título original: ${originalTitle}
Título limpo:`,
      },
    ],
  })

  const cleaned = (message.content[0] as { text: string }).text.trim()
  return cleaned || originalTitle
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sem alterações)' : 'APPLY (alterações reais)'}`)
  console.log('Buscando STLs com títulos candidatos à limpeza...\n')

  const { data: stls, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title')
    .not('title', 'is', null)
    .limit(500)

  if (error || !stls) {
    console.error('Erro ao buscar STLs:', error)
    process.exit(1)
  }

  const candidates = stls.filter(s => isDirtyTitle(s.title))
  console.log(`${stls.length} STLs lidos. ${candidates.length} candidatos encontrados.\n`)

  let updated = 0
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)

    for (const stl of batch) {
      const newTitle = await cleanTitle(stl.title)

      if (newTitle === stl.title) {
        console.log(`  SKIP  | ${stl.title}`)
        continue
      }

      console.log(`  CLEAN | "${stl.title}" → "${newTitle}"`)

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('telegram_indexed_stls')
          .update({ title: newTitle })
          .eq('id', stl.id)

        if (updateError) {
          console.error(`  ERRO ao atualizar ${stl.id}:`, updateError)
        } else {
          updated++
        }
      } else {
        updated++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\nConcluído. ${updated} títulos ${DRY_RUN ? 'seriam' : 'foram'} atualizados.`)
  if (DRY_RUN) {
    console.log('Para aplicar as mudanças, rode com: npx tsx scripts/cleanup-stl-titles.ts --apply')
  }
}

main().catch(console.error)
```

- [ ] **Step 3: Criar `.env.local` com as vars necessárias (se ainda não tiver)**

```
NEXT_PUBLIC_SUPABASE_URL=<url do projeto>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<sua chave>
```

- [ ] **Step 4: Rodar em dry run primeiro**

```bash
npx tsx scripts/cleanup-stl-titles.ts
# Revisar o output — ver se os títulos limpos fazem sentido
# Ajustar a função cleanTitle ou isDirtyTitle se necessário
```

- [ ] **Step 5: Rodar com --apply após aprovação do dry run**

```bash
npx tsx scripts/cleanup-stl-titles.ts --apply
```

- [ ] **Step 6: Commit do script (sem rodar)**

```bash
git add scripts/cleanup-stl-titles.ts
git commit -m "feat: add AI title cleanup script for legacy STL titles (dry run by default)"
```

---

---

### Task 14: "Validar Mais Tarde" na curadoria de fotos — ocultar da busca

**Contexto:** Na tela de curadoria de fotos do admin (AuditTab), quando um STL tem algum problema que exige atenção maior (foto ruim, título confuso, etc.), o admin precisa de uma opção além de Aprovar/Remover. "Validar Mais Tarde" marca o STL para revisão futura e o **remove da busca pública** até ser revisado.

**Files:**
- Create: `supabase/migrations/20260624_needs_validation_flag.sql`
- Modify: `src/app/api/admin/stl-action/route.ts` (adicionar novo case)
- Modify: `src/components/admin/AuditTab.tsx` (novo botão)
- Modify: `src/app/dashboard/stl-search/page.tsx` (filtrar na busca)

**Interfaces:**
- Consumes: `stl-action` route existente — padrão `POST { action, stl_id }`
- Produces: STL com `needs_validation = true` some da busca; admin vê lista de pendentes e pode reverter

**Nota sobre bug adjacente:** As queries da `stl-search/page.tsx` também **não filtram** `marked_for_removal = true`. Corrigir junto nesta task.

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260624_needs_validation_flag.sql

ALTER TABLE public.telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS needs_validation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS telegram_indexed_stls_needs_validation_idx
  ON public.telegram_indexed_stls(needs_validation)
  WHERE needs_validation = true;
```

- [ ] **Step 2: Aplicar migration**

```bash
supabase db push
```

- [ ] **Step 3: Adicionar novo case no `stl-action` route**

Localizar `src/app/api/admin/stl-action/route.ts`. Antes do `default` no switch, adicionar:

```typescript
case 'needs_validation': {
  const { error } = await adminSupabase
    .from('telegram_indexed_stls')
    .update({ needs_validation: true })
    .eq('id', stl_id)
  if (error) throw error
  return NextResponse.json({ success: true, action })
}

case 'clear_validation': {
  const { error } = await adminSupabase
    .from('telegram_indexed_stls')
    .update({ needs_validation: false })
    .eq('id', stl_id)
  if (error) throw error
  return NextResponse.json({ success: true, action })
}
```

**Atenção:** verificar o nome da variável do admin client neste arquivo (pode ser `adminSupabase`, `supabaseAdmin` ou `admin`).

- [ ] **Step 4: Adicionar botão "Validar Mais Tarde" no AuditTab**

Em `src/components/admin/AuditTab.tsx`, localizar onde os botões de ação do STL são renderizados (buscar pelo texto "Remover" ou "Aprovar" ou "keep_stl").

Adicionar o botão ao lado dos existentes:

```tsx
<button
  onClick={() => handleStlAction('needs_validation', stlId)}
  className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center gap-1"
  title="Ocultar da busca até revisão"
>
  <Clock size={12} />
  Validar Mais Tarde
</button>
```

Importar `Clock` de `lucide-react` (já está importado no arquivo, verificar se existe ou adicionar).

- [ ] **Step 5: Adicionar seção "Aguardando Validação" no AuditTab**

Adicionar uma query e seção que lista STLs com `needs_validation = true`, com botão para limpar o flag:

```typescript
// No useEffect de carregamento do AuditTab:
const { data: pendingValidation } = await supabase
  .from('telegram_indexed_stls')
  .select('id, title, photos, thumbnail_url')
  .eq('needs_validation', true)
  .order('updated_at', { ascending: false })
  .limit(50)
```

```tsx
{pendingValidation && pendingValidation.length > 0 && (
  <div className="mt-6">
    <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wide mb-3">
      Aguardando Validação ({pendingValidation.length})
    </h3>
    <div className="space-y-2">
      {pendingValidation.map((stl) => (
        <div key={stl.id} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-card">
          {(stl.thumbnail_url || stl.photos?.[0]) && (
            <img
              src={stl.thumbnail_url || stl.photos[0]}
              alt=""
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
          )}
          <p className="flex-1 text-sm truncate">{stl.title}</p>
          <button
            onClick={() => handleStlAction('clear_validation', stl.id)}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex-shrink-0"
          >
            Validado — Publicar
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Filtrar `needs_validation` e `marked_for_removal` na busca pública**

Em `src/app/dashboard/stl-search/page.tsx`, todas as queries em `telegram_indexed_stls` precisam dos filtros abaixo.

Há múltiplos locais (linhas ~141, ~235, ~244, ~527). Em cada um, adicionar após o `.from("telegram_indexed_stls")`:

```typescript
.eq("needs_validation", false)
.eq("marked_for_removal", false)  // bug pré-existente, corrigir junto
```

Buscar todos os locais com:
```bash
grep -n 'from("telegram_indexed_stls")' src/app/dashboard/stl-search/page.tsx
```
E adicionar os dois filtros em cada ocorrência.

- [ ] **Step 7: Testar o fluxo completo localmente**

```bash
npm run dev
```

1. Como admin: acessar AuditTab → clicar "Validar Mais Tarde" em um STL
2. Confirmar que o STL sumiu da busca em `/dashboard/stl-search`
3. Voltar ao AuditTab → seção "Aguardando Validação" → clicar "Validado — Publicar"
4. Confirmar que o STL voltou a aparecer na busca

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260624_needs_validation_flag.sql \
        src/app/api/admin/stl-action/route.ts \
        src/components/admin/AuditTab.tsx \
        src/app/dashboard/stl-search/page.tsx
git commit -m "feat: add 'needs_validation' flag to hide STLs from search pending admin review"
```

---

## Checklist de verificação pós-Sprint 3

```bash
# 1. Confirmar migration de status das suggestions aplicada
# No Supabase SQL Editor:
# SELECT column_name FROM information_schema.columns
# WHERE table_name = 'stl_audit_suggestions' AND column_name = 'status';

# 2. Confirmar migration needs_validation aplicada
# SELECT column_name FROM information_schema.columns
# WHERE table_name = 'telegram_indexed_stls' AND column_name = 'needs_validation';

# 3. Confirmar que trigger existe
# SELECT trigger_name FROM information_schema.triggers
# WHERE event_object_table = 'stl_audit_results';

# 4. Confirmar que API routes existem
ls src/app/api/admin/apply-title-suggestion/
grep -n "needs_validation\|clear_validation" src/app/api/admin/stl-action/route.ts

# 5. Confirmar filtros na busca
grep -n "needs_validation\|marked_for_removal" src/app/dashboard/stl-search/page.tsx

# 6. Script presente mas não executado
ls scripts/cleanup-stl-titles.ts

# 7. Build limpo
npm run build
```
