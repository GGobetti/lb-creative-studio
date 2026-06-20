# Backlog Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todos os itens pendentes do backlog: 2 cosméticos, 1 teaser de leaderboard, 1 archival de jobs no banco, 1 limpeza do store, e 1 onboarding tour guiado.

**Architecture:** 6 tarefas independentes sequenciadas do menor ao maior esforço. T1–T2 são edições pontuais em arquivos existentes. T3 extrai um novo componente `WeeklyLeaderboardTeaser`. T4 adiciona SQL direto via pg_cron para limpeza periódica da tabela `telegram_scraper_jobs` no Supabase. T5 remove código morto do store e renomeia o export. T6 adiciona coluna na tabela `profiles`, cria `OnboardingTour` com spotlight Framer Motion e monta no `DashboardLayout`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · TailwindCSS v4 · Framer Motion v12 · Supabase (PostgreSQL + Edge Functions) · Lucide React · Zustand v5

## Contexto Importante (atualizado 2026-06-20)

- **Scraper migrado:** O `telegram-scraper/` foi extraído para repositório próprio [`lb-creative-scrapper`](https://github.com/GGobetti/lb-creative-scrapper) e refatorado para CLI (`npm run scan`). Não existe mais Express server nem endpoints `/approve`, `/cancel`, `/retry` neste repo.
- **Impacto na Task 4:** A limpeza de `telegram_scraper_jobs` ainda é necessária pois a tabela vive no Supabase compartilhado. Porém, como o scraper agora roda sob demanda, jobs orphaned são menos frequentes — a prioridade de D6 é baixa.
- **Tasks pendentes verificadas:** T1 (blobs), T2 (emojis), T3 (leaderboard), T5 (rename store), T6 (onboarding) — nenhuma foi implementada ainda.

## Global Constraints

- Todas as cores devem usar os tokens do design system: primary = `#06B6D4` (cyan-500), accent = `#7C3AED` (violet-600)
- Ícones: Lucide React — nunca emojis em componentes novos
- Animações: Framer Motion — seguir padrões existentes (`initial/animate/transition`)
- Dark mode: Liquid Glass — usar `glass-panel`, `bg-white/X`, `border border-white/X`
- TypeScript estrito — sem `any` em código novo
- Commits frequentes por tarefa

---

## Task 1: Login blob — cyan (U5)

**Files:**
- Modify: `src/app/login/LoginPage.tsx:98-108`

**Interfaces:**
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Trocar as cores dos blobs**

Em `src/app/login/LoginPage.tsx`, localizar as 3 divs de blob (linhas 97-108) e atualizar:

```tsx
{/* Blob 1 — primary cyan (era violeta/indigo) */}
<div
  className="absolute -top-[20%] -left-[10%] w-[70%] h-[80%] animate-blob-1 rounded-full"
  style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.20) 0%, transparent 65%)' }}
/>
{/* Blob 2 — accent violet */}
<div
  className="absolute -bottom-[10%] -right-[10%] w-[55%] h-[70%] animate-blob-2 rounded-full"
  style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 65%)' }}
/>
{/* Blob 3 — pink accent (mantém) */}
<div
  className="absolute top-[35%] left-[35%] w-[40%] h-[45%] animate-blob-3 rounded-full"
  style={{ background: 'radial-gradient(ellipse, rgba(255,80,120,0.10) 0%, transparent 65%)' }}
/>
```

- [ ] **Step 2: Verificar visualmente (dev server)**

Abrir `http://localhost:3000/login` em dark mode e confirmar que o blob dominante é azul-cyan, não roxo.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/LoginPage.tsx
git commit -m "fix(ux): login blobs — primary cyan, accent violet (era indigo)"
```

---

## Task 2: Emoji → Lucide icons (U6)

**Files:**
- Modify: `src/components/games/GameHub.tsx`
- Modify: `src/components/games/shared/SessionResult.tsx`

**Interfaces:**
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Atualizar imports em `GameHub.tsx`**

Localizar a linha de import de Lucide (linha ~6):
```tsx
import { Zap, Flame, Camera, Tag, LayoutGrid, ShieldCheck } from 'lucide-react'
```
Adicionar `Award`, `Gem`, `Trophy`:
```tsx
import { Zap, Flame, Camera, Tag, LayoutGrid, ShieldCheck, Award, Gem, Trophy } from 'lucide-react'
```

- [ ] **Step 2: Substituir `badgeEmoji` dict por `BADGE_ICON` map**

Remover (linhas 107-112):
```tsx
const badgeEmoji: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎',
}
```

Substituir por (logo após as constantes `currentBadge`/`nextBadge`):
```tsx
const BADGE_ICONS: Record<string, { Icon: React.ElementType; className: string }> = {
  bronze:  { Icon: Award, className: 'text-amber-600' },
  silver:  { Icon: Award, className: 'text-slate-400' },
  gold:    { Icon: Award, className: 'text-yellow-400' },
  diamond: { Icon: Gem,   className: 'text-cyan-400'  },
}
```

- [ ] **Step 3: Atualizar uso do `badgeEmoji` no JSX**

Localizar a linha que usa `{badgeEmoji[nextBadge.tier]}` (linha ~216) e substituir por:

```tsx
{(() => {
  const b = BADGE_ICONS[nextBadge.tier]
  if (!b) return null
  const Icon = b.Icon
  return <Icon size={24} className={`${b.className} opacity-40`} />
})()}
```

- [ ] **Step 4: Remover emoji 🔥 do texto de streak**

Localizar linha ~140:
```tsx
🔥 Streak de {streak} {streak === 1 ? 'dia' : 'dias'}!
```
Trocar por (o ícone `<Flame>` já está no `<div>` pai na linha 137):
```tsx
Streak de {streak} {streak === 1 ? 'dia' : 'dias'}!
```

- [ ] **Step 5: Atualizar `SessionResult.tsx` — trocar `🏅` por `Award`**

Em `src/components/games/shared/SessionResult.tsx`, atualizar o import:
```tsx
import { Star, RotateCcw, LayoutGrid, Award } from 'lucide-react'
```

Substituir (linha ~16-23):
```tsx
<motion.div
  initial={{ scale: 0.5, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  className="text-6xl"
>
  🏅
</motion.div>
```

Por:
```tsx
<motion.div
  initial={{ scale: 0.5, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/20"
>
  <Award size={40} className="text-primary" />
</motion.div>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/games/GameHub.tsx src/components/games/shared/SessionResult.tsx
git commit -m "fix(ux): substituir emojis por Lucide icons em GameHub e SessionResult"
```

---

## Task 3: Leaderboard teaser honesto (U7)

**Files:**
- Create: `src/components/games/WeeklyLeaderboardTeaser.tsx`
- Modify: `src/components/games/GameHub.tsx`

**Interfaces:**
- Produces: `<WeeklyLeaderboardTeaser />` — componente sem props, busca os dados internamente

- [ ] **Step 1: Criar `WeeklyLeaderboardTeaser.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Trophy, Users } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

export function WeeklyLeaderboardTeaser() {
  const [activeCount, setActiveCount] = useState<number | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase
      .from('xp_transactions')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', new Date(
        Date.now() - ((new Date().getDay() || 7) - 1) * 86400000
      ).toISOString().split('T')[0])
      .then(({ data }) => {
        if (!data) return
        const unique = new Set(data.map((r: { user_id: string }) => r.user_id)).size
        setActiveCount(unique)
      })
  }, [])

  return (
    <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-2xl px-4 py-3">
      <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
        <Trophy size={18} className="text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Ranking Semanal</p>
        <p className="text-xs text-muted-foreground">
          {activeCount === null
            ? 'Carregando...'
            : `${activeCount} maker${activeCount !== 1 ? 's' : ''} ativo${activeCount !== 1 ? 's' : ''} essa semana`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Users size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Em breve</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Substituir o teaser estático em `GameHub.tsx`**

Adicionar import no topo de `GameHub.tsx`:
```tsx
import { WeeklyLeaderboardTeaser } from './WeeklyLeaderboardTeaser'
```

Localizar e remover (linhas ~225-230):
```tsx
{/* Leaderboard teaser */}
<div className="text-center py-2">
  <p className="text-xs text-muted-foreground">
    🏆 Leaderboard semanal em breve
  </p>
</div>
```

Substituir por:
```tsx
<WeeklyLeaderboardTeaser />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/games/WeeklyLeaderboardTeaser.tsx src/components/games/GameHub.tsx
git commit -m "feat(games): leaderboard teaser honesto com contagem real de makers ativos"
```

---

## Task 4: Archival de `telegram_scraper_jobs` (D6) — *Baixa prioridade*

> **Contexto atualizado:** O scraper virou CLI (`npm run scan`) e não roda 24/7 mais. Jobs orphaned são raros agora. Esta task ainda vale para evitar crescimento ilimitado da tabela ao longo do tempo, mas pode ser feita por último.

**Files:**
- Create: `supabase/migrations/20260620_cleanup_scraper_jobs_cron.sql`

**Interfaces:**
- Produces: cron job pg_cron que limpa jobs antigos diariamente às 02:00 UTC

> **Nota de plano:** O Free plan do Supabase **não tem pg_net** disponível. Portanto a abordagem correta é SQL direto via pg_cron, sem Edge Function.

- [ ] **Step 1: Verificar se pg_cron está disponível**

No Supabase Dashboard → SQL Editor:
```sql
select * from pg_extension where extname = 'pg_cron';
```
Expected: 1 row. Se vazio, habilitar em Database → Extensions → pg_cron.

- [ ] **Step 2: Criar migration**

Criar `supabase/migrations/20260620_cleanup_scraper_jobs_cron.sql`:

```sql
-- Habilitar pg_cron se ainda não estiver ativo
create extension if not exists pg_cron schema pg_catalog;

-- Remover agendamento anterior se existir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-scraper-jobs') then
    perform cron.unschedule('cleanup-scraper-jobs');
  end if;
end;
$$;

-- Agendar limpeza diária às 02:00 UTC — SQL direto (sem pg_net)
select cron.schedule(
  'cleanup-scraper-jobs',
  '0 2 * * *',
  $$
    delete from public.telegram_scraper_jobs
    where status in ('completed', 'failed', 'rejected')
    and created_at < now() - interval '30 days';
  $$
);
```

- [ ] **Step 3: Aplicar no Supabase Dashboard → SQL Editor**

Rodar o conteúdo da migration e verificar:
```sql
select jobname, schedule from cron.job where jobname = 'cleanup-scraper-jobs';
```
Expected: 1 row com `schedule = '0 2 * * *'`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620_cleanup_scraper_jobs_cron.sql
git commit -m "feat(infra): pg_cron cleanup diário de telegram_scraper_jobs (30d retention)"
```

---

## Task 5: Store cleanup — remover código morto + rename (S5)

**Files:**
- Modify: `src/store/store.ts`
- Modify: `src/lib/supabase.ts`
- Modify (rename import em 33 arquivos): todos os que importam `useConfiguratorStore`

**Interfaces:**
- Produces: `useAppStore` — mesma API do `useConfiguratorStore`, sem os slices mortos

Lista completa de arquivos a atualizar (além de `store.ts`):
```
src/app/dashboard/layout.tsx
src/app/dashboard/page.tsx
src/app/dashboard/customers/page.tsx
src/app/dashboard/tickets/page.tsx
src/app/dashboard/calculator/page.tsx
src/app/dashboard/admin/games/page.tsx
src/app/dashboard/admin/page.tsx
src/app/dashboard/stl-search/page.tsx
src/app/dashboard/quotations/page.tsx
src/app/dashboard/profile/page.tsx
src/app/dashboard/portfolio/PortfolioClient.tsx
src/app/dashboard/billing/page.tsx
src/app/dashboard/quotations/[id]/page.tsx
src/components/LanguageSwitcher.tsx
src/components/AuthProvider.tsx
src/components/Navbar.tsx
src/components/CreditModal.tsx
src/components/tickets/TicketDetailsModal.tsx
src/components/layout/DashboardSidebar.tsx
src/components/admin/TicketsTab.tsx
src/components/dashboard/MakerWorldImportModal.tsx
src/components/profile/XpRedeemCard.tsx
src/components/stl-search/StlDetailsModal.tsx
src/components/dashboard/SettingsManager.tsx
src/components/dashboard/PricingCalculator.tsx
src/components/games/QualityAudit.tsx
src/components/profile/XpTab.tsx
src/components/profile/XpChart.tsx
src/components/games/TagDetective.tsx
src/components/games/GameHub.tsx
src/components/games/PhotoMatch.tsx
src/components/games/CategorySort.tsx
src/hooks/useLogout.ts
src/lib/translations.ts
```

- [ ] **Step 1: Limpar `src/store/store.ts`**

**a) Atualizar comentário no topo (linha 3):**
```ts
// Slices: auth, catalog, ui, pricing, featureFlags, xp
```

**b) Remover o import de `ConfigState` (linha 9):**
```ts
// de:
import type { Profile, CatalogItem, ConfigState } from '@/lib/supabase'
// para:
import type { Profile, CatalogItem } from '@/lib/supabase'
```

**c) Remover `ParametricValues` export e `DEFAULT_PARAMETRIC` constant (linhas 35-108):**
Deletar todo o bloco:
```ts
export interface ParametricValues {
  // Text
  line1: string
  // ... (~73 linhas)
}

const DEFAULT_PARAMETRIC: ParametricValues = {
  // ... (~30 linhas)
}
```

**d) Remover `ParametricSlice` interface (linhas ~109-120):**
Deletar:
```ts
interface ParametricSlice {
  values: ParametricValues
  color: string
  preset: string
  uiMode: 'parametric' | 'image-to-3d'
  sidebarTab: 'design' | 'export' | 'materials'
  setValues: (v: Partial<ParametricValues>) => void
  setColor: (c: string) => void
  setPreset: (p: string) => void
  setUiMode: (m: 'parametric' | 'image-to-3d') => void
  setSidebarTab: (t: 'design' | 'export' | 'materials') => void
  toConfigState: () => ConfigState
}
```

**e) Remover `ImageToStlSlice` interface (linhas ~122-131):**
Deletar:
```ts
interface ImageToStlSlice {
  svgUrl: string | null
  isConverting: boolean
  setSvgUrl: (url: string | null) => void
  setIsConverting: (v: boolean) => void
}
```

**f) Remover `CatalogSlice` interface (linhas ~26-31):**
Deletar:
```ts
// ─── Catalog Slice ───────────────────────────────────────────────

interface CatalogSlice {
  currentItem: CatalogItem | null
  setCurrentItem: (item: CatalogItem | null) => void
}
```

**g) Atualizar `type Store` (linha ~211):**
```ts
// de:
type Store = AuthSlice & CatalogSlice & ParametricSlice & ImageToStlSlice & UiSlice & PricingSlice & FeatureFlagsSlice & XpSlice
// para:
type Store = AuthSlice & UiSlice & PricingSlice & FeatureFlagsSlice & XpSlice
```

**h) Remover implementações dos slices mortos dentro de `create()(...):`**
No corpo do create, remover todos os campos/métodos de:
- `CatalogSlice`: `currentItem: null`, `setCurrentItem: ...`
- `ParametricSlice`: `values: { ...DEFAULT_PARAMETRIC }`, `color: ...`, `preset: ...`, `uiMode: ...`, `sidebarTab: ...`, `setValues: ...`, `setColor: ...`, `setPreset: ...`, `setUiMode: ...`, `setSidebarTab: ...`, `toConfigState: ...`
- `ImageToStlSlice`: `svgUrl: null`, `isConverting: false`, `setSvgUrl: ...`, `setIsConverting: ...`

**i) Atualizar o bloco `persist` (perto do final) — remover `values` da lista de campos persistidos:**

Localizar:
```ts
partialize: (state) => ({
  language: state.language,
  // ... outros campos
  values: state.values,  // <- remover esta linha
```
Remover a linha `values: state.values`.

**j) Renomear o export:**
```ts
// de:
export const useConfiguratorStore = create<Store>()(
// para:
export const useAppStore = create<Store>()(
```

- [ ] **Step 2: Verificar que TypeScript compila sem erros**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: Erros de `useConfiguratorStore not found` nos 33 arquivos — isso é esperado. Se houver outros erros (campos que ainda são referenciados), corrigi-los antes de continuar.

- [ ] **Step 3: Atualizar todos os arquivos com find & replace**

```bash
# Substituir import e uso em todos os arquivos de uma vez
find "/Users/ggobetti/Projetos Pessoais/lb-creative-studio/src" -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '' 's/useConfiguratorStore/useAppStore/g' {} +
```

- [ ] **Step 4: Verificar que TypeScript compila sem erros**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: nenhum erro relacionado a `useConfiguratorStore` ou `useAppStore`. Se aparecerem erros de campos removidos (ex: `values`, `setValues`, `currentItem`), investigar qual arquivo ainda referencia e remover o uso.

- [ ] **Step 5: Limpar `src/lib/supabase.ts` — remover `ConfigState` e `CatalogItem` se desnecessários**

Verificar se `CatalogItem` ainda é usado:
```bash
grep -rn "CatalogItem" src/ --include="*.ts" --include="*.tsx" | grep -v "supabase.ts"
```

Se resultar em usos em `admin/page.tsx` e `CreditModal.tsx`, manter `CatalogItem`. Remover apenas `ConfigState` se não for mais referenciado:
```bash
grep -rn "ConfigState" src/ --include="*.ts" --include="*.tsx" | grep -v "supabase.ts"
```

Se não houver usos, remover de `src/lib/supabase.ts`:
```ts
// Remover:
export interface ConfigState {
  // ... bloco completo
}
// E o campo em CatalogItem:
config_state: ConfigState  // <- remover
```

- [ ] **Step 6: Commit**

```bash
git add src/store/store.ts src/lib/supabase.ts src/
git commit -m "refactor(store): remover slices mortos (parametric/imageToStl/catalog) + rename useConfiguratorStore → useAppStore"
```

---

## Task 6: Onboarding tour guiado (U2)

**Files:**
- Create: `supabase/migrations/20260619002000_onboarding_flag.sql`
- Modify: `src/lib/supabase.ts` — adicionar `onboarding_completed` ao tipo `Profile`
- Create: `src/components/onboarding/OnboardingTour.tsx`
- Modify: `src/app/dashboard/layout.tsx` — montar o tour
- Modify: `src/components/layout/DashboardSidebar.tsx` — adicionar `data-tour` nos links
- Modify: `src/app/dashboard/layout.tsx` — adicionar `data-tour` no header de créditos

**Interfaces:**
- Consumes: `profile.onboarding_completed: boolean` do store (`useAppStore`)
- Produces: `<OnboardingTour />` — sem props, lê do store e chama Supabase ao finalizar

### Sub-task 6.1 — Migration

- [ ] **Step 1: Criar migration**

Criar `supabase/migrations/20260619002000_onboarding_flag.sql`:

```sql
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

comment on column public.profiles.onboarding_completed
  is 'True após o usuário completar ou pular o tour de onboarding';
```

- [ ] **Step 2: Aplicar migration**

Via Supabase Dashboard → SQL Editor:
```sql
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
```

Verificar:
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'profiles' and column_name = 'onboarding_completed';
```
Expected: 1 row, `data_type = 'boolean'`, `column_default = 'false'`

### Sub-task 6.2 — TypeScript type

- [ ] **Step 3: Adicionar campo ao tipo `Profile` em `src/lib/supabase.ts`**

```ts
export interface Profile {
  id: string
  email: string
  role: 'user' | 'sysadmin'
  plan: 'free' | 'pro' | 'max'
  credits: number
  created_at: string
  updated_at: string
  full_name?: string | null
  avatar_url?: string | null
  address?: string | null
  language?: 'pt' | 'en' | 'es' | null
  onboarding_completed: boolean  // <- adicionar
}
```

### Sub-task 6.3 — data-tour attributes

Os atributos `data-tour` são usados pelo `OnboardingTour` para encontrar os elementos a destacar no DOM.

- [ ] **Step 4: Adicionar `data-tour="credits"` no header de créditos**

Em `src/app/dashboard/layout.tsx`, localizar o elemento que exibe o saldo de créditos (geralmente um botão/div com `{profile?.credits}` ou similar no header). Adicionar o atributo:

```tsx
// Exemplo: se for um botão de créditos no header
<button data-tour="credits" onClick={() => setCreditModalOpen(true)} ...>
  <Zap size={14} />
  {profile?.credits ?? 0} cr
</button>
```

- [ ] **Step 5: Adicionar `data-tour` nos links da sidebar**

Em `src/components/layout/DashboardSidebar.tsx`, localizar os links de navegação. Adicionar atributos nos itens do array `navGroups` ou diretamente no JSX renderizado dos links.

Localizar onde os links são renderizados (cerca da linha 240+) e adicionar o atributo `data-tour`:

```tsx
<Link
  href={item.href}
  data-tour={
    item.href === '/dashboard/stl-search' ? 'stl-search' :
    item.href === '/dashboard/games' ? 'games' :
    undefined
  }
  className={...}
>
```

- [ ] **Step 6: Adicionar `data-tour="profile"` no avatar/menu do usuário no header**

Em `src/app/dashboard/layout.tsx`, localizar o botão do menu do usuário (que abre dropdown com logout etc). Adicionar:

```tsx
<button data-tour="profile" onClick={() => setMenuOpen((v) => !v)} ...>
```

### Sub-task 6.4 — Componente OnboardingTour

- [ ] **Step 7: Criar `src/components/onboarding/OnboardingTour.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/store'
import { useShallow } from 'zustand/react/shallow'
import { getSupabaseBrowser } from '@/lib/supabase'

interface TourStep {
  target: string       // seletor data-tour="..."
  title: string
  description: string
  placement: 'bottom' | 'right' | 'left' | 'top'
}

const STEPS: TourStep[] = [
  {
    target: 'credits',
    title: 'Seu saldo de créditos',
    description: 'Cada download de STL gasta créditos. Ganhe mais jogando no Gaming Lab XP ou comprando pacotes.',
    placement: 'bottom',
  },
  {
    target: 'stl-search',
    title: 'Garimpo 3D',
    description: 'Explore milhares de arquivos STL extraídos de canais do Telegram. Filtre, favorite e baixe.',
    placement: 'right',
  },
  {
    target: 'games',
    title: 'Gaming Lab XP',
    description: 'Valide o catálogo jogando mini-games e ganhe créditos + XP por cada contribuição.',
    placement: 'right',
  },
  {
    target: 'profile',
    title: 'Seu perfil & XP',
    description: 'Acompanhe seu nível, badges conquistados e histórico de atividade.',
    placement: 'bottom',
  },
]

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const PAD = 8

export function OnboardingTour() {
  const { profile, setProfile } = useAppStore(
    useShallow((s) => ({ profile: s.profile, setProfile: s.setProfile }))
  )
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [visible, setVisible] = useState(false)

  const updateRect = useCallback(() => {
    const r = getTargetRect(STEPS[step]?.target ?? '')
    setRect(r)
  }, [step])

  useEffect(() => {
    if (!profile || profile.onboarding_completed) return
    // Pequeno delay para o DOM estar pronto
    const t = setTimeout(() => {
      updateRect()
      setVisible(true)
    }, 600)
    return () => clearTimeout(t)
  }, [profile, updateRect])

  useEffect(() => {
    updateRect()
  }, [step, updateRect])

  useEffect(() => {
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [updateRect])

  const markCompleted = useCallback(async () => {
    setVisible(false)
    if (!profile) return
    const supabase = getSupabaseBrowser()
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', profile.id)
    setProfile({ ...profile, onboarding_completed: true })
  }, [profile, setProfile])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      markCompleted()
    }
  }

  if (!profile || profile.onboarding_completed || !visible || !rect) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  // Posição do tooltip
  const tooltipStyle: React.CSSProperties = (() => {
    const margin = 14
    if (current.placement === 'right') {
      return { top: rect.top + rect.height / 2 - 70, left: rect.left + rect.width + margin }
    }
    if (current.placement === 'bottom') {
      return { top: rect.top + rect.height + margin, left: Math.max(12, rect.left - 60) }
    }
    if (current.placement === 'top') {
      return { top: rect.top - 160 - margin, left: Math.max(12, rect.left - 60) }
    }
    return { top: rect.top + rect.height / 2 - 70, left: rect.left - 300 - margin }
  })()

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Overlay escuro com buraco no elemento alvo */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${rect.width + PAD * 2}px ${rect.height + PAD * 2}px
                at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px,
                transparent 100%,
                rgba(0,0,0,0.72) 100%
              )`,
            }}
          />

          {/* Ring de destaque */}
          <motion.div
            key={`ring-${step}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[61] rounded-xl pointer-events-none"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: '0 0 0 2px rgba(6,182,212,0.8), 0 0 24px rgba(6,182,212,0.3)',
            }}
          />

          {/* Tooltip card */}
          <motion.div
            key={`tooltip-${step}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[62] w-72 bg-card border border-border rounded-2xl shadow-xl p-4 pointer-events-auto"
            style={tooltipStyle}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-foreground leading-snug">{current.title}</p>
              <button
                onClick={markCompleted}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Pular tour"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {current.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {isLast ? (
                  <>
                    Começar <CheckCircle2 size={14} />
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

### Sub-task 6.5 — Montar no DashboardLayout

- [ ] **Step 8: Adicionar `OnboardingTour` ao layout**

Em `src/app/dashboard/layout.tsx`, adicionar o import:
```tsx
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
```

Dentro do JSX do `DashboardLayout`, antes do `</div>` de fechamento do container principal, adicionar:
```tsx
<OnboardingTour />
```

- [ ] **Step 9: Verificar que `setProfile` existe no store**

Em `src/store/store.ts`, confirmar que `AuthSlice` expõe `setProfile`:
```ts
interface AuthSlice {
  // ...
  setProfile: (profile: Profile | null) => void  // deve existir
}
```
Se não existir, adicionar na interface e na implementação:
```ts
setProfile: (profile) => set((s) => { s.profile = profile }),
```

- [ ] **Step 10: Teste manual do fluxo**

1. Abrir o dashboard com um usuário que tem `onboarding_completed = false` (todos os usuários existentes, pois a migration usa `DEFAULT false`)
2. Verificar que o overlay aparece após ~600ms
3. Clicar "Próximo" 4 vezes e confirmar que cada passo destaca o elemento correto
4. Após o último passo, verificar no Supabase Dashboard que `profiles.onboarding_completed = true` para o usuário
5. Recarregar — o tour não deve aparecer novamente
6. Clicar "✕" (skip) — deve marcar como completo também

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260619002000_onboarding_flag.sql \
        src/lib/supabase.ts \
        src/components/onboarding/OnboardingTour.tsx \
        src/app/dashboard/layout.tsx \
        src/components/layout/DashboardSidebar.tsx
git commit -m "feat(ux): onboarding tour guiado 4 passos com spotlight Framer Motion"
```

---

## Self-Review (atualizado 2026-06-20)

**Status das tasks:**
| Task | Item | Status |
|------|------|--------|
| T1 | Login blobs cyan (U5) | ⏳ Pendente |
| T2 | Emoji → Lucide icons (U6) | ⏳ Pendente |
| T3 | Leaderboard teaser honesto (U7) | ⏳ Pendente |
| T4 | Archival telegram_scraper_jobs (D6) | ⏳ Pendente (baixa prioridade) |
| T5 | Store cleanup + rename (S5) | ⏳ Pendente — 35 arquivos ainda usam `useConfiguratorStore` |
| T6 | Onboarding tour guiado (U2) | ⏳ Pendente — `onboarding_completed` não existe ainda |

**Dependências entre tasks:**
- T5 (rename store) **deve ser executada antes de T6** — onboarding usa `useAppStore`
- T1, T2, T3, T4 são completamente independentes entre si

**Ordem recomendada:** T1 → T2 → T3 → T5 → T6 → T4 (T4 por último, menor urgência)

**Mudanças desde a criação do plano:**
- Scraper extraído para repo separado — referências a Express/endpoints removidas da Task 4
- Task 4 simplificada: só SQL direto via pg_cron (Free plan não tem pg_net)
