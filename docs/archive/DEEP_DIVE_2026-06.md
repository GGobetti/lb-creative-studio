# LB Creative Studio — Deep Dive Completo

**Data:** Junho 2026  
**Última atualização:** 2026-06-26 — pós-Sprint 9 (Sistema de Afiliados ML)  
**Arquitetura geral:** [`../ARCHITECTURE.md`](../ARCHITECTURE.md)  
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

- **4 Mini-Games de Curadoria:**
  - **PhotoMatch** (+10 cr) — valida se a foto corresponde ao arquivo STL. Votação comunitária real com agregação de votos.
  - **TagDetective** (+5 cr) — identifica tags inválidas (geradas do vocabulário real de STL 3D).
  - **CategorySort** (+25 cr) — categoriza STLs usando categorias reais da tabela (`category` field).
  - **QualityAudit** (+15 cr) — aprova/rejeita STLs com sugestões cooperativas da comunidade.

- **Sistema XP + Badges:** Jogadores acumulam XP por ações (configurável por admin). Badges Bronze/Silver/Gold/Diamond desbloqueados por XP acumulado.

- **Algoritmo de Consenso:**
  - **≥ 70% de convergência** → sistema aceita como verdade e atualiza o arquivo automaticamente.
  - **< 70%** → tarefa vai para a **fila de Curadoria Especial** no painel admin (AuditTab) para validação manual.

### 0.3 Ferramenta de Atração Orgânica — Calculadora Maker + CRM

Principal funcionalidade **gratuita** para atração de tráfego orgânico e conversão em assinantes:

- **Importação Inteligente:** usuário insere link de uma peça (ex: MakerWorld) e a plataforma lê o perfil do modelo preenchendo a calculadora automaticamente.
- **Precificação Descomplicada:** calcula o custo real de fabricação e sugere o preço de venda.
- **CRM Integrado:** cadastro de clientes, geração de orçamentos profissionais, envio via WhatsApp/E-mail.

### 0.4 Painel Administrativo

Retaguarda operacional do negócio (`src/app/dashboard/admin/page.tsx` — ~898 linhas após refatoração):

- **ScraperTab** — dashboard de monitoramento da fila Telegram com Supabase Realtime
- **AcervoTab** — moderação do acervo de STLs
- **AuditTab** — fila de moderação manual (STLs que não atingiram 70% de consenso)
- **AnalyticsTab** — métricas de uso e ROI por canal
- **FlagsTab** — feature flags configuráveis
- **TicketsTab** — suporte a chamados de usuários
- **XpConfigPanel** — configuração de XP por ação e níveis (configurável por admin)
- **GamesLimitsPanel** — limites diários por game type
- **GameAdminShortcuts** — atalhos para rotas de moderação de STL

### 0.5 Internacionalização

Sistema i18n implementado com suporte a **PT-BR, EN e ES**:
- `src/lib/translations.ts` — sistema de tradução com hook `useTranslation()`
- `LanguageSwitcher` — dropdown com bandeiras no header do dashboard
- Páginas wired: dashboard, billing, sidebar, navbar, perfil

---

## Sumário Executivo (Status Jun/2026 — pós-Backlog Sprint)

O projeto atingiu **maturidade operacional**. Todos os blockers financeiros e de segurança foram resolvidos nos Sprints 0–3. Os Sprints 4–8 entregaram ground truth real nos games, tema Liquid Glass, sistema XP/badges completo e i18n PT/EN/ES. O **Backlog Sprint** (2026-06-20) concluiu os últimos itens cosméticos e de produto:

- ✅ Login blobs: primary cyan + accent violet
- ✅ Emojis → Lucide icons (GameHub + SessionResult)
- ✅ Leaderboard teaser honesto com contagem real de makers ativos
- ✅ Store cleanup: slices mortos removidos, `useConfiguratorStore` → `useAppStore` (35 arquivos)
- ✅ Onboarding tour guiado 4 passos com spotlight Framer Motion *(requer migration manual no Supabase)*
- ✅ Migration pg_cron para archival de `telegram_scraper_jobs` *(requer apply manual no Supabase)*

