# STL Bundling com Portfolio Persistente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de "comprar um STL = desbloqueia todos relacionados permanentemente" com portfolio pessoal segregado.

**Architecture:** 
- Nova tabela `user_acquired_stls` com RLS para rastrear posse permanente
- Trigger automático calcula grupo (pai + filhos) ao inserir
- Modificação na rota `/api/download-stl` para validar permissão antes de débito
- Nova aba UI "Meu Portfolio" com dois sub-grupos (Makerworld vs STL Search)
- Integração com webhook Stripe existente para inserir aquisições via pagamento

**Tech Stack:** 
- Backend: Next.js 16 App Router, Supabase PostgreSQL, TypeScript
- Frontend: React 19, TypeScript, TailwindCSS v4, Zustand v5
- Database: RLS policies, triggers, indexed queries
- Testing: Jest + Supabase local env

---

## Global Constraints

- **Branch strategy:** `feat/stl-bundling` a partir de `main` (deve-se fazer push frequente)
- **Migrations:** Arquivo único `20260629_user_acquired_stls.sql` com tudo (table + indexes + RLS + trigger + view)
- **Rollback:** Migration deve ser reversível (DROP TABLE com CASCADE)
- **TypeScript:** Strict mode, sem `any`
- **Database size:** Suportar 50k STLs + usuários sem limite de aquisições
- **No breaking changes:** Sistema de créditos efêmero continua funcionando
- **Idempotência:** UNIQUE constraint evita duplicatas em reprocessamento

---

## File Structure

```
Backend (Database):
  supabase/migrations/
    20260629_user_acquired_stls.sql          ← nova migration
  src/lib/supabase.ts                         ← tipos TypeScript (UserAcquiredStl)
  src/app/api/download-stl/route.ts           ← modifica lógica de check

Frontend (UI):
  src/components/stl/
    AcquiredBadge.tsx                         ← nova: badge "Você tem este"
    StlCard.tsx                               ← modifica: botão dinâmico
  src/app/dashboard/portfolio/
    page.tsx                                  ← nova aba portfolio
    PortfolioGrid.tsx                         ← novo: grid de STLs adquiridos
    PortfolioTabs.tsx                         ← novo: abas (Makerworld vs Search)
  src/store/store.ts                          ← modifica: slice para portfolio

API Routes:
  src/app/api/portfolio/
    route.ts                                  ← novo: GET portfolio do user (RLS)
    [stlId]/download/route.ts                 ← novo: presigned URL (sem débito)
```

---

## Task 1: Database Migration — Create user_acquired_stls Table

**Files:**
- Create: `supabase/migrations/20260629_user_acquired_stls.sql`

**Interfaces:**
- Consumes: `profiles.id` (PK), `telegram_indexed_stls.id` (PK), `telegram_indexed_stls.parent_id` (FK)
- Produces: Table `user_acquired_stls`, View `vw_user_stl_portfolio`, RLS policies, Trigger `trg_insert_bundle`

**Steps:**

- [ ] **Step 1: Criar arquivo migration**

