# LB Creative Studio — Deep Dive Completo
**Data:** Junho 2026  
**Escopo:** UI/UX · Código · Segurança · Banco de Dados · Arquitetura  
**Skills usadas:** `code-review` (max effort) · `supabase-postgres-best-practices` · `ui-ux-pro-max`  
**Agents executados:** Code Quality · Database/Supabase · Architecture & Store

---

## 0. Visão Geral do Sistema

O LB Creative Studio é uma **plataforma centralizada que atua como agregador inteligente de arquivos STL e hub de ferramentas utilitárias para a comunidade de impressão 3D (Makers) brasileira**. O ecossistema resolve três grandes dores do mercado: o alto custo e a dispersão de arquivos premium, a desorganização de arquivos compartilhados em comunidades e a dificuldade de precificação de peças impressas.

### 0.1 Modelo de Negócios e Monetização

Modelo **híbrido**:

- **Plano de Assinatura (Recorrente):** o usuário assina um plano mensal e recebe uma cota fixa de downloads de STLs por mês. Os créditos se renovam mensalmente.
- **Créditos Avulsos:** para quem atingiu o limite do plano ou prefere não assinar recorrência — pacotes de créditos comprados pontualmente.
- **Hub de Afiliados (Futuro):** seção dedicada à recomendação de insumos e hardware (filamentos, bicos, peças de reposição) com receita passiva via links de afiliados e cupons de desconto.

### 0.2 Motor de Gamificação e Curadoria por Crowdsourcing

Os arquivos STL são extraídos automaticamente de canais do Telegram via **crawler**. Como chegam desorganizados (nomes errados, categorias incorretas, imagens ausentes), o sistema usa **gamificação baseada em consenso** para limpeza dos dados:

- **O Jogo da Validação:** interface interativa onde usuários validam se a foto do arquivo está correta, se o nome condiz com a descrição e se a categoria do STL está adequada.
- **Recompensas Reais:** participação gera pontos, sobe de nível e desbloqueia badges. Pontos acumulados podem ser trocados por créditos reais para novos downloads.
- **Algoritmo de Consenso:**
  - **≥ 70% de convergência** → sistema aceita como verdade e atualiza o arquivo automaticamente.
  - **< 70%** → tarefa vai para a **fila de Curadoria Especial** no painel admin para validação manual.

### 0.3 Ferramenta de Atração Orgânica — Calculadora Maker + CRM

Principal funcionalidade **gratuita** para atração de tráfego orgânico e conversão em assinantes:

- **Importação Inteligente:** usuário insere link de uma peça (ex: MakerWorld) e a plataforma lê o perfil do modelo (tempo estimado, peso de filamento, etc.) preenchendo a calculadora automaticamente.
- **Precificação Descomplicada:** calcula o custo real de fabricação e sugere o preço de venda com base na margem de lucro desejada pelo maker.
- **CRM Integrado:** cadastro de clientes, geração de orçamentos profissionais e envio rápido via **WhatsApp** ou **E-mail**.

### 0.4 Painel Administrativo

Retaguarda operacional do negócio:

- **Fila e Score de Canais:** dashboard que monitora a fila de varredura dos canais do Telegram com métricas de ROI — quais canais trazem mais downloads e quais estão performando mal.
- **Central de Chamados (Suporte):** sistema de atendimento onde usuários abrem tickets para relatar problemas (arquivos corrompidos, modelos ausentes no catálogo).

---

## Sumário Executivo

O projeto está **sólido em UX visual** (design system bem construído, dark mode consistente, animações polidas) mas tem **problemas críticos de negócio** que devem ser resolvidos antes de qualquer tração paga real:

1. **Checkout com mock hardcoded** — qualquer usuário pode obter créditos e planos grátis
2. **Webhook Stripe sem idempotência** — pagamentos reais podem creditar 2–4x por retry automático do Stripe
3. **RLS desativado em `telegram_scraper_jobs`** — dados de moderação expostos a todos os usuários
4. **Créditos perdidos em download** — usuário paga 1 crédito mas pode não receber o arquivo

Fora dos blockers financeiros, há race conditions nos contadores de crédito, lógica de gamificação com falsos positivos (CategorySort com "resposta correta" aleatória, PhotoMatch que não diferencia Sim/Não), e sérios problemas de performance (SELECT * sem paginação em 10k+ STLs, admin com 3.044 linhas, ILIKE sem índice GIN).