**Próximo passo:** Deploy para beta (Vercel + Supabase redirect URLs + Stripe webhook em produção).

---

## 1. Bugs Críticos — Segurança e Financeiro

> **Todos resolvidos ✅ (Sprints 0–3)**

| ID | Problema | Status |
|----|---------|--------|
| C1 | Checkout mock hardcoded | ✅ `STRIPE_MOCK` env gate |
| C2 | Webhook Stripe sem idempotência | ✅ UNIQUE + check antes de creditar |
| C3 | Créditos perdidos em download | ✅ Proxy tenta download antes de debitar |
| C4 | RLS desabilitado em scraper_jobs | ✅ Reativado via migration |
| C5 | APIs sem autenticação | ✅ `role === sysadmin` adicionado |
| C6 | Race condition em créditos | ✅ RPCs atômicas com FOR UPDATE |

---

## 2. Bugs de Lógica — Gamificação

> **Todos resolvidos ✅ (Sprint 4)**

| ID | Problema | Status |
|----|---------|--------|
| G1 | PhotoMatch: ambos botões fazem a mesma coisa | ✅ Votação comunitária real com agregação |
| G2 | CategorySort: "resposta correta" aleatória | ✅ Usa campo `category` real dos STLs |
| G3 | TagDetective: fake tag é string aleatória sem sentido | ✅ Tags geradas do vocabulário real STL 3D |
| G4 | QualityAudit: `shouldApprove` por índice posicional | ✅ Sugestões cooperativas da comunidade |
| G5 | `game_type` controlado pelo cliente | ✅ Validado no servidor |

---

## 3. Banco de Dados e Performance

> **Maioria resolvida ✅ (Sprints 1–4)**

| ID | Problema | Status |
|----|---------|--------|
| D1 | SELECT * sem paginação em STL search | ✅ `.range()` + filtro `parent_id` no banco |
| D2 | ILIKE sem índice GIN | ✅ `tsv` tsvector + índice GIN (migration aplicada) |
| D3 | Race condition no contador diário | ✅ `ON CONFLICT ... + 1` atômico |
| D4 | `download_count` não-atômico | ✅ RPC `increment_download_count` |
| D5 | Sem índice em `transactions` | ✅ `transactions_user_date_idx` (migration) |
| D6 | `telegram_scraper_jobs` sem archival | ✅ Migration pg_cron criada — apply manual no Supabase Dashboard |
| D7 | N+1 de PerceptualHash no Admin | ✅ `Promise.allSettled` |
| D8 | `invoice.paid` não implementado | ✅ `stripe_customer_id` + renovação Pro |
| D9 | Admin com polling | ✅ Supabase Realtime no ScraperTab + Sidebar |

### Migrations Aplicadas em Produção

| Arquivo | Conteúdo |
|---------|---------|
| `20260619000000_security_performance_fixes.sql` | UNIQUE em `payment_intent_id`, RLS em scraper_jobs, índice GIN tsv, `stripe_customer_id`, índice transactions |
| `20260619_photo_match_aggregation.sql` | Agregação de votos PhotoMatch |
| `20260619_photo_match_answers.sql` | Tabela de respostas PhotoMatch |
| `20260619_tag_and_category_votes.sql` | Votação Tag e Category |
| `20260619_audit_suggestions_v2.sql` | Sugestões cooperativas QualityAudit |
| `20260620_xp_gamification.sql` | Tabelas XP, badges, níveis, RPCs |
| `20260620_xp_security_fix.sql` | Fix de segurança no sistema XP |
| `20260619002000_onboarding_flag.sql` | Coluna `onboarding_completed` em `profiles` ✅ aplicado |
| `20260620_cleanup_scraper_jobs_cron.sql` | pg_cron cleanup diário de `telegram_scraper_jobs` ✅ aplicado |

---

## 4. Arquitetura e Qualidade de Código