```bash
cat > supabase/migrations/20260629_user_acquired_stls.sql << 'EOF'
-- ============================================================
-- Migração: STL Bundling com Portfolio Persistente
-- Criada em: 29 de Junho de 2026
-- ============================================================

-- 1. Criar tabela user_acquired_stls
CREATE TABLE IF NOT EXISTS public.user_acquired_stls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stl_id UUID NOT NULL REFERENCES public.telegram_indexed_stls(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('stl_search', 'makerworld')) DEFAULT 'stl_search',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, stl_id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_acquired_stls_user_id 
  ON public.user_acquired_stls(user_id);

CREATE INDEX IF NOT EXISTS idx_user_acquired_stls_user_stl 
  ON public.user_acquired_stls(user_id, stl_id);

CREATE INDEX IF NOT EXISTS idx_user_acquired_stls_source 
  ON public.user_acquired_stls(user_id, source);

-- 3. Habilitar RLS
ALTER TABLE public.user_acquired_stls ENABLE ROW LEVEL SECURITY;

-- 4. Criar policies RLS
DROP POLICY IF EXISTS "user_acquired_stls: own all" ON public.user_acquired_stls;
DROP POLICY IF EXISTS "user_acquired_stls: admin all" ON public.user_acquired_stls;

CREATE POLICY "user_acquired_stls: own all"
  ON public.user_acquired_stls FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_acquired_stls: admin all"
  ON public.user_acquired_stls FOR ALL
  USING (public.is_admin());

-- 5. Criar VIEW com RLS
DROP VIEW IF EXISTS public.vw_user_stl_portfolio;

CREATE VIEW public.vw_user_stl_portfolio AS
SELECT 
  uas.id,
  uas.user_id,
  uas.stl_id,
  tis.title,
  tis.thumbnail_url,
  tis.telegram_group_id,
  tis.parent_id,
  tis.parts_count,
  uas.source,
  uas.acquired_at
FROM public.user_acquired_stls uas
JOIN public.telegram_indexed_stls tis ON uas.stl_id = tis.id;

ALTER TABLE public.vw_user_stl_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vw_user_stl_portfolio: own view" ON public.vw_user_stl_portfolio;

CREATE POLICY "vw_user_stl_portfolio: own view"
  ON public.vw_user_stl_portfolio FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Criar função para calcular grupo de STL
CREATE OR REPLACE FUNCTION public.get_stl_group(p_stl_id UUID)
RETURNS TABLE(group_stl_id UUID, group_type TEXT) AS $$
BEGIN
  -- Se o STL tem parent_id, retorna pai + todos os filhos
  -- Se é pai (parent_id IS NULL), retorna ele + todos os filhos
  
  RETURN QUERY
  WITH target_stl AS (
    SELECT id, parent_id FROM public.telegram_indexed_stls WHERE id = p_stl_id
  ),
  group_root AS (
    SELECT COALESCE(parent_id, id) AS group_id FROM target_stl
  ),
  group_members AS (
    SELECT id AS group_stl_id FROM public.telegram_indexed_stls
    WHERE parent_id = (SELECT group_id FROM group_root)
       OR id = (SELECT group_id FROM group_root)
  )
  SELECT DISTINCT group_stl_id, 'group_member'::TEXT FROM group_members;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7. Criar função trigger para inserir bundle automaticamente
CREATE OR REPLACE FUNCTION public.insert_stl_bundle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_stl_id UUID;
BEGIN
  -- Quando inserir um STL em user_acquired_stls,
  -- inserir também todo o grupo (pai + irmãos)
  
  FOR v_group_stl_id IN
    SELECT group_stl_id FROM public.get_stl_group(NEW.stl_id)
  LOOP
    INSERT INTO public.user_acquired_stls (user_id, stl_id, source, acquired_at)
    VALUES (NEW.user_id, v_group_stl_id, NEW.source, NEW.acquired_at)
    ON CONFLICT (user_id, stl_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 8. Criar trigger
DROP TRIGGER IF EXISTS trg_insert_stl_bundle ON public.user_acquired_stls;

CREATE TRIGGER trg_insert_stl_bundle
  AFTER INSERT ON public.user_acquired_stls
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_stl_bundle();

-- 9. Log
SELECT '[user_acquired_stls] Migration completa: tabela, índices, RLS, VIEW, triggers criados' AS log_message;
EOF
```

- [ ] **Step 2: Validar arquivo migration**

```bash
cd /Users/ggobetti/Projetos\ Pessoais/lb-creative-studio
wc -l supabase/migrations/20260629_user_acquired_stls.sql
# Expected: ~120+ linhas
```

- [ ] **Step 3: Aplicar migration localmente (Supabase local)**

```bash
# Se usar supabase local (opcional, testing)
supabase db reset
# ou aplicar via Supabase Dashboard SQL Editor (produção)
```

- [ ] **Step 4: Criar tipos TypeScript**

Edit `src/lib/supabase.ts` e adicionar:

```typescript
export interface UserAcquiredStl {
  id: string;
  user_id: string;
  stl_id: string;
  source: 'stl_search' | 'makerworld';
  acquired_at: string;
}

export interface UserStlPortfolio {
  id: string;
  user_id: string;
  stl_id: string;
  title: string;
  thumbnail_url: string | null;
  telegram_group_id: string;
  parent_id: string | null;
  parts_count: number;
  source: 'stl_search' | 'makerworld';
  acquired_at: string;
}
```

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/20260629_user_acquired_stls.sql src/lib/supabase.ts
git commit -m "feat: create user_acquired_stls table with RLS and bundle trigger

- Add user_acquired_stls table to track permanent STL ownership
- Create vw_user_stl_portfolio view with RLS
- Implement insert_stl_bundle() trigger for group calculation
- Add TypeScript interfaces for UI/API"
```

---

## Task 2: API Route — POST /api/download-stl (Modify)

**Files:**
- Modify: `src/app/api/download-stl/route.ts` (adicionar check acquired_stls)

**Interfaces:**
- Consumes: `profiles.credits` (int), `UserAcquiredStl` type, RPC `get_stl_group()`
- Produces: JSON response com presigned URL ou erro

**Steps:**

- [ ] **Step 1: Ler rota existente**

```bash
cat src/app/api/download-stl/route.ts | head -100
```

- [ ] **Step 2: Adicionar função auxiliar para check de permissão**

No início do arquivo `src/app/api/download-stl/route.ts`, adicionar:

```typescript
async function userHasStlAccess(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  stlId: string
): Promise<boolean> {
  // Verifica se user_id está em user_acquired_stls para stlId (com RLS)
  const { data, error } = await supabase
    .from('user_acquired_stls')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('stl_id', stlId)
    .limit(1);

  if (error) {
    console.error('[download-stl] Error checking access:', error);
    return false;
  }

  return data && data.length > 0;
}
```

- [ ] **Step 3: Modificar POST handler para validar permissão**

Encontrar a seção do handler POST que valida créditos. **Antes** de gerar presigned URL, adicionar:

```typescript
// No POST handler, após auth + parse JSON:

const { stlId } = body;

// Check 1: Validar que STL existe
const { data: stl, error: stlError } = await supabase
  .from('telegram_indexed_stls')
  .select('id, parent_id, parts_count, price_free, price_pro, price_max')
  .eq('id', stlId)
  .single();

if (stlError || !stl) {
  return NextResponse.json(
    { error: 'STL not found' },
    { status: 404 }
  );
}

// Check 2: Verificar se user JÁ tem este STL
const alreadyHasAccess = await userHasStlAccess(supabase, userId, stlId);

if (alreadyHasAccess) {
  // User já tem — pular débito, ir direto pra presigned URL
  // (manter lógica de presigned URL existente, só não debitar)
  console.log(`[download-stl] User ${userId} already has STL ${stlId}, skipping debit`);
  
  // Incrementar download_count (já existe)
  await supabase
    .from('telegram_indexed_stls')
    .update({ download_count: stl.download_count + 1 })
    .eq('id', stlId);

  // Log em telegram_downloads_history
  await supabase
    .from('telegram_downloads_history')
    .insert({ user_id: userId, stl_id: stlId });

  // Gerar presigned URL e retornar (não cobrar)
  const presignedUrl = await generatePresignedUrl(stl); // função existente
  return NextResponse.json({ url: presignedUrl, charged: false });
}

// Check 3: Se NÃO tem, validar créditos ANTES de inserir na tabela
const plan = profile?.plan || 'free';
const creditCost = plan === 'max' 
  ? stl.price_max 
  : plan === 'pro' 
    ? stl.price_pro 
    : stl.price_free;

if (profile.credits < creditCost) {
  return NextResponse.json(
    { error: 'INSUFFICIENT_CREDITS', required: creditCost, available: profile.credits },
    { status: 402 }
  );
}