---

## 1. Bugs Críticos — Segurança e Financeiro

### C1. Checkout Mock Hardcoded em Produção
**Arquivo:** [`src/app/api/checkout/route.ts:105`](src/app/api/checkout/route.ts)  
**Severidade:** BLOQUEANTE

```ts
const isMockMode = true; // Forçando mock como pedido
```

Qualquer usuário autenticado pode chamar `POST /api/checkout` com `{ itemId: 'pack_500', type: 'credits' }` e receber 500 créditos ou atualizar para qualquer plano sem pagar. O mock usa service role key diretamente, bypassa Stripe completamente e não registra transação real.

**Fix:**
```ts
const isMockMode = process.env.NODE_ENV === 'development' && process.env.STRIPE_MOCK === 'true'
```
**Nunca fazer deploy com `isMockMode = true`.**

---

### C2. Webhook Stripe sem Idempotência — Créditos Duplicados
**Arquivo:** [`src/app/api/webhooks/stripe/route.ts:43–91`](src/app/api/webhooks/stripe/route.ts)  
**Severidade:** BLOQUEANTE

Stripe garante entrega *at-least-once*, não *exactly-once*. O handler `checkout.session.completed` não verifica se `payment_intent_id` já foi processado. Em timeout ou resposta 5xx da sua API, o Stripe reenvia automaticamente — o usuário pode receber 2–4x os créditos pagos.

**Fix imediato (5 min — só SQL):**
```sql
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_intent_unique
  UNIQUE (payment_intent_id);
```

**Fix no código:**
```ts
case 'checkout.session.completed': {
  // Verificar idempotência ANTES de qualquer operação
  const { data: existing } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('payment_intent_id', session.payment_intent)
    .maybeSingle()
  
  if (existing) {
    console.log('Evento já processado, ignorando:', session.payment_intent)
    break
  }
  // ... resto do handler
}
```

---

### C3. Créditos Perdidos em Falha de Download
**Arquivo:** [`src/app/api/telegram/download/route.ts:43–133`](src/app/api/telegram/download/route.ts)  
**Severidade:** BLOQUEANTE

Créditos são debitados (linha 44) **antes** de tentar o download (linha 103). Se o proxy Telegram retornar 502 (serviço fora do ar), o usuário perde o crédito mas não recebe o arquivo. O próprio comentário do código reconhece: *"Mesmo se o download falhar, os créditos foram debitados."*

**Fix:**
1. Tentar o download **antes** de debitar créditos
2. Ou registrar uma "reserva" de crédito e só confirmar após sucesso
3. Mínimo aceitável: retornar erro 502 com mensagem específica para o usuário tentar de graça

---

### C4. `telegram_scraper_jobs` com RLS Desabilitado
**Arquivo:** [`supabase/migrations/20260615_telegram_scraper_jobs_disable_rls.sql`](supabase/migrations/20260615_telegram_scraper_jobs_disable_rls.sql)  
**Severidade:** BLOQUEANTE

```sql
alter table public.telegram_scraper_jobs disable row level security;
```

Aplicada como fix rápido de um bug de carregamento. Resultado: qualquer usuário autenticado pode consultar toda a fila de scraping via SDK, incluindo conteúdo aguardando moderação. A policy `is_admin()` já existia e estava correta — o bug original era que o frontend admin usava ANON key sem JWT.

**Fix:**
```sql
ALTER TABLE telegram_scraper_jobs ENABLE ROW LEVEL SECURITY;
-- As políticas is_admin() já existem, só reativar RLS
```

---

### C5. APIs sem Autenticação
**Arquivo:** [`src/app/api/telegram/banned-images/route.ts`](src/app/api/telegram/banned-images/route.ts) e [`src/app/api/telegram/progress/route.ts`](src/app/api/telegram/progress/route.ts)

- **GET /api/telegram/banned-images** — sem autenticação, retorna todos os hashes de moderação interna
- **POST /api/telegram/banned-images** — qualquer usuário logado pode adicionar hashes à blacklist (banir imagens legítimas)
- **GET /api/telegram/progress** — sem autenticação, expõe status de jobs do scraper

**Fix:** Adicionar verificação de `role === 'sysadmin'` nas 3 rotas.

---

### C6. Race Condition nos Créditos — Read-Modify-Write Não Atômico
**Arquivos:** [`src/app/api/webhooks/stripe/route.ts:68–70`](src/app/api/webhooks/stripe/route.ts) e [`src/app/api/telegram/download/route.ts:51–64`](src/app/api/telegram/download/route.ts)