| ID | Problema | Status |
|----|---------|--------|
| A1 | Store Zustand sem selectors | ✅ `useShallow` em todos os componentes |
| A2 | AdminPage 3.044 linhas | ✅ ~898 linhas + ScraperTab + AcervoTab + AuditTab + AnalyticsTab + FlagsTab |
| A3 | AuthProvider ciclo com `pricingSettings` | ✅ Removido do dep array |
| A5 | Deps: `three`/`potrace` | ✅ `potrace` removido, `three` em dependencies |
| A6 | 6+ alert() nativos | ✅ Substituídos por `useToast()` |
| A7 | Logout duplicado | ✅ `useLogout` hook extraído |

### Componentes Admin Extraídos

```
src/components/admin/
  ScraperTab.tsx          ✅
  AcervoTab.tsx           ✅
  AuditTab.tsx            ✅ (Sprint 8 — fila de moderação manual)
  AnalyticsTab.tsx        ✅
  FlagsTab.tsx            ✅
  TicketsTab.tsx          ✅
  XpConfigPanel.tsx       ✅ (Sprint 7)
  GamesLimitsPanel.tsx    ✅ (Sprint 7)
  GameAdminShortcuts.tsx  ✅ (Sprint 8)
  UserDetailsModal.tsx    ✅
  AuditModerationLink.tsx ✅
```

### Store Zustand — Estrutura Atual

**`src/store/store.ts`** — export: `useAppStore` (renomeado de `useConfiguratorStore` no Backlog Sprint)

Slices ativos (slices mortos removidos):
- `AuthSlice` — user, profile, setProfile, language, credits, featureFlags
- `UiSlice` — creditModalOpen, sidebarTab, uiMode
- `PricingSlice` — pricingSettings
- `FeatureFlagsSlice` — feature flags
- `XpSlice` — xpSummary, refreshXpSummary

Removidos no Backlog Sprint: `CatalogSlice`, `ParametricSlice` (~120 linhas), `ImageToStlSlice`.

---

## 5. UI/UX

| ID | Problema | Status |
|----|---------|--------|
| U1 | 6x alert() na Busca de STL | ✅ useToast() |
| U2 | Onboarding ausente | ✅ Tour 4 passos + spotlight Framer Motion — migration `onboarding_completed` requer apply manual |
| U3 | Feedback de download fraco | ✅ toast + crédito debitado |
| U4 | Sem "Esqueci minha senha" | ✅ `supabase.auth.resetPasswordForEmail` implementado |
| U5 | Dot grid login com cor `indigo` incorreta | ✅ Blobs cyan primary + violet accent |
| U6 | Emojis misturados com Lucide icons | ✅ BADGE_ICONS map + Award/Gem/Trophy em GameHub e SessionResult |
| U7 | Leaderboard teaser morto | ✅ WeeklyLeaderboardTeaser com contagem real de makers ativos |
| U8 | Custo de crédito não exibido no card do STL | ⏳ Pendente |

### Sprint 5 — Liquid Glass Theme ✅

Dark mode reformulado com tema **Liquid Glass**:
- Variáveis CSS: `--sidebar-bg`, `--sidebar-border`, `--glass-*`
- Animações: mesh blob backgrounds (`globals.css:187+`)
- `@utility glass-panel` aplicado à sidebar
- Aplicado em todas as páginas do dashboard

### Sprint 7 — XP + Badges ✅

Sistema de gamificação completo:
- **XP Pill** na navbar com nível atual
- **Profile Tab** com XP, badges e level trail
- **Gráfico ECharts** de XP acumulado/atividade com filtro de período
- **Redeem Card** para trocar XP por créditos
- **Badges Grid** Bronze/Silver/Gold/Diamond
- **XP integrado** em todas as rotas de games (`award_xp` RPC chamada após cada ação)

### Sprint 8 — i18n PT/EN/ES ✅

- `src/lib/translations.ts` — hook `useTranslation()` + namespace de chaves
- `LanguageSwitcher` — dropdown com flags no header, sem overflow-hidden (fix aplicado)
- Sidebar renomeado: "Garimpo 3D" e "Gaming Lab XP"
- Páginas wired: dashboard, billing, sidebar, navbar, perfil, tickets

