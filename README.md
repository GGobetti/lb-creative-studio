# LB Creative Studio

Plataforma SaaS para makers e impressores 3D brasileiros. Permite buscar e baixar arquivos STL garimpados do Telegram, ganhar créditos via jogos de curadoria comunitária, calcular custos de impressão, gerenciar portfólio e assinar planos com pagamento via Stripe.

> **Fonte de verdade técnica:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — onde este README divergir, prevalece o ARCHITECTURE.

**Produção:** `https://lb-creative-studio-iota.vercel.app`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilo | TailwindCSS v4 + Framer Motion |
| Banco / Auth | Supabase (PostgreSQL + Auth + Storage) |
| Pagamentos | Stripe (Checkout + Webhooks) |
| Armazenamento STL | Cloudflare R2 (binários, egress grátis) |
| Deploy | Vercel (auto-deploy em push na `main`) |

---

## Setup local

### Pré-requisitos
- Node.js 18+
- Conta Supabase (linked via `supabase link`)
- Chaves Stripe (test mode para desenvolvimento)

### Instalar e rodar

```bash
npm install
cp .env.local.example .env.local   # preencher as variáveis abaixo
npm run dev                          # http://localhost:3000
```

### Variáveis necessárias (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://yruoiwtnxopcbiiuvxxa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe (usar test keys em desenvolvimento)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Cloudflare R2 (armazém dos STLs)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=lb-stls

# Mercado Livre (opcional — só para o módulo de afiliados)
MERCADO_LIVRE_CLIENT_ID=...
MERCADO_LIVRE_CLIENT_SECRET=...
MERCADO_LIVRE_REDIRECT_URI=http://localhost:3000/api/auth/mercado-livre
```

### Stripe em desenvolvimento

Para testar pagamentos localmente, redirecione os webhooks do Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use cartão de teste: `4242 4242 4242 4242` (qualquer data/CVC futuros).

---

## Estrutura do projeto

```
src/
  app/
    api/          — Route Handlers (checkout, webhook, games, admin, etc.)
    dashboard/    — Área autenticada (games, billing, admin, STL search, etc.)
    login/        — Autenticação via Supabase
    page.tsx      — Landing page pública
  components/
    admin/        — Componentes do painel admin
    games/        — Minigames de curadoria
    stl-search/   — Busca e download de STLs
    dashboard/    — PhotoCurator, Settings, etc.
    landing/      — Hero, Features, STLShowcase
    ui/           — Design system
  lib/
    supabase.ts   — Factories de cliente Supabase + tipos compartilhados
    r2.ts         — Geração de presigned URLs do Cloudflare R2
    translations.ts — i18n PT/EN/ES
  store/store.ts  — Zustand (auth, ui, pricing, xp, feature flags)
supabase/
  migrations/     — Histórico de migrations SQL (fonte de verdade do schema)
  functions/      — Edge Functions (add-credits, deduct-credits, stripe-sync)
docs/             — Documentação técnica detalhada
```

---

## Ecossistema: dois repositórios

Este repo é o **frontend/app**. O scraper que ingere STLs do Telegram é um projeto separado:

- **`lb-creative-studio`** (este) — App Next.js, roda na Vercel
- **`lb-creative-scrapper`** (repo separado) — CLI Node/GramJS, roda localmente na máquina do dono

O scraper lê grupos do Telegram → baixa os arquivos → sobe para o **Cloudflare R2** → indexa metadados no Supabase. O studio gera presigned URLs do R2 para entrega ao usuário (sem passar pela máquina do dono, egress grátis).

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arquitetura completa, decisões técnicas, estado atual |
| [`ROADMAP.md`](ROADMAP.md) | Roadmap de features P0→P3 |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Fluxo de git (branch → PR → merge) |
| [`docs/R2_SETUP.md`](docs/R2_SETUP.md) | Como configurar o Cloudflare R2 |
| [`docs/SUBSCRIPTIONS_IMPLEMENTATION.md`](docs/SUBSCRIPTIONS_IMPLEMENTATION.md) | Fluxo de assinaturas Stripe |
| [`docs/minigames-ux-spec.md`](docs/minigames-ux-spec.md) | Spec UX dos minigames |
| [`MERCADO_LIVRE_INTEGRATION.md`](MERCADO_LIVRE_INTEGRATION.md) | Integração de afiliados Mercado Livre |
| [`docs/archive/`](docs/archive/) | Documentos históricos (não mais em uso ativo) |

---

## Migrations de banco

As migrations vivem em `supabase/migrations/` e são aplicadas via Supabase CLI:

```bash
supabase db push        # aplica migrations pendentes no projeto linkado
supabase db pull        # puxa schema atual do banco remoto
```

Nunca rodar SQL solto na raiz — usar sempre o diretório de migrations.