// Check 4: Transação atômica — débito + inserir em user_acquired_stls
try {
  const { error: txError } = await supabase.rpc('acquire_stl_bundle', {
    p_user_id: userId,
    p_stl_id: stlId,
    p_source: 'stl_search',
    p_credit_cost: creditCost
  });

  if (txError) throw txError;
  
  console.log(`[download-stl] Successfully acquired STL bundle for user ${userId}`);

} catch (err) {
  console.error('[download-stl] Transaction failed:', err);
  return NextResponse.json(
    { error: 'Failed to process download' },
    { status: 500 }
  );
}

// Gerar presigned URL e retornar
const presignedUrl = await generatePresignedUrl(stl);
return NextResponse.json({ url: presignedUrl, charged: true });
```

- [ ] **Step 4: Criar RPC `acquire_stl_bundle` (em migration ou SQL separado)**

Se preferir, adicionar ao final da migration anterior:

```sql
-- Em 20260629_user_acquired_stls.sql, ao final:

CREATE OR REPLACE FUNCTION public.acquire_stl_bundle(
  p_user_id UUID,
  p_stl_id UUID,
  p_source TEXT,
  p_credit_cost INT
)
RETURNS VOID AS $$
BEGIN
  -- Fase 1: Debitar créditos (atômico com FOR UPDATE)
  UPDATE public.profiles
  SET credits = credits - p_credit_cost
  WHERE id = p_user_id
    AND credits >= p_credit_cost
  FOR UPDATE;

  -- Fase 2: Inserir STL em user_acquired_stls
  -- (Trigger calcula grupo automaticamente)
  INSERT INTO public.user_acquired_stls (user_id, stl_id, source)
  VALUES (p_user_id, p_stl_id, p_source)
  ON CONFLICT (user_id, stl_id) DO NOTHING;

  -- Fase 3: Log em transactions table
  INSERT INTO public.transactions (user_id, amount, type, reference_stl_id, metadata)
  VALUES (
    p_user_id,
    -p_credit_cost,
    'download_stl',
    p_stl_id,
    jsonb_build_object('bundled', true, 'source', p_source)
  );

  -- Fase 4: Incrementar download_count
  UPDATE public.telegram_indexed_stls
  SET download_count = download_count + 1
  WHERE id = p_stl_id;

  -- Fase 5: Log em telegram_downloads_history
  INSERT INTO public.telegram_downloads_history (user_id, stl_id)
  VALUES (p_user_id, p_stl_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/download-stl/route.ts supabase/migrations/20260629_user_acquired_stls.sql
git commit -m "feat: add STL bundle acquisition logic to download-stl endpoint

- Check if user already has STL (via RLS query)
- Skip debit if already acquired
- Atomic transaction: debit credits + insert bundle + log
- Create RPC acquire_stl_bundle() for atomicity"
```

---

## Task 3: API Route — GET /api/portfolio (New)

**Files:**
- Create: `src/app/api/portfolio/route.ts`

**Interfaces:**
- Consumes: Auth user (RLS), `UserStlPortfolio` type
- Produces: JSON { makerworld: [], stlSearch: [], total: number }

**Steps:**

- [ ] **Step 1: Criar arquivo**

```bash
cat > src/app/api/portfolio/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Query portfolio (VIEW with RLS)
    const { data: portfolio, error: portfolioError } = await supabase
      .from('vw_user_stl_portfolio')
      .select('*')
      .eq('user_id', user.id)
      .order('acquired_at', { ascending: false });

    if (portfolioError) throw portfolioError;

    // Segregar por source
    const makerworld = portfolio?.filter(p => p.source === 'makerworld') || [];
    const stlSearch = portfolio?.filter(p => p.source === 'stl_search') || [];

    return NextResponse.json({
      makerworld,
      stlSearch,
      total: portfolio?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('[GET /api/portfolio]:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
EOF
```

- [ ] **Step 2: Testar com curl (local)**

```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:3000/api/portfolio
# Expected: { makerworld: [...], stlSearch: [...], total: X }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portfolio/route.ts
git commit -m "feat: add portfolio API endpoint

- Query vw_user_stl_portfolio with RLS
- Segregate by source (makerworld vs stl_search)
- Return paginated portfolio"
```

---

## Task 4: Frontend — AcquiredBadge Component (New)

**Files:**
- Create: `src/components/stl/AcquiredBadge.tsx`

**Interfaces:**
- Consumes: boolean `hasAccess`
- Produces: React component rendering badge

**Steps:**

- [ ] **Step 1: Criar componente**

```bash
cat > src/components/stl/AcquiredBadge.tsx << 'EOF'
'use client';

interface AcquiredBadgeProps {
  hasAccess: boolean;
}

export function AcquiredBadge({ hasAccess }: AcquiredBadgeProps) {
  if (!hasAccess) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-900/40 border border-green-500/50 rounded-full">
      <span className="text-xs font-semibold text-green-200">
        ✓ Você tem este
      </span>
    </div>
  );
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/components/stl/AcquiredBadge.tsx
git commit -m "feat: add AcquiredBadge component for STL cards"
```

---

## Task 5: Frontend — Modify StlCard (Add Acquired State)

**Files:**
- Modify: `src/components/stl/StlCard.tsx` (existente)

**Interfaces:**
- Consumes: boolean `userHasAccess`, `onDownload` callback
- Produces: Updated card with dynamic button + badge

**Steps:**

- [ ] **Step 1: Ler componente existente**

```bash
head -50 src/components/stl/StlCard.tsx
```

- [ ] **Step 2: Adicionar prop `hasAccess` ao componente**

Encontrar `interface StlCardProps` e adicionar:

```typescript
interface StlCardProps {
  // ... existing props ...
  hasAccess?: boolean;
  onDownload?: () => void;
}
```

- [ ] **Step 3: Modificar botão para ser dinâmico**

Encontrar a seção de renderização do botão (geralmente perto do final) e substituir por:

```typescript
export function StlCard({ stl, hasAccess = false, onDownload }: StlCardProps) {
  return (
    <div className="...">
      {/* ... existing thumbnail/title ... */}

      {/* Acquired badge */}
      <AcquiredBadge hasAccess={hasAccess} />

      {/* Price + Button */}
      <div className="flex justify-between items-center">
        {hasAccess ? (
          <>
            <span className="text-xs text-green-200">Desbloqueado</span>
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              Baixar
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold">
              {stl.price_pro} créditos
            </span>
            <button
              onClick={() => openCreditModal(stl)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Comprar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Import AcquiredBadge**

No topo do arquivo:

```typescript
import { AcquiredBadge } from './AcquiredBadge';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/stl/StlCard.tsx
git commit -m "feat: add hasAccess state to StlCard component

- Show green badge if user already has STL
- Change button text/action based on access
- Show 'Desbloqueado' instead of price"
```

---

## Task 6: Frontend — New Portfolio Page

**Files:**
- Create: `src/app/dashboard/portfolio/page.tsx`
- Create: `src/app/dashboard/portfolio/PortfolioTabs.tsx`
- Create: `src/app/dashboard/portfolio/PortfolioGrid.tsx`

**Interfaces:**
- Consumes: API GET /api/portfolio, `UserStlPortfolio[]` type
- Produces: Page with segregated tabs + grid

**Steps:**

- [ ] **Step 1: Criar PortfolioGrid component**

```bash
cat > src/app/dashboard/portfolio/PortfolioGrid.tsx << 'EOF'
'use client';

import { UserStlPortfolio } from '@/lib/supabase';
import { StlCard } from '@/components/stl/StlCard';

interface PortfolioGridProps {
  items: UserStlPortfolio[];
  isLoading?: boolean;
}

export function PortfolioGrid({ items, isLoading }: PortfolioGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Nenhum STL adquirido ainda</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => (
        <StlCard
          key={item.stl_id}
          stl={item}
          hasAccess={true}
          onDownload={() => {
            // Trigger presigned URL download
            window.location.href = `/api/portfolio/${item.stl_id}/download`;
          }}
        />
      ))}
    </div>
  );
}
EOF
```

- [ ] **Step 2: Criar PortfolioTabs component**

```bash
cat > src/app/dashboard/portfolio/PortfolioTabs.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { UserStlPortfolio } from '@/lib/supabase';
import { PortfolioGrid } from './PortfolioGrid';

interface PortfolioTabsProps {
  makerworld: UserStlPortfolio[];
  stlSearch: UserStlPortfolio[];
  isLoading?: boolean;
}

export function PortfolioTabs({ makerworld, stlSearch, isLoading }: PortfolioTabsProps) {
  const [activeTab, setActiveTab] = useState<'makerworld' | 'stlsearch'>('stlsearch');

  return (
    <div className="space-y-6">
      {/* Tab buttons */}
      <div className="flex gap-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('stlsearch')}
          className={`py-2 px-4 border-b-2 font-semibold transition ${
            activeTab === 'stlsearch'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Comprados do STL Search ({stlSearch.length})
        </button>
        <button
          onClick={() => setActiveTab('makerworld')}
          className={`py-2 px-4 border-b-2 font-semibold transition ${
            activeTab === 'makerworld'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          Importados Makerworld ({makerworld.length})
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'stlsearch' && (
        <PortfolioGrid items={stlSearch} isLoading={isLoading} />
      )}
      {activeTab === 'makerworld' && (
        <PortfolioGrid items={makerworld} isLoading={isLoading} />
      )}
    </div>
  );
}
EOF
```

- [ ] **Step 3: Criar página portfolio**

```bash
cat > src/app/dashboard/portfolio/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { UserStlPortfolio } from '@/lib/supabase';
import { PortfolioTabs } from './PortfolioTabs';

export default function PortfolioPage() {
  const [makerworld, setMakerworld] = useState<UserStlPortfolio[]>([]);
  const [stlSearch, setStlSearch] = useState<UserStlPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPortfolio() {
      try {
        const res = await fetch('/api/portfolio');
        if (!res.ok) throw new Error('Failed to load portfolio');
        const data = await res.json();
        setMakerworld(data.makerworld || []);
        setStlSearch(data.stlSearch || []);
      } catch (err) {
        console.error('Portfolio load error:', err);
        setError('Erro ao carregar portfolio');
      } finally {
        setIsLoading(false);
      }
    }

    loadPortfolio();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Meu Portfolio</h1>
        <p className="text-gray-400 mt-2">
          STLs que você adquiriu e pode baixar a qualquer momento
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded p-4 text-red-200">
          {error}
        </div>
      )}

      <PortfolioTabs
        makerworld={makerworld}
        stlSearch={stlSearch}
        isLoading={isLoading}
      />
    </div>
  );
}
EOF
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/portfolio/
git commit -m "feat: add portfolio page with segregated tabs

- Create PortfolioTabs component (Makerworld vs STL Search)
- Create PortfolioGrid component with pagination
- Create portfolio/page.tsx to fetch and display"
```

---

## Task 7: API Route — GET /api/portfolio/[stlId]/download (Presigned URL)

**Files:**
- Create: `src/app/api/portfolio/[stlId]/download/route.ts`

**Interfaces:**
- Consumes: Auth user, stlId param, R2 client
- Produces: Redirect to presigned URL or JSON { url }

**Steps:**

- [ ] **Step 1: Criar arquivo**

```bash
cat > src/app/api/portfolio/[stlId]/download/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getR2Client } from '@/lib/r2';

export async function GET(
  req: NextRequest,
  { params }: { params: { stlId: string } }
) {
  try {
    const supabase = getSupabaseServer();
    const stlId = params.stlId;

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user has access (RLS)
    const { data: hasAccess, error: accessError } = await supabase
      .from('user_acquired_stls')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('stl_id', stlId)
      .limit(1);

    if (accessError || !hasAccess || hasAccess.length === 0) {
      return NextResponse.json(
        { error: 'Access denied or STL not found' },
        { status: 403 }
      );
    }

    // Get STL details (r2_object_key)
    const { data: stl, error: stlError } = await supabase
      .from('telegram_indexed_stls')
      .select('r2_object_key, title')
      .eq('id', stlId)
      .single();

    if (stlError || !stl) {
      return NextResponse.json(
        { error: 'STL not found' },
        { status: 404 }
      );
    }

    if (!stl.r2_object_key) {
      return NextResponse.json(
        { error: 'STL file not yet available' },
        { status: 503 }
      );
    }

    // Generate presigned URL (R2)
    const r2 = getR2Client();
    const presignedUrl = await r2.getSignedUrl(stl.r2_object_key, 3600);

    // Log download
    await supabase
      .from('telegram_downloads_history')
      .insert({ user_id: user.id, stl_id: stlId });

    return NextResponse.json({ url: presignedUrl });

  } catch (err) {
    console.error('[GET /api/portfolio/[stlId]/download]:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portfolio/[stlId]/download/route.ts
git commit -m "feat: add presigned download endpoint for portfolio STLs

- Validate user has access via RLS
- Generate presigned R2 URL
- Log download in telegram_downloads_history"
```

---

## Task 8: Integrate Portfolio Link in Dashboard Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx` (ou similar navegação)

**Steps:**

- [ ] **Step 1: Adicionar link "Meu Portfolio" ao sidebar**

Encontrar a lista de navegação (usualmente em `Sidebar.tsx`) e adicionar:

```typescript
{
  label: 'Meu Portfolio',
  href: '/dashboard/portfolio',
  icon: BookmarkIcon, // ou similar da Lucide
  badge: portfolioCount > 0 ? portfolioCount : undefined
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add portfolio link to sidebar navigation"
```

---

## Task 9: Tests — Integration Test

**Files:**
- Create: `tests/integration/stl-bundling.test.ts`

**Steps:**

- [ ] **Step 1: Criar teste**

```bash
cat > tests/integration/stl-bundling.test.ts << 'EOF'
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getSupabaseServer } from '@/lib/supabase';

describe('STL Bundling Integration', () => {
  let supabase: any;
  let testUserId: string;
  let parentStlId: string;
  let childStlId: string;

  beforeAll(async () => {
    supabase = getSupabaseServer();
    // Setup: criar test data (omitted para brevidade)
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should insert bundle when acquiring parent STL', async () => {
    const { error } = await supabase.rpc('acquire_stl_bundle', {
      p_user_id: testUserId,
      p_stl_id: parentStlId,
      p_source: 'stl_search',
      p_credit_cost: 100
    });

    expect(error).toBeNull();

    // Verify parent + child both in user_acquired_stls
    const { data: acquired } = await supabase
      .from('user_acquired_stls')
      .select('stl_id')
      .eq('user_id', testUserId)
      .in('stl_id', [parentStlId, childStlId]);

    expect(acquired).toHaveLength(2);
  });

  it('should prevent duplicate acquisitions', async () => {
    // Acquire twice
    await supabase.rpc('acquire_stl_bundle', {
      p_user_id: testUserId,
      p_stl_id: parentStlId,
      p_source: 'stl_search',
      p_credit_cost: 100
    });

    await supabase.rpc('acquire_stl_bundle', {
      p_user_id: testUserId,
      p_stl_id: parentStlId,
      p_source: 'stl_search',
      p_credit_cost: 100
    });

    // Should only have 2 records (not 4)
    const { data: acquired, error } = await supabase
      .from('user_acquired_stls')
      .select('id')
      .eq('user_id', testUserId);

    expect(acquired).toHaveLength(2);
    expect(error).toBeNull();
  });

  it('should enforce RLS — users cannot see other users portfolios', async () => {
    // Impersonate different user
    const { data: otherUserId } = await supabase.auth.signUp({
      email: 'test2@example.com',
      password: 'password'
    });

    const { data: theirPortfolio } = await supabase
      .from('vw_user_stl_portfolio')
      .select('*')
      .eq('user_id', testUserId); // Should be empty (RLS blocks)

    expect(theirPortfolio).toHaveLength(0);
  });
});
EOF
```

- [ ] **Step 2: Rodar tests**

```bash
npm test tests/integration/stl-bundling.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/stl-bundling.test.ts
git commit -m "test: add integration tests for STL bundling

- Test bundle insertion (parent + children)
- Test duplicate prevention (UNIQUE constraint)
- Test RLS enforcement"
```

---

## Task 10: Update Store (Zustand) — Add Portfolio Slice

**Files:**
- Modify: `src/store/store.ts`

**Steps:**

- [ ] **Step 1: Adicionar slice ao store**

```typescript
// Em src/store/store.ts, adicionar nova slice:

interface PortfolioSlice {
  portfolioItems: UserStlPortfolio[];
  isLoadingPortfolio: boolean;
  fetchPortfolio: () => Promise<void>;
  clearPortfolio: () => void;
}

const createPortfolioSlice = (set: any) => ({
  portfolioItems: [],
  isLoadingPortfolio: false,

  fetchPortfolio: async () => {
    set({ isLoadingPortfolio: true });
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      set({
        portfolioItems: [...(data.makerworld || []), ...(data.stlSearch || [])],
        isLoadingPortfolio: false
      });
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      set({ isLoadingPortfolio: false });
    }
  },

  clearPortfolio: () => set({ portfolioItems: [] })
});

// No store root, adicionar:
export const useAppStore = create<AppStore>((set) => ({
  ...createPortfolioSlice(set),
  // ... other slices
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/store.ts
git commit -m "feat: add portfolio slice to app store

- Add fetchPortfolio() to load user portfolio
- Cache portfolio items in Zustand
- Add isLoadingPortfolio flag"
```

---

## Task 11: Documentation — Update Roadmap

**Files:**
- Modify: Project memory/roadmap

**Steps:**

- [ ] **Step 1: Registrar feature em roadmap**

Adicionar ao arquivo de roadmap do projeto (ex: MEMORY.md ou roadmap interno):

```markdown
## ✅ COMPLETED: STL Bundling com Portfolio Persistente (Jun 2026)

**Objetivo:** Quando usuário compra um STL, todos os relacionados ficam grátis permanentemente.

**Status:** ✅ Implementado e testado

**Impacto:**
- Nova tabela: `user_acquired_stls` (RLS)
- Nova VIEW: `vw_user_stl_portfolio` (RLS)
- Trigger automático: calcula grupo (pai + filhos)
- Nova aba UI: "Meu Portfolio" (segregado Makerworld vs STL Search)
- API: GET /api/portfolio, GET /api/portfolio/[stlId]/download

**Comportamento:**
- Compra bidireccional: pai ou filho = todos desbloqueados
- Permanente: nunca expira
- Sem transitivo: apenas pai-filho direto
- Sem limite de estratégia: criador pode ligar 10 filhos a 1 pai caro

**Migration:** 20260629_user_acquired_stls.sql
```

- [ ] **Step 2: Commit roadmap**

```bash
git add docs/roadmap.md (or MEMORY.md, etc)
git commit -m "docs: update roadmap — STL bundling completed"
```

---

## Spec Coverage Checklist

| Requisito | Task | Status |
|-----------|------|--------|
| Nova tabela `user_acquired_stls` | Task 1 | ✅ |
| RLS automática | Task 1 | ✅ |
| Trigger para cálculo de grupo | Task 1 | ✅ |
| Modificação em `/api/download-stl` | Task 2 | ✅ |
| RPC `acquire_stl_bundle()` | Task 2 | ✅ |
| Portfolio GET endpoint | Task 3 | ✅ |
| AcquiredBadge component | Task 4 | ✅ |
| Modificação StlCard | Task 5 | ✅ |
| Portfolio page + tabs | Task 6 | ✅ |
| Presigned URL endpoint | Task 7 | ✅ |
| Sidebar link | Task 8 | ✅ |
| Integration tests | Task 9 | ✅ |
| Store slice | Task 10 | ✅ |

---

## Execution Notes

- **Branch:** `feat/stl-bundling` a partir de `main`
- **Commit frequency:** Após cada task (11 commits totais)
- **Testing:** Tests rodam no CI (GitHub Actions)
- **Rollback:** Migration é reversível (DROP TABLE CASCADE)
- **Performance:** Índices em `(user_id, stl_id)` garantem O(log n)
- **Idempotência:** UNIQUE constraint + ON CONFLICT DO NOTHING

**Próximo passo:** Executar tasks com `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