---

## 6. Matriz de Severidade Consolidada

> **Última atualização:** 2026-06-19 — pós-Sprint 8

| ID | Área | Problema | Severidade | Status |
|----|------|---------|-----------|--------|
| C1 | Financeiro | Checkout mock hardcoded | 🔴 BLOQUEANTE | ✅ Concluído |
| C2 | Financeiro | Webhook sem idempotência | 🔴 BLOQUEANTE | ✅ Concluído |
| C3 | Financeiro | Créditos perdidos em download | 🔴 BLOQUEANTE | ✅ Concluído |
| C4 | Segurança | RLS desabilitado em scraper_jobs | 🔴 BLOQUEANTE | ✅ Concluído |
| C5 | Segurança | APIs sem autenticação | 🔴 BLOQUEANTE | ✅ Concluído |
| C6 | Dados | Race condition em créditos | 🔴 CRÍTICO | ✅ Concluído |
| D1 | Performance | SELECT * sem paginação | 🟠 ALTO | ✅ Concluído |
| D2 | Performance | ILIKE sem GIN index | 🟠 ALTO | ✅ Concluído |
| D8 | Financeiro | invoice.paid não implementado | 🟠 ALTO | ✅ Concluído |
| G1 | Produto | PhotoMatch sem diferenciação de resposta | 🟠 ALTO | ✅ Concluído |
| G2 | Produto | CategorySort com resposta aleatória | 🟠 ALTO | ✅ Concluído |
| G5 | Segurança | game_type controlado pelo cliente | 🟠 ALTO | ✅ Concluído |
| A1 | Arquitetura | Store sem selectors → re-renders | 🟡 MÉDIO | ✅ Concluído |
| A2 | Manutenção | AdminPage 3.044 linhas | 🟡 MÉDIO | ✅ Concluído (~898 linhas) |
| A3 | Bug | AuthProvider ciclo potencial | 🟡 MÉDIO | ✅ Concluído |
| D3 | DB | Race condition em game counter | 🟡 MÉDIO | ✅ Concluído |
| D4 | DB | download_count não-atômico | 🟡 MÉDIO | ✅ Concluído |
| D5 | Performance | Falta índice em transactions | 🟡 MÉDIO | ✅ Concluído |
| A6 | UX | 6+ alert() nativos | 🟡 MÉDIO | ✅ Concluído |
| U4 | UX | Sem "Esqueci senha" | 🟡 MÉDIO | ✅ Concluído |
| A5 | Deps | `three`/`potrace` em package.json | 🟢 BAIXO | ✅ Concluído |
| A7 | Arquitetura | Logout duplicado | 🟢 BAIXO | ✅ Concluído |
| D6 | Infra | scraper_jobs sem archival | 🟢 BAIXO | ✅ pg_cron agendado — cleanup diário 02:00 UTC, 30d retention |
| D9 | Performance | Polling → Realtime | 🟢 BAIXO | ✅ Concluído |
| U2 | Produto | Onboarding ausente | 🟢 BAIXO | ✅ Concluído — tour 4 passos ativo em produção |
| U5 | UX | Dot grid login cor incorreta (indigo → cyan) | 🟢 BAIXO | ✅ Concluído |
| U6 | UX | Emojis vs Lucide icons | 🟢 BAIXO | ✅ Concluído |
| U7 | UX | Leaderboard teaser morto | 🟢 BAIXO | ✅ Concluído |
| S5 | Refactor | useConfiguratorStore → useAppStore + slices mortos | 🟢 BAIXO | ✅ Concluído |

---

## 7. Roadmap de Execução

### ✅ Sprint 0 — Blockers Financeiros — CONCLUÍDO
- `isMockMode` gated por `STRIPE_MOCK`
- UNIQUE em `transactions.payment_intent_id`
- Idempotência no webhook
- RLS reativado em `telegram_scraper_jobs`
- Auth nas rotas `banned-images` e `progress`
- Download tenta proxy antes de debitar créditos