```ts
// Padrão INSEGURO (em dois lugares):
const { data: profile } = await supabase.from('profiles').select('credits')...
await supabase.from('profiles').update({ credits: profile.credits + X })...
```

Dois requests concorrentes (dois webhooks, ou o fallback de download com RPC falhando) leem o mesmo saldo e sobrescrevem um ao outro.

**Fix:** Usar `UPDATE profiles SET credits = credits + X WHERE id = $userId` sem leitura prévia — ou criar a RPC `increment_credits(uid, amount)` que já existe como referência no código mas não é chamada consistentemente.

---

## 2. Bugs de Lógica — Gamificação

### G1. PhotoMatch: Ambos os Botões Fazem a Mesma Coisa
**Arquivo:** [`src/components/games/PhotoMatch.tsx:56–59`](src/components/games/PhotoMatch.tsx)

```tsx
// "Sim, confere" e "Não confere" chamam a MESMA função
const handleAnswer = useCallback(() => {
  if (!buttonsEnabled) return
  advance() // não diferencia a resposta
}, [buttonsEnabled, advance])
```

O campo `isMatch` existe no tipo `PhotoMatchQuestion` mas **nunca é verificado**. O jogo não sabe se o usuário acertou ou errou — apenas avança. Além disso, o PhotoMatch não chama nenhuma API: pontos são acumulados localmente e nunca registrados no banco.

---

### G2. CategorySort: "Resposta Correta" Aleatória
**Arquivo:** [`src/lib/gameDataLoader.ts:113`](src/lib/gameDataLoader.ts)

```ts
correctCategory: STL_CATEGORIES[Math.floor(Math.random() * STL_CATEGORIES.length)],
```

A categoria "correta" é gerada aleatoriamente no momento do carregamento. Não há ground truth real — o jogo está ensinando categorizações fictícias e coletando dados inválidos.

---

### G3. TagDetective: Tag "Fake" é String Aleatória Sem Sentido
**Arquivo:** [`src/lib/gameDataLoader.ts:79`](src/lib/gameDataLoader.ts)

```ts
const fakeTag = `#fake-tag-${Math.random().toString(36).slice(2, 9)}`
```

A tag inválida gerada é algo como `#fake-tag-x4k9p2z` — completamente sem sentido no contexto de uma peça 3D. Um usuário real nunca veria isso como "suspeito" com base no conteúdo.

---

### G4. QualityAudit: `shouldApprove` por Índice Posicional
**Arquivo:** [`src/lib/gameDataLoader.ts:147`](src/lib/gameDataLoader.ts)

```ts
shouldApprove: i % 4 !== 0, // 75% aprovados, 25% rejeitados — arbitrariamente
```

Se o usuário aprova um STL que o sistema marcou como `shouldApprove: false` (porque `i = 0, 4, 8...`), o sistema considera "errou" — mas o critério é posicional, não de qualidade real.

---

### G5. `game_type` Controlado pelo Cliente
**Arquivo:** [`src/app/api/games/audit-vote/route.ts:18`](src/app/api/games/audit-vote/route.ts)

```ts
const { stl_id, approved, rejection_reason, game_type = 'quality-audit' } = await request.json()
```

Usuário pode enviar `game_type: 'category-sort'` (25 créditos por ação) em vez de `'quality-audit'` (15 créditos) e inflar ganhos.

**Fix:**
```ts
const VALID_GAME_TYPES = ['quality-audit', 'photo-match', 'tag-detective', 'category-sort']
if (!VALID_GAME_TYPES.includes(game_type)) {
  return NextResponse.json({ error: 'Invalid game type' }, { status: 400 })
}
```

---

## 3. Banco de Dados e Performance

### D1. STL Search: SELECT * sem Paginação
**Arquivo:** [`src/app/dashboard/stl-search/page.tsx:116–166`](src/app/dashboard/stl-search/page.tsx)

```ts
let query = supabase.from("telegram_indexed_stls").select("*")
// Sem .limit() — retorna TODOS os registros
```

Com 10k STLs: ~8MB de JSON por request, full table scan, filtragem de `parent_id` em JavaScript pós-fetch. O sistema vai travar.

**Fix:**
```ts
// Mover filtro para o banco:
query = query.is('parent_id', null).range(page * 50, (page + 1) * 50 - 1)
```