### ✅ Sprint 1 — Performance e Estabilidade — CONCLUÍDO
- Paginação na STL search + filtro `parent_id` no DB
- GIN index para full-text search (tsv + migration)
- Índice em `transactions(user_id, created_at)`
- RPCs atômicas: `increment_credits_for_user`, `increment_download_count`, `record_game_action`
- `game_type` validado no servidor
- `alert()` → `useToast()`

### ✅ Sprint 2 — Produto e UX — CONCLUÍDO
- PhotoMatch ground truth (resolvido no Sprint 4)
- CategorySort ground truth (resolvido no Sprint 4)
- TagDetective vocabulário real (resolvido no Sprint 4)
- `invoice.paid` implementado
- "Esqueci senha" na tela de login

### ✅ Sprint 3 — Arquitetura — CONCLUÍDO
- Selectors Zustand (`useShallow`) em todos os componentes
- AdminPage → ScraperTab + AcervoTab + AnalyticsTab + FlagsTab
- Deps: `potrace` removido, `three` em dependencies
- `useLogout` hook extraído
- Supabase Realtime no admin

### ✅ Sprint 4 — Ground Truth nos Games — CONCLUÍDO
- PhotoMatch: votação comunitária real com agregação (`20260619_photo_match_*.sql`)
- TagDetective e CategorySort: votação comunitária real (`20260619_tag_and_category_votes.sql`)
- QualityAudit: sugestões cooperativas da comunidade (`20260619_audit_suggestions_v2.sql`)

### ✅ Sprint 5 — Liquid Glass Theme + Navegação — CONCLUÍDO
- Dark mode Liquid Glass (globals.css, glass-panel utility)
- Mesh blob animations
- Aplicado em todas as páginas do dashboard
- Nova estrutura de navegação

### ✅ Sprint 6-7 — XP/Badges Gamification — CONCLUÍDO
- Tabelas XP, badges, níveis, histórico (`20260620_xp_gamification.sql`)
- XpSlice no store Zustand
- API routes: `xp-summary`, `award-xp`, `redeem-xp`
- XP pill na navbar
- Profile tab com XP, badges, level trail
- Gráfico ECharts acumulado/atividade
- XP integrado nas rotas de games existentes
- Admin: XpConfigPanel + GamesLimitsPanel
- Fix de segurança XP (`20260620_xp_security_fix.sql`)

### ✅ Sprint 8 — i18n PT/EN/ES + AuditTab — CONCLUÍDO
- `src/lib/translations.ts` com hook `useTranslation()`
- `LanguageSwitcher` com flags PT/EN/ES no header
- Fix overflow-hidden: dropdown não ficava mais atrás da página
- Wiring: dashboard, billing, sidebar, navbar, perfil
- `AuditTab.tsx` — fila de moderação manual dos STLs sem consenso
- `GameAdminShortcuts.tsx` — atalhos admin para rotas de moderação
- Sidebar: "Garimpo 3D" e "Gaming Lab XP"

### ✅ Backlog Sprint — CONCLUÍDO (2026-06-20)

> [`docs/superpowers/plans/2026-06-19-backlog-sprint.md`](superpowers/plans/2026-06-19-backlog-sprint.md)

- U5: Login blobs → primary cyan + accent violet
- U6: Emojis → Lucide icons em GameHub + SessionResult
- U7: WeeklyLeaderboardTeaser com contagem real de makers ativos da semana
- S5: Store cleanup — slices mortos removidos + rename `useConfiguratorStore` → `useAppStore`
- U2: OnboardingTour 4 passos com spotlight Framer Motion *(migration manual: `onboarding_completed` no Supabase)*
- D6: Migration pg_cron cleanup `telegram_scraper_jobs` *(apply manual no Supabase Dashboard)*

### ✅ Sprint 9 — Sistema de Afiliados Mercado Livre — CONCLUÍDO (2026-06-26)

> [`docs/superpowers/plans/2026-06-25-mercado-livre-full-integration.md`](superpowers/plans/2026-06-25-mercado-livre-full-integration.md)

**DB — 3 tabelas normalizadas em produção:**
- `affiliate_products` — produto base (marketplace, affiliate_link, is_active, is_public)
- `affiliate_product_details` — preço, descrição, categoria, condição, formas de pagamento, estoque, vendas, rating
- `affiliate_product_photos` — galeria com is_primary e position
- `marketplace_credentials` — tokens OAuth por admin/marketplace

**OAuth Mercado Livre:**
- redirect_uri dinâmico via `host` do request (funciona em localhost e Vercel)
- user_id no parâmetro `state` (sobrevive redirect cross-site)
- upsert com `onConflict: 'admin_id,marketplace'` para reconexão
- Botão "Conectar ao ML" visível no painel admin

**ML API — Suporte a produtos de catálogo (`/p/MLB...`):**
- Tenta `/items/{id}` primeiro; se 404 usa `/products/{id}`
- 3 estratégias em cascata para preço/estoque em catálogos
- Fotos, descrição, categoria, rating, formas de pagamento extraídos

**Frontend:**
- `/affiliate` — página pública sem login (grid de produtos com filtros e busca)
- `/dashboard/affiliate` — mesma página dentro do layout com navbar/sidebar
- Modal com galeria de fotos + todos os detalhes do produto
- Sidebar: "Loja de Afiliados" → `/dashboard/affiliate`
- Carousel na home com 5 produtos e autoplay (⚠️ não testado ainda)

### 🔜 Próximos Itens

**Produto (curto prazo):**
- U8: Exibir custo de crédito no card do STL antes do download
- ⚠️ Testar carousel de afiliados na home page
- ⚠️ Testar modal de produto em mobile/tablet
- Stripe sandbox: conectar webhook em modo Test (`stripe listen` local ou endpoint ngrok) para validar fluxo de assinatura end-to-end

**Longo prazo (quando for ao ar para beta testers):**
- Deploy Vercel: configurar redirect URLs Supabase + Google OAuth + Stripe webhook em produção
- Hub Maker com conteúdo real (atualmente placeholder)
- Landing page: prova social (testimonials, contador de usuários, pricing visível)
- Leaderboard semanal real com ranking de XP
- Adicionar mais produtos afiliados (AliExpress, Shopee, Amazon futuramente)

---

## 8. Checklist Pré-Launch

### Código / Segurança
- ✅ `isMockMode` gated por `STRIPE_MOCK=true` em dev
- ✅ `UNIQUE CONSTRAINT` em `transactions.payment_intent_id`
- ✅ Idempotência implementada no webhook
- ✅ RLS reativado em `telegram_scraper_jobs`
- ✅ Rotas de API sem auth corrigidas
- ✅ Download tenta proxy antes de debitar créditos
- ✅ `invoice.paid` implementado (stripe_customer_id salvo + créditos mensais)

### Stripe Sandbox (próximo passo de produto)
- ⚠️ Conectar webhook Stripe em modo Test — `stripe listen --forward-to localhost:3000/api/webhooks/stripe` ou endpoint ngrok
- ⚠️ Validar fluxo completo: checkout → `invoice.paid` → créditos creditados → renovação mensal

### Deploy para Beta (backlog futuro — quando for ao ar)
- ⚠️ `STRIPE_WEBHOOK_SECRET` — configurar endpoint no Stripe Dashboard apontando para o domínio Vercel
- ⚠️ Supabase → Authentication → URL Configuration: adicionar domínio Vercel em Site URL e Redirect URLs
- ⚠️ Google Cloud Console → OAuth Client: adicionar domínio Vercel em Authorized Origins e Redirect URIs
- ⚠️ Variáveis de ambiente no Vercel (Settings → Environment Variables): todas as vars do `.env.local`