---

### D2. Busca com ILIKE sem Índice Full-Text
**Arquivo:** [`src/app/dashboard/stl-search/page.tsx:123`](src/app/dashboard/stl-search/page.tsx)

```ts
query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
```

`ILIKE` com wildcard à esquerda (`%termo%`) não usa B-tree index — faz sequential scan a cada keystroke (debounce 300ms). Com 50 usuários buscando simultaneamente = 50 full scans paralelos.

**Fix — Full-Text Search:**
```sql
ALTER TABLE telegram_indexed_stls
  ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(description,''))
  ) STORED;
CREATE INDEX telegram_indexed_stls_tsv_idx ON telegram_indexed_stls USING GIN(tsv);
```
```ts
// Query:
query.textSearch('tsv', term, { type: 'plain', config: 'portuguese' })
```

---

### D3. `record_game_action`: Race Condition no Contador Diário
**Arquivo:** `supabase/migrations/20260617_games_daily_limits.sql:186–210`

A função PL/pgSQL lê `total_actions` em variável local, incrementa, faz upsert com valor calculado. Dois votos simultâneos leem `total_actions = 0` e ambos escrevem `1` — um incremento se perde.

**Fix — expressão atômica no ON CONFLICT:**
```sql
ON CONFLICT (user_id, activity_date) DO UPDATE SET
  total_actions = game_daily_activity.total_actions + 1,  -- atômico
  ...
```

---

### D4. `download_count` Não-Atômico
**Arquivo:** [`src/app/api/telegram/download/route.ts:82`](src/app/api/telegram/download/route.ts)

```ts
.update({ download_count: (item.download_count || 0) + 1 })
// item foi lido 60 linhas antes — dois downloads simultâneos do mesmo STL perdem 1 incremento
```

**Fix:** `UPDATE telegram_indexed_stls SET download_count = download_count + 1 WHERE id = $id`

---

### D5. `transactions` sem Índice — Dashboard Lento em Escala
**Schema:** `supabase/schema.sql`

Tabela append-only que nunca é deletada. Sem índice em `(user_id, created_at)`, as queries de histórico fazem sequential scan. Em 1 ano com 1000 usuários ativos = ~600k linhas.

```sql
CREATE INDEX transactions_user_date_idx ON transactions (user_id, created_at DESC);
```

---

### D6. `telegram_scraper_jobs` sem Archival Strategy

Tabela acumula jobs completed/failed/rejected indefinidamente. Com múltiplos grupos Telegram monitorados, vai acumular dezenas de milhares de linhas em semanas.

```sql
-- Usando pg_cron (disponível no Supabase Pro):
SELECT cron.schedule('cleanup-old-jobs', '0 2 * * *', $$
  DELETE FROM telegram_scraper_jobs
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed', 'rejected');
$$);
```

---

### D7. N+1 de PerceptualHash no Admin
**Arquivo:** [`src/app/dashboard/admin/page.tsx:130–181`](src/app/dashboard/admin/page.tsx)

```ts
for (const url of job.photos) {
  const hash = await getPerceptualHash(url) // fetch sequencial por imagem
}
// 300 jobs × 3 fotos = 900 fetches sequenciais no main thread
```

**Fix:** `Promise.allSettled(job.photos.map(url => getPerceptualHash(url)))`

---

### D8. `invoice.paid` não Implementado — Renovações Sem Créditos
**Arquivo:** [`src/app/api/webhooks/stripe/route.ts:95–103`](src/app/api/webhooks/stripe/route.ts)

```ts
case 'invoice.paid': {
  // TODO: Precisaríamos ter salvo o stripe_customer_id na tabela profiles.
  console.log("Invoice paid:", invoice.id) // nada acontece
  break
}
```

Assinantes Pro que renovam mensalmente **não recebem os 100 créditos mensais** automaticamente.

**Fix:**
```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
CREATE UNIQUE INDEX ON profiles (stripe_customer_id);
```
Salvar `stripe_customer_id` em `checkout.session.completed` e implementar o handler `invoice.paid`.

---

### D9. Admin com Polling — Usar Supabase Realtime
**Arquivo:** [`src/app/dashboard/admin/page.tsx:752–758`](src/app/dashboard/admin/page.tsx)

```ts
const interval = setInterval(() => {
  fetchScraperJobs() // query completa a cada 30s
}, 30000)
```