### Scraper (separado — repo próprio)
- ✅ Migrado para [`lb-creative-scrapper`](https://github.com/GGobetti/lb-creative-scrapper) — CLI independente
- ✅ Sem Express server — sem portas abertas, sem endpoints HTTP
- ⚠️ Copiar `.env.example` → `.env` no novo repo com credenciais reais antes de rodar `npm run scan`

---

## Referências de Arquivos

### Core
- Store: [`src/store/store.ts`](src/store/store.ts)
- Supabase clients: [`src/lib/supabase.ts`](src/lib/supabase.ts)
- Traduções: [`src/lib/translations.ts`](src/lib/translations.ts)
- Design system: [`src/app/globals.css`](src/app/globals.css)
- Migrações: [`supabase/migrations/`](supabase/migrations/)

### API Routes
- Checkout: [`src/app/api/checkout/route.ts`](src/app/api/checkout/route.ts)
- Webhook Stripe: [`src/app/api/webhooks/stripe/route.ts`](src/app/api/webhooks/stripe/route.ts)
- Download: [`src/app/api/telegram/download/route.ts`](src/app/api/telegram/download/route.ts)
- Audit Vote: [`src/app/api/games/audit-vote/route.ts`](src/app/api/games/audit-vote/route.ts)
- XP: `src/app/api/games/xp-summary/`, `award-xp/`, `redeem-xp/`

### Games
- Game Data: [`src/lib/gameDataLoader.ts`](src/lib/gameDataLoader.ts)
- PhotoMatch: [`src/components/games/PhotoMatch.tsx`](src/components/games/PhotoMatch.tsx)
- CategorySort: [`src/components/games/CategorySort.tsx`](src/components/games/CategorySort.tsx)
- TagDetective: [`src/components/games/TagDetective.tsx`](src/components/games/TagDetective.tsx)
- QualityAudit: [`src/components/games/QualityAudit.tsx`](src/components/games/QualityAudit.tsx)
- GameHub: [`src/components/games/GameHub.tsx`](src/components/games/GameHub.tsx)
- Leaderboard Teaser: [`src/components/games/WeeklyLeaderboardTeaser.tsx`](src/components/games/WeeklyLeaderboardTeaser.tsx)
- Onboarding Tour: [`src/components/onboarding/OnboardingTour.tsx`](src/components/onboarding/OnboardingTour.tsx)

### Admin
- Admin page: [`src/app/dashboard/admin/page.tsx`](src/app/dashboard/admin/page.tsx)
- Componentes admin: [`src/components/admin/`](src/components/admin/)

### Dashboard
- Layout: [`src/app/dashboard/layout.tsx`](src/app/dashboard/layout.tsx)
- Sidebar: [`src/components/layout/DashboardSidebar.tsx`](src/components/layout/DashboardSidebar.tsx)
- STL Search: [`src/app/dashboard/stl-search/page.tsx`](src/app/dashboard/stl-search/page.tsx)

### Afiliados (Sprint 9)
- ML lib: [`src/lib/mercado-livre.ts`](src/lib/mercado-livre.ts)
- OAuth URL: [`src/app/api/auth/mercado-livre-url/route.ts`](src/app/api/auth/mercado-livre-url/route.ts)
- OAuth callback: [`src/app/api/auth/mercado-livre/route.ts`](src/app/api/auth/mercado-livre/route.ts)
- Importação: [`src/app/api/affiliate/import-mercado-livre/route.ts`](src/app/api/affiliate/import-mercado-livre/route.ts)
- API produtos: [`src/app/api/affiliate/products/route.ts`](src/app/api/affiliate/products/route.ts)
- Página pública: [`src/app/affiliate/page.tsx`](src/app/affiliate/page.tsx)
- Página dashboard: [`src/app/dashboard/affiliate/page.tsx`](src/app/dashboard/affiliate/page.tsx)
- Grid: [`src/components/affiliate/AffiliateProductGrid.tsx`](src/components/affiliate/AffiliateProductGrid.tsx)
- Modal: [`src/components/affiliate/ProductModal.tsx`](src/components/affiliate/ProductModal.tsx)
- Carousel home: [`src/components/landing/AffiliateCarousel.tsx`](src/components/landing/AffiliateCarousel.tsx)
- Admin tab: [`src/components/admin/AffiliateProductsTab.tsx`](src/components/admin/AffiliateProductsTab.tsx)