10 admins conectados = 10 queries simultâneas a cada 30s. Supabase Realtime eliminaria completamente o polling e daria atualizações em tempo real.

---

## 4. Arquitetura e Qualidade de Código

### A1. Store Zustand Monolítico sem Selectors
**Arquivo:** [`src/store/store.ts`](src/store/store.ts) — 385 linhas, 7 slices

**Problema de nome:** `useConfiguratorStore` (herdado do MVP de configurador 3D) hoje carrega `profile`, `credits`, `featureFlags`, `language`, `pricingSettings` — domínios completamente diferentes.

**Problema de performance:** Nenhum componente usa selectors. `useConfiguratorStore()` sem selector re-renderiza o componente em *qualquer* mudança do store inteiro.

```tsx
// ❌ Atual — re-renderiza quando QUALQUER slice muda:
const { logout, isFeatureEnabled, profile } = useConfiguratorStore()

// ✅ Correto:
const profile = useConfiguratorStore((s) => s.profile)
// Ou com múltiplos campos:
import { useShallow } from 'zustand/react/shallow'
const { profile, creditModalOpen } = useConfiguratorStore(
  useShallow((s) => ({ profile: s.profile, creditModalOpen: s.creditModalOpen }))
)
```

**Refactor a médio prazo:** Separar em 3 stores:
```
src/store/
  authStore.ts      # user, profile, language, credits, featureFlags
  parametricStore.ts # values, color, preset, uiMode, sidebarTab
  pricingStore.ts   # pricingSettings
```

---

### A2. AdminPage: 3.044 Linhas em Um Componente
**Arquivo:** [`src/app/dashboard/admin/page.tsx`](src/app/dashboard/admin/page.tsx)

25+ estados locais, 8 tabs com toda lógica inline, `any[]` em 25 lugares. O padrão `TicketsTab.tsx` já existe como template — aplicar ao resto:

```
src/components/admin/
  ScraperTab.tsx      # estado e lógica do scraper
  AnalyticsTab.tsx    # analytics
  FlagsTab.tsx        # feature flags
  AcervoTab.tsx       # moderação de acervo
  UsersTab.tsx        # gestão de usuários
  TicketsTab.tsx      # já existe ✓
```

---

### A3. AuthProvider: Risco de Ciclo com `pricingSettings`
**Arquivo:** [`src/components/AuthProvider.tsx:128`](src/components/AuthProvider.tsx)

```tsx
}, [user?.id, setProfile, setPricingSettings, pricingSettings])
//                                             ^^^^^^^^^^^^^^
// pricingSettings é objeto — cada setPricingSettings cria nova referência → loop
```

`setPricingSettings(data)` → store cria novo objeto → `pricingSettings` muda → useEffect dispara → busca profile novamente → ...

**Fix:** Remover `pricingSettings` do dep array e usar `useConfiguratorStore.getState().pricingSettings` dentro do callback quando precisar do valor pontual.

---

### A4. Arquivos Gigantes para Refatorar

| Arquivo | Linhas | Problema |
|---------|--------|---------|
| [`admin/page.tsx`](src/app/dashboard/admin/page.tsx) | 3.044 | Ver A2 acima |
| [`portfolio/PortfolioClient.tsx`](src/app/dashboard/portfolio/PortfolioClient.tsx) | 1.260 | 27 useState/useEffect em um arquivo |
| [`stl-search/page.tsx`](src/app/dashboard/stl-search/page.tsx) | 872 | Mapeamento de `StlItem` triplicado (linhas 139, 189, 362) |
| [`PricingCalculator.tsx`](src/components/dashboard/PricingCalculator.tsx) | 642 | 2 modals inline |

---

### A5. Dependências com Problema

| Item | Problema | Fix |
|------|---------|-----|
| `three` | Usado em `stl-exporter.ts` mas ausente de `dependencies` (só `@types/three` em dev) | Adicionar `three` em `dependencies` |
| `potrace` | Em `package.json` mas não importado em nenhum arquivo `src/` | Remover `potrace` e `@types/potrace` |
| `imagetracerjs` | Usado em `image-to-svg.ts` | Manter |

> **Nota:** Há um chip de tarefa para o `three` já criado pelo agent de arquitetura.

---

### A6. `alert()` Nativo em 6+ Lugares
**Arquivo:** [`src/app/dashboard/stl-search/page.tsx:239,248,292,397,413,497`](src/app/dashboard/stl-search/page.tsx)

`window.alert()` bloqueia a thread, não segue o design system, não é acessível. O projeto já tem `useToast()` em `src/components/ui/Toast.tsx` — substituir todos.

---

### A7. Logout Duplicado
**Arquivos:** [`src/app/dashboard/layout.tsx:48`](src/app/dashboard/layout.tsx) e [`src/components/layout/DashboardSidebar.tsx:79`](src/components/layout/DashboardSidebar.tsx)

Lógica idêntica em dois lugares. Extrair `src/hooks/useLogout.ts`.

---

### A8. Outros Problemas Menores

- **`useTranslation` em `src/lib/`** — React hook deve estar em `src/hooks/`, não `src/lib/`
- **`icon: any` no DashboardSidebar:97** — usar `LucideIcon` do pacote `lucide-react`
- **`getSupabaseAdmin()` sem singleton** — cria novo cliente a cada chamada (overhead desnecessário)
- **`isFeatureEnabled` defaults to `true`** — flags desconhecidas permitem acesso. Preferir `flags[key] === true`
- **`getSupabaseBrowser()` limpa localStorage** a cada primeira chamada por aba — risco de interferir com PKCE em outras abas
- **`src/app/dashboard/settings/page.tsx`** — exporta `metadata` sendo Server Component: correto. Mas verificar que `billing/page.tsx` com `"use client"` + `export const metadata` está perdendo o SEO silenciosamente

---

## 5. UI/UX — Gaps Priorizados

Análise completa com 38 gaps foi entregue como widget interativo na sessão anterior. Abaixo os mais críticos:

### U1. 6x `alert()` na Busca de STL
Já listado em A6 — bloqueia thread, quebra a UX durante downloads e favoritos.

### U2. Onboarding Ausente
Novos usuários chegam direto no dashboard sem contexto. Sem tour, sem tooltip, sem estado vazio orientativo. Alta taxa de churn provável.

### U3. Feedback de Download Fraco
O download toca a thread principal com `alert("Download iniciado!")`. Substituir por toast + barra de progresso (crédito debitado → arquivo sendo baixado → concluído).

### U4. Sem "Esqueci minha senha"
**Arquivo:** [`src/app/login/LoginPage.tsx`](src/app/login/LoginPage.tsx)

`supabase.auth.resetPasswordForEmail` não é chamado em nenhum lugar do projeto. Link ausente na tela de login.

### U5. Dot grid no Login com Cor Incorreta
**Arquivo:** [`src/app/login/LoginPage.tsx`](src/app/login/LoginPage.tsx)

Background com `indigo` — não atualizado para `cyan` (#06B6D4) do design system atual.

### U6. Emojis Misturados com Lucide Icons
**Arquivos:** `dashboard/page.tsx` (👋, ⚙️) · `GameHub.tsx` (🏆, 🔥, 🥉, 🥈, 🥇, 💎) · `SessionResult.tsx` (🏅)

Design system usa Lucide SVG — emojis são inconsistentes e não respeitam tema/contraste.

### U7. Leaderboard como Teaser Morto
**Arquivo:** [`src/components/games/GameHub.tsx:226`](src/components/games/GameHub.tsx)

```tsx
<p className="text-xs text-muted-foreground">🏆 Leaderboard semanal em breve</p>
```

Texto estático sem link, sem data, sem progresso. Remove engajamento.

### U8. `credits` Exibido como Badge sem Contexto de Custo
Usuários não sabem quanto custa cada download até tentar baixar. Exibir custo no card do STL reduz surpresa no momento do download.

---

## 6. Matriz de Severidade Consolidada

> **Última atualização:** Jun/2026 — Sprint 0–3 executado. Itens ✅ concluídos.

| ID | Área | Problema | Severidade | Status |
|----|------|---------|-----------|--------|
| C1 | Financeiro | Checkout mock hardcoded | 🔴 BLOQUEANTE | ✅ Concluído |
| C2 | Financeiro | Webhook sem idempotência | 🔴 BLOQUEANTE | ✅ Concluído |
| C3 | Financeiro | Créditos perdidos em download | 🔴 BLOQUEANTE | ✅ Concluído |
| C4 | Segurança | RLS desabilitado em scraper_jobs | 🔴 BLOQUEANTE | ✅ Concluído |
| C5 | Segurança | APIs sem autenticação | 🔴 BLOQUEANTE | ✅ Concluído |
| C6 | Dados | Race condition em créditos | 🔴 CRÍTICO | ✅ Concluído |
| D1 | Performance | SELECT * sem paginação | 🟠 ALTO | ✅ Concluído |
| D2 | Performance | ILIKE sem GIN index | 🟠 ALTO | ✅ Concluído (tsv + GIN na migration) |
| D8 | Financeiro | invoice.paid não implementado | 🟠 ALTO | ✅ Concluído |
| G1 | Produto | PhotoMatch sem diferenciação de resposta | 🟠 ALTO | ⏳ Pendente |
| G2 | Produto | CategorySort com resposta aleatória | 🟠 ALTO | ⏳ Pendente |
| G5 | Segurança | game_type controlado pelo cliente | 🟠 ALTO | ✅ Concluído |
| A1 | Arquitetura | Store sem selectors → re-renders | 🟡 MÉDIO | ✅ Concluído |
| A2 | Manutenção | AdminPage 3.044 linhas | 🟡 MÉDIO | ✅ Concluído (886 linhas + ScraperTab + AcervoTab) |
| A3 | Bug | AuthProvider ciclo potencial | 🟡 MÉDIO | ✅ Concluído |
| D3 | DB | Race condition em game counter | 🟡 MÉDIO | ✅ Concluído (FOR UPDATE na RPC) |
| D4 | DB | download_count não-atômico | 🟡 MÉDIO | ✅ Concluído (RPC increment_download_count) |
| D5 | Performance | Falta índice em transactions | 🟡 MÉDIO | ✅ Concluído (migration aplicada) |
| A6 | UX | 6+ alert() nativos | 🟡 MÉDIO | ✅ Concluído |
| U4 | UX | Sem "Esqueci senha" | 🟡 MÉDIO | ✅ Concluído |
| A5 | Deps | `three`/`potrace` em package.json | 🟢 BAIXO | ✅ Concluído |
| A7 | Arquitetura | Logout duplicado | 🟢 BAIXO | ✅ Concluído (useLogout hook) |
| D6 | Infra | scraper_jobs sem archival | 🟢 BAIXO | ⚠️ Parcial (pg_cron não disponível no Free) |
| D9 | Performance | Polling → Realtime | 🟢 BAIXO | ✅ Concluído (ScraperTab + Sidebar usam Realtime) |
| U2 | Produto | Onboarding ausente | 🟢 BAIXO | ⏳ Pendente |

---

## 7. Roadmap de Execução

> **Status Jun/2026:** Sprints 0–3 concluídos. Itens restantes abaixo.

### ✅ Sprint 0 — Blockers Financeiros — CONCLUÍDO

1. ✅ `isMockMode` gated por `process.env.STRIPE_MOCK`
2. ✅ UNIQUE em `transactions.payment_intent_id` (migration aplicada)
3. ✅ Idempotência no webhook
4. ✅ RLS reativado em `telegram_scraper_jobs`
5. ✅ Autenticação nas rotas `banned-images` e `progress`
6. ✅ Download tenta proxy antes de debitar créditos

### ✅ Sprint 1 — Performance e Estabilidade — CONCLUÍDO

7. ✅ Paginação na STL search + filtro `parent_id` no DB
8. ✅ GIN index para full-text search (`tsv` gerado + índice GIN, migration aplicada)
9. ✅ Índice em `transactions(user_id, created_at)` (migration aplicada)
10. ✅ RPCs atômicas: `increment_credits_for_user`, `increment_download_count`, `record_game_action` com FOR UPDATE
11. ✅ `game_type` validado no servidor
12. ✅ `alert()` substituído por `useToast()`

### ✅ Sprint 2 — Produto e UX — CONCLUÍDO (parcial)

13. ⏳ **PhotoMatch: diferenciar Sim/Não** e registrar no banco — 2h
14. ⏳ **CategorySort: ground truth real** (ou remover scoring por enquanto) — 4h
15. ⏳ **TagDetective: fake tags do vocabulário real** do STL 3D — 4h
16. ✅ `invoice.paid`: `stripe_customer_id` salvo + renovação Pro creditada
17. ✅ "Esqueci senha" na tela de login

### ✅ Sprint 3 — Arquitetura — CONCLUÍDO

18. ✅ Selectors no Zustand (`useShallow`) em todos os componentes
19. ✅ AdminPage → `ScraperTab` + `AcervoTab` + `AnalyticsTab` + `FlagsTab` (886 linhas)
20. ✅ Deps: `potrace` removido, `three` em dependencies
21. ✅ `useLogout` hook extraído (logout duplicado removido)
22. ✅ Supabase Realtime no admin (`ScraperTab` + `DashboardSidebar`)
23. ⚠️ Archival de `telegram_scraper_jobs` — pg_cron não disponível no Free; fazer manualmente ou upgrade

### 🔜 Próximos Passos (Sprint 4)

**Gamificação — Ground Truth Real:**
- G1: PhotoMatch — diferenciar Sim/Não e registrar acerto/erro no banco
- G2: CategorySort — usar categorias reais dos STLs (campo `category` já existe na tabela)
- G3: TagDetective — gerar fake tags do vocabulário STL 3D (não strings aleatórias)

**Produto:**
- U2: Onboarding para novos usuários (tour/tooltip/estado vazio)
- U5: Atualizar dot grid do Login de `indigo` para `cyan` (#06B6D4)
- U6: Substituir emojis por Lucide icons no GameHub/SessionResult
- U7: Leaderboard semanal real (ou remover o teaser morto)

**Infra:**
- D6: Archival de `telegram_scraper_jobs` — agendar manualmente ou via Edge Function cron

### 🎨 Sprint 5 — Revisão de Layout e Navegação (PENDENTE)

> **Motivação:** Estrutura atual de menus e organização do site não está satisfatória. Revisão completa da arquitetura de informação, hierarquia de navegação e layout geral do dashboard.

- [ ] **Auditoria de IA (Information Architecture):** mapear todos os fluxos atuais e identificar inconsistências na hierarquia de menus
- [ ] **Redesign da Sidebar:** revisar agrupamento, ordem e nomenclatura dos itens de navegação
- [ ] **Estrutura de páginas do Dashboard:** avaliar se a divisão atual de rotas faz sentido para o usuário (ex: separação entre STL Search / Games / Portfolio / Settings)
- [ ] **Layout responsivo:** verificar comportamento em diferentes resoluções (mobile, tablet, desktop)
- [ ] **Consistência visual:** alinhar espaçamentos, tipografia e hierarquia visual em todas as páginas
- [ ] **Testes com usuário:** validar nova estrutura com pelo menos 3 usuários reais antes de lançar

---

## 8. Checklist Pré-Launch

Antes de aceitar pagamentos reais, confirmar:

- [ ] `isMockMode` removido ou gated por `STRIPE_MOCK=true` em dev
- [ ] `UNIQUE CONSTRAINT` em `transactions.payment_intent_id`
- [ ] Idempotência implementada no webhook
- [ ] RLS reativado em `telegram_scraper_jobs`
- [ ] Rotas de API sem auth corrigidas
- [ ] Download tenta proxy antes de debitar créditos
- [ ] `STRIPE_WEBHOOK_SECRET` configurado em produção
- [ ] `TELEGRAM_PROXY_URL` configurado (sem isso, STL falso é servido)
- [ ] `invoice.paid` implementado (ou comunicar ao usuário que créditos mensais são manuais por enquanto)

---

## Referências de Arquivos

- Store: [`src/store/store.ts`](src/store/store.ts)
- Supabase clients: [`src/lib/supabase.ts`](src/lib/supabase.ts)
- Checkout: [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts)
- Webhook Stripe: [`src/app/api/webhooks/stripe/route.ts`](src/app/api/webhooks/stripe/route.ts)
- Download: [`src/app/api/telegram/download/route.ts`](src/app/api/telegram/download/route.ts)
- Audit Vote: [`src/app/api/games/audit-vote/route.ts`](src/app/api/games/audit-vote/route.ts)
- Game Data: [`src/lib/gameDataLoader.ts`](src/lib/gameDataLoader.ts)
- PhotoMatch: [`src/components/games/PhotoMatch.tsx`](src/components/games/PhotoMatch.tsx)
- CategorySort: [`src/components/games/CategorySort.tsx`](src/components/games/CategorySort.tsx)
- STL Search: [`src/app/dashboard/stl-search/page.tsx`](src/app/dashboard/stl-search/page.tsx)
- Admin: [`src/app/dashboard/admin/page.tsx`](src/app/dashboard/admin/page.tsx)
- Design system: [`src/app/globals.css`](src/app/globals.css)
- Migrações: [`supabase/migrations/`](supabase/migrations/)
