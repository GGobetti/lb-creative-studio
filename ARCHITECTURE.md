# 🏗️ Arquitetura do Ecossistema LB Creative

> **Documento de Engenharia Reversa & Auditoria**
> Gerado em 21/06/2026 · Cobre `lb-creative-studio` (frontend SaaS) + `lb-creative-scrapper` (worker local)
> Este arquivo é a **fonte de verdade pós-separação**. Onde ele conflitar com `PROJETO.md`, `README.md` ou `docs/DEEP_DIVE_2026-06.md`, **este documento prevalece** (os outros estão desatualizados — ver §7).

---

## 0. Status de Execução (atualizado 24/06/2026)

Plano: [`docs/superpowers/plans/2026-06-21-ecosystem-cleanup-and-fixes.md`](docs/superpowers/plans/2026-06-21-ecosystem-cleanup-and-fixes.md).

- ✅ **Fase 0** (limpeza), **1A** (entrega R2), **1B** (Stripe), **1C** (custo dinâmico), **1D** (moderação por tamanho) — mergeadas.
- ✅ **Studio em produção no Vercel** (23/06/2026) — URL: `lb-creative-studio-iota.vercel.app`. Auto-deploy em push na `main`.
- ✅ **R2 credenciais no Vercel**: `R2_ACCOUNT_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` corretos. `R2_ACCESS_KEY_ID` configurado. ⚠️ Se precisar rotacionar, gere novo token em Cloudflare → R2 → Manage API Tokens.
- ✅ **Stripe Webhook criado** (23/06/2026): endpoint configurado → prod. ⚠️ `STRIPE_WEBHOOK_SECRET` deve estar setado nas env vars do Vercel (nunca commitar o valor).
- ✅ **Bugs pós-produção corrigidos** (23/06): créditos Stripe, admin tickets, liquid glass nos modais, select dropdown, email no modal cliente, Telegram direto, PhotoMatch label, RLS avatars bucket, nome do grupo oculto para não-admin, refetch após ban.
- ✅ **Dedup de fotos completado** (24/06/2026):
  - 135 grupos de fotos iguais detectados (por perceptual hash)
  - 170 URLs redundantes consolidadas
  - 306 STLs atualizados (compartilham agora foto única)
  - Backup automático + log detalhado em JSON
  - Script restore (`npm run dedup:restore`) para reverter se necessário
- ⏳ **Pendente**: Fase 2 (consolidar monitor), Fase 3 (imagens no R2). Backfill em andamento.
- ✅ Variáveis de ambiente no Vercel configuradas (R2 + Stripe). Rotacionar chaves se necessário via dashboards respectivos.

---

## 1. Visão Geral do Ecossistema

O produto é uma plataforma SaaS para makers 3D brasileiros que **agrega arquivos STL** garimpados de grupos do Telegram, organiza-os via **curadoria gamificada por crowdsourcing**, e monetiza por **créditos + assinaturas (Stripe)**. Inclui ainda ferramentas utilitárias (calculadora de precificação, CRM, cotações).

> 🔄 **Arquitetura-alvo (decidida 22/06/2026):** o **Telegram Vault será aposentado** como armazém. O **Cloudflare R2** passa a ser o armazém-mestre **e** a camada de entrega dos STLs. O diagrama abaixo já reflete o alvo; ver §6 para o estado atual (legado) e a migração.

São **dois processos** que compartilham **um único banco Supabase**, com os binários no **Cloudflare R2**:

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  lb-creative-scrapper    │         │   lb-creative-studio      │
│  (LOCAL — Mac do dono)   │         │   (Web — futura: Vercel)  │
│  INGESTÃO apenas         │         │                           │
│  GramJS (lê grupos)      │         │  Next.js 16 App Router    │
│  CLI: scan / daemon      │         │  React 19 + Three.js      │
│                          │         │  Games, Billing, Admin    │
└──────┬──────────┬────────┘         └────────────┬─────────────┘
       │          │ escreve metadados             │ lê metadados (anon+RLS)
       │          │ (service_role)                │ download = debita crédito
       │          ▼                               │ + gera presigned URL do R2
       │   ┌──────────────────────────────────────────────────┐
       │   │            SUPABASE (PostgreSQL + Auth +          │
       │   │            Storage[só thumbs] + Edge Functions)   │
       │   │            projeto: yruoiwtnxopcbiiuvxxa          │
       │   └──────────────────────────────────────────────────┘
       │ sobe binário (PUT S3 API)                 ▲ presigned URL
       ▼                                           │ (download direto, egress grátis)
   ┌────────────────────────────┐                 │
   │   CLOUDFLARE R2 (bucket)    │◄────────────────┘
   │   armazém-mestre + entrega  │  ← repositório dos arquivos STL
   └────────────────────────────┘
```

**Princípio do design (alvo):** o Supabase guarda **metadados** (título, tags, hash, fotos, **chave do objeto no R2**). O binário do STL vive no **Cloudflare R2** (S3-compatível). A máquina local **só faz ingestão** (lê grupo → baixa → `PUT` no R2 → indexa). O download do usuário **não passa pela máquina nem por proxy**: o studio debita o crédito e devolve uma **presigned URL** do R2 (bucket privado), e o usuário baixa direto do R2 — **egress grátis**. Custo ≈ só armazenamento (~US$0,015/GB/mês).

---

## 2. lb-creative-studio (Frontend SaaS)

### 2.1 Stack
| Camada | Tecnologia |
|--------|-----------|
| Framework | **Next.js 16.2.4** (App Router, Turbopack) + React 19 + TypeScript 5 |
| Estilo | TailwindCSS v4 + Radix UI + Framer Motion |
| 3D | Three.js r177 (`stl-exporter.ts`) · `imagetracerjs` (image→SVG) |
| Charts | ECharts (`echarts-for-react`) — usado no XpChart |
| Estado | Zustand v5 + Immer (`useAppStore`, persist no localStorage) |
| Backend | Supabase JS SDK (`@supabase/ssr` + `@supabase/supabase-js`) |
| Pagamentos | Stripe (`stripe` server SDK + `@stripe/stripe-js`) |

### 2.2 Estrutura (`src/`)
- **`app/`** — App Router. Páginas em `dashboard/*`, rotas de API em `app/api/*`.
- **`components/`** — agrupado por domínio: `admin/`, `games/`, `stl-search/`, `dashboard/`, `profile/`, `affiliate/`, `ui/` (design system), `landing/`.
- **`lib/`** — `supabase.ts` (factories de client + **todos os tipos compartilhados**), `translations.ts` (i18n PT/EN/ES), `gameDataLoader.ts`, `stl-exporter.ts`, `image-to-svg.ts`, `imageHash.ts`, `format.ts`.
- **`store/store.ts`** — Zustand. Slices: `AuthSlice`, `UiSlice`, `PricingSlice`, `FeatureFlagsSlice`, `XpSlice`.
- **`types/`** — `games.ts`, `leaderboard.ts`, `stl.ts`, `subscription.ts`, `xp.ts`.

### 2.3 Rotas de API principais
| Rota | Responsabilidade |
|------|------------------|
| `api/checkout` | Cria Stripe Checkout Session (lê `pricing_plans` do banco). Suporta `STRIPE_MOCK`. |
| `api/webhooks/stripe` | `checkout.session.completed` + `invoice.paid`. Idempotência via UNIQUE em `transactions.payment_intent_id`. |
| `api/telegram/download` | Verifica créditos → debita (custo dinâmico via `feature_costs`) → gera **presigned URL do R2** → retorna ao cliente. Download direto do R2, sem proxy. |
| `api/telegram/jobs` | Ações de moderação (`approve`/`cancel`/`retry`/`reject`) — opera sobre `telegram_scraper_jobs` no Supabase (scraper consome a fila). Só `sysadmin`. |
| `api/telegram/progress`, `banned-images`, `backfill`, `favorite` | Suporte ao módulo STL search. |
| `api/games/*` | Lógica dos 4 minigames + XP (`award-xp`, `redeem-xp`, `xp-summary`) — validação server-side. |
| `api/import/makerworld` | Importa metadados de modelos via API JSON da Bambu Lab (fetch nativo + retry; **não usa cheerio**). |
| `api/affiliate/*` | CRUD de produtos afiliados + tracking de clique. |

### 2.4 Banco de Dados
- `supabase/schema.sql` define **8 tabelas base**: `profiles`, `catalog_items`, `saved_projects`, `transactions`, `user_pricing_settings`, `portfolio_items`, `feature_costs`, `feature_flags`.
- As demais (~30) vêm das **migrations** em `supabase/migrations/` (telegram STL, jobs, games, XP, votos, tickets, afiliados, pricing_plans, etc.).
- **Edge Functions** (`supabase/functions/`): `add-credits`, `deduct-credits`, `stripe-sync`.
- RLS: próprio-usuário + `is_admin()` (role `sysadmin`). Rotas server-side privilegiadas usam `getSupabaseAdmin()` (service_role, bypassa RLS).

### 2.5 Games & Monetização (entendimento do fluxo)
**Curadoria gamificada** (corrige metadados sujos dos STLs garimpados):
- **PhotoMatch** (+10cr) · **TagDetective** (+5cr) · **CategorySort** (+25cr) · **QualityAudit** (+15cr).
- **Consenso ≥70%** → atualiza o STL automaticamente. **<70%** → fila de moderação manual (`AuditTab`).
- **XP + Badges** (Bronze/Silver/Gold/Diamond), configurável via admin (`XpConfigPanel`, `GamesLimitsPanel`).

**Economia de créditos:**
- **1 crédito = 1 download** de STL (`api/telegram/download`, `cost = 1`).
- Créditos entram por: compra de pacote avulso (`pack_50/200/500`), assinatura mensal (`pro`=100/mês, `max`=250/mês), ganho em games, e resgate de XP.
- Ledger append-only em `transactions` (auditável). `increment_credits_for_user` (RPC atômica) evita race conditions.

---

## 3. lb-creative-scrapper (Worker Local)

### 3.1 Natureza
**CLI Node/TypeScript** rodado via `tsx`, **exclusivamente local**. Userbot MTProto (lib `telegram`/GramJS) logado na conta pessoal do dono (não é bot API). **Atenção:** apesar de ser descrito como "CLI puro", o repositório ainda contém um servidor Next.js (port 3001) e um `src/server.ts` Express — ver §6/§7.

### 3.2 Comandos (`package.json` → `src/index.ts` via yargs)
| Comando | Função |
|---------|--------|
| `npm run scan` | Um scan único das últimas 24h (`--hours`). |
| `npm run daemon` | Loop infinito, scan a cada N min (`--interval`, padrão 30) — **modo recomendado**. |
| `npm run scan-group` | Escaneia um grupo específico (`--groupId`). |

### 3.3 Fluxo do Job (engenharia reversa de `commands/scan.ts` + `scraper/core.ts`)
1. **Login** GramJS via `TELEGRAM_SESSION` (string salva; primeiro login interativo gera ela).
2. Lê config de grupos da tabela `telegram_scraper_settings` (`groups_config`, `size_limit_mb`).
3. Para cada grupo: `getMessages(limit:500)`, filtra pela janela de tempo, **agrupa por remetente**.
4. Filtra docs elegíveis: extensões `.stl/.3mf/.zip/.rar/.7z`. Pula:
   - arquivos acima de `size_limit_mb` (configurável; **atualmente 450MB**) — hoje faz `continue` (pula). ⚠️ **Decisão #4: deveria ir para `pending_approval`, não pular** — regressão a corrigir;
   - arquivos em `user_deleted_files`;
   - já presentes em `telegram_indexed_stls` (file_name+size);
   - já em job ativo (`telegram_scraper_jobs` com status em andamento).
5. **`core.processGroupMessages`**:
   - Baixa **fotos** → sobe pro bucket `portfolio` do Supabase Storage → gera `publicUrl`.
   - **Dedup perceptual** (pHash + distância de Hamming ≤10): ignora fotos banidas (`telegram_banned_images`), duplicatas no mesmo arquivo e fotos que pertencem a outro arquivo (cache cross-file persistido em `.temp/photo_hash_cache.json`).
   - Associa fotos ao doc por **mesmo remetente + janela de tempo** (30s antes → 5s depois, máx 5 fotos). Arquivo **sem foto é rejeitado** (não cria job).
   - Cria job (`status: downloading_file`) → **baixa o STL** (timeout sem-progresso).
   - **HOJE (legado):** `VaultUploader.upload` envia o binário ao canal Vault via `sendFile`. **ALVO (decisão 22/06):** trocar por **`PUT` no Cloudflare R2** (S3 API) → guardar a **chave do objeto R2** no índice. O Vault deixa de ser usado.
   - Calcula `sha256` do arquivo → checa duplicata/soft-delete por hash → **insere em `telegram_indexed_stls`** (alvo: campo `r2_object_key` no lugar de `telegram_message_id`; `status: completed`). Apaga o temp local.
6. Salva cache de hashes + atualiza `last_heartbeat` em `telegram_scraper_settings` (o admin do studio observa via Supabase Realtime).

### 3.4 Integração externa
- **Leitura (Telegram):** userbot lê os grupos de origem (precisa estar logado e ser membro) — **mantém-se** (é assim que os arquivos entram).
- **Armazém (ALVO = Cloudflare R2):** `PUT` via S3 API (`@aws-sdk/client-s3`) num bucket privado. R2 é o armazém-mestre **e** a entrega.
- **Telegram Vault (`-1005007999266`):** **a ser aposentado.** Era backup/repositório; o R2 assume esse papel. Pode opcionalmente ser mantido como backup secundário grátis.
- **Download para o usuário:** o studio gera uma **presigned URL** do R2 (não há proxy nem MTProto no caminho) — ver §6.

---

## 4. Guia de Setup Local

### 4.1 Studio (`lb-creative-studio`)
```bash
cd lb-creative-studio
npm install
cp .env.local.example .env.local   # preencher Supabase + Stripe
npm run dev                          # http://localhost:3000
```
Variáveis (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, chaves Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`), e — se o proxy de download existir — `TELEGRAM_PROXY_URL` + `TELEGRAM_PROXY_API_KEY`.

Webhook Stripe local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4.2 Scraper (`lb-creative-scrapper`)
```bash
cd lb-creative-scrapper
npm install
cp .env.example .env                 # preencher Telegram + Supabase (+ R2 no alvo)
npm run scan                         # primeiro login pede telefone/código → salva TELEGRAM_SESSION
npm run daemon                       # produção local
```
Variáveis hoje (`.env`): `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, `TELEGRAM_VAULT_CHANNEL_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Na arquitetura-alvo: **remover** `TELEGRAM_VAULT_CHANNEL_ID` (Vault aposentado) e **adicionar** R2 — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. (O `.env.example` ainda lista `VAULT_URL`/`VAULT_CREDENTIALS`/`SCRAPER_FILE_SIZE_LIMIT_MB` que **não são usados pelo código** — ver §7.)

> ⚠️ Os scripts `start.sh`/`stop.sh`/`ecosystem.config.js` do **studio** ainda tentam subir o scraper via PM2 a partir de `./telegram-scraper` — essa pasta **não tem mais código**. Esses scripts estão obsoletos (§7).

---

## 5. Deploy & Banda (quando o Studio for à web)

**Topologia recomendada:** Studio na **Vercel**, Supabase gerenciado, Scraper continua **100% local** (daemon no Mac).

### 5.1 De onde vem a banda (arquitetura-alvo com R2)
| Tipo de tráfego | Origem | Conta contra |
|-----------------|--------|--------------|
| HTML/JS/SSR do site | Vercel | Vercel bandwidth (free: 100GB/mês) |
| **Download do binário STL** | **Cloudflare R2** (presigned URL, direto pro usuário) | **R2 egress = GRÁTIS** ✅ |
| Thumbnails/fotos dos STLs | Supabase Storage (bucket `portfolio`) — alvo: migrar pra R2 também | Supabase egress (free: 5GB/mês) → some ao migrar |
| Upload na ingestão | Internet do Mac → R2 (`PUT`) | Banda de casa do dono (1x por arquivo) |

### 5.2 Análise
- Com R2, o **download dos arquivos pesados custa zero de banda** (egress grátis) e **não toca a máquina do dono**. Resolve custo **e** disponibilidade de uma vez.
- Custo recorrente do R2 = **só armazenamento** (~US$0,015/GB/mês; 10GB grátis). Ex.: 100GB ≈ US$1,50/mês. Operações de escrita: 1M/mês grátis.
- Sobra um gargalo menor: **thumbnails ainda no Supabase Storage** (free 5GB egress/mês). Migrar as imagens pro R2 também elimina esse ponto (Fase 3).

### 5.3 Recomendações
1. **STLs no R2** (decisão 22/06) — bucket privado, download via presigned URL. É o núcleo da arquitetura web.
2. **Migrar thumbnails pro R2** também (mesma conta, egress grátis) — encerra a dependência do egress do Supabase.
3. Gerar **thumbnails reduzidos** (~400px) no scraper em vez da foto original — corta storage e tráfego.
4. Lazy-load + paginação na grade (já há `.range()` — manter).
5. **Plano free do Supabase pausa o projeto após 7 dias de inatividade** e limita DB a 500MB — para beta ok; produção real provavelmente exige Pro (US$25).

---

## 6. 🔴 Estado Atual: download quebrado · ✅ Solução decidida: R2

### 6.1 O problema (legado)
O studio (`api/telegram/download`) e a moderação (`api/telegram/jobs`) foram escritos esperando um **proxy HTTP** em `TELEGRAM_PROXY_URL` (`.env.local` → `http://localhost:5001`) que exporia `/download?message_id=`, `/approve`, `/cancel`, `/retry`.

**Esse proxy não existe mais.** Após a separação:
- A pasta interna `telegram-scraper/` (que continha o proxy) foi **esvaziada**.
- O `lb-creative-scrapper` é CLI/daemon e **não sobe proxy de download**. Seu `src/server.ts` (Express, porta 3001) responde **`501`** em tudo.
- Há **mismatch de porta** (studio 5001 / legado 5000 / Express 3001).

**Consequência:** hoje o usuário **não baixa STL** (fallback placeholder ou erro 502).

### 6.2 A solução (decidida 22/06/2026 — não usar proxy)
> ⚠️ **Importante:** o link do Telegram **não serve** para entregar arquivos a usuários (canal privado exige login; mesmo público abre o app, não baixa direto; Bot API limita a 20MB). Telegram é backup, **não** CDN.

**Não vamos recriar o proxy.** Em vez disso (ver §3.3/§3.4 e a spec):
- O scraper, na ingestão, faz **`PUT` do binário no Cloudflare R2** (bucket privado) e guarda a chave no índice.
- O `api/telegram/download` deixa de chamar proxy: **valida sessão → debita crédito (custo dinâmico, §8.7) → gera presigned URL do R2 → retorna ao cliente**, que baixa direto do R2 (egress grátis, sem tocar a máquina do dono).
- Moderação (`approve/cancel/retry`): passa a operar sobre `telegram_scraper_jobs` no Supabase (o scraper consome a fila), sem proxy HTTP.

**Spec:** `docs/superpowers/specs/2026-06-21-download-proxy-design.md` (reescrita para "entrega via R2").
**Pré-requisito:** criar conta Cloudflare + bucket R2 + API token (Fase 1 do plano).

---

## 7. Relatório de Limpeza & Inconsistências

### 7.1 Resquícios do scraper dentro do `lb-creative-studio`
| Item | Situação | Ação |
|------|----------|------|
| `telegram-scraper/` (pasta interna) | Esvaziada (só `.env`, `logs`, `node_modules`, `.temp`). **`.env` contém credenciais reais.** | **Remover a pasta inteira.** |
| `ecosystem.config.js` | PM2 aponta pra `./telegram-scraper` (sem código) | Remover (scraper roda no outro repo). |
| `start.sh` / `stop.sh` | Sobem/param o scraper via PM2 | Remover ou reescrever só pro Next.js. |
| `SCRAPER_SETUP.md` | Documenta PM2 do scraper interno (obsoleto) | Remover/arquivar. |
| Dep `cheerio` | **0 usos** em `src/` (makerworld usa fetch+JSON) | Remover do `package.json`. |
| Dep `dotenv` | Sem uso em `src/` (Next.js carrega `.env` nativo) | Remover. |
| Scripts de migração na raiz | `migrate.mjs`, `migrate-direct.mjs`, `run-migration.js`, `run_migration.js`, `check-migration.mjs`, `check_db.js`, `direct-sql.sh`, `seed-data.mjs`, `verify-seed.mjs` | Mover para `scripts/` ou remover (migrations hoje vivem em `supabase/migrations/`). |
| `package.json` name `"scratch"` | Nome boilerplate herdado | Renomear para `lb-creative-studio`. |
| `RUN_MIGRATION.md` versionado | É o único arquivo "de credencial-ish" rastreado (doc) | Revisar conteúdo. |

### 7.2 Resquícios do studio dentro do `lb-creative-scrapper`
| Item | Situação | Ação |
|------|----------|------|
| `.env.local` | **Cópia integral do `.env.local` do studio** (Stripe, anon key, proxy) — nada disso é usado pelo CLI | Remover. |
| `src/app/`, `components/`, Next.js, `next.config.ts`, `postcss.config.mjs` | Dashboard web herdado; redundante com o admin do studio | Avaliar remoção (CLI não precisa). |
| `src/server.ts` (Express, 501) | Stub morto | Remover ou implementar de verdade (ver §6). |
| Deps `express`, `framer-motion`, `radix-ui`, `next`, `next-themes`, `jimp`, `tailwind-merge`, `@vitejs/plugin-react`, `vite` | Maioria é do dashboard web/UI, não do CLI | Enxugar pra dependências reais do scraper (`telegram`, `@supabase/supabase-js`, `yargs`, `dotenv`, hashing). |
| `src/check-*.ts`, `debug-*.ts`, `test-group.ts`, `clean*.ts`, `cleanup-*.ts`, `check-meshy.ts` | Scripts ad-hoc de debug na raiz de `src/` | Mover para `scripts/` ou remover. `check-meshy.ts` sugere integração Meshy abandonada. |
| `.env.example` campos `VAULT_URL`, `VAULT_CREDENTIALS`, `SCRAPER_FILE_SIZE_LIMIT_MB`, `TARGET_GROUPS` | Não lidos por `config.ts` (grupos vêm do banco; limite vem do banco) | Corrigir `.env.example` pra refletir o que o código realmente usa. |

### 7.3 Documentação desatualizada (corrigir após este doc)
- `README.md` e `PROJETO.md` ainda dizem que o scraper vive em `telegram-scraper/` e que o proxy roda na **5001** — falso.
- `docs/DEEP_DIVE_2026-06.md` afirma "scraper migrado, **sem Express server, sem portas abertas**" — falso (há `server.ts` Express + Next.js na 3001).
- Divergência de "moderação de arquivos > 1.5GB": o scraper novo **pula** arquivos acima de `size_limit_mb` (750MB) em vez de mandar para `pending_approval`. O fluxo de moderação por tamanho descrito nos docs **não existe** no código atual.

### 7.4 🔐 Segurança (alta prioridade)
- **Segredos reais em arquivos locais** (não versionados — `.gitignore` cobre `.env*`, bom): `SUPABASE_SERVICE_ROLE_KEY`, chaves Stripe de teste, `TELEGRAM_BOT_TOKEN`, e principalmente o **`TELEGRAM_SESSION`** (login completo da conta pessoal do dono — se vazar, é sequestro de conta). `.mcp.json` tem `sb_secret_…` e está no `.gitignore`.
- **Recomendação:** rotacionar a `SUPABASE_SERVICE_ROLE_KEY` e a `TELEGRAM_SESSION` por precaução, já que foram copiadas entre repositórios e expostas em vários `.env`. Nunca commitar; considerar um gerenciador de segredos.
- ✅ **Metadados Stripe reconciliados** (23/06): `checkout/route.ts` envia `{userId, planId, credits, kind, planTier}`; `webhooks/stripe/route.ts` consome `{userId, credits, kind, planTier}`. Bug original resolvido.
- ✅ **Webhook endpoint criado** (23/06): configurado no Stripe Dashboard → produção Vercel. `STRIPE_WEBHOOK_SECRET` deve estar nas env vars do Vercel (nunca no código ou docs).
- ⚠️ O bloco de fallback em `addCreditsAtomic` ainda tem `update` sem `.eq()` — código morto, remover num refactor.

---

## 8. Decisões do Dono (respondidas em 21/06/2026)

1. **Entrega de download:** ✅ **DECIDIDO — Cloudflare R2 (sem proxy):** o binário vai pro R2 na ingestão; o studio entrega via **presigned URL**. **Nada passa pela máquina do dono** (que só faz ingestão). O **Telegram Vault é aposentado** (R2 é o armazém-mestre). A pasta vazia `telegram-scraper/` do studio deve ser **deletada**. Detalhes: §6.2 + spec `docs/superpowers/specs/2026-06-21-download-proxy-design.md`. *(Substitui a antiga opção "a/proxy local" — descartada porque colocava o download na máquina do dono, o que ele não quer.)*
2. **Metadados Stripe:** ✅ **migrar para Stripe real agora** (o mock era só o passado). ⚠️ **Bug confirmado a corrigir:** `checkout` grava `metadata={userId,planId,credits}` mas o webhook espera `metadata.type`+`metadata.itemId` — no fluxo real o webhook **não creditaria**. Reconciliar metadados entre `checkout/route.ts` e `webhooks/stripe/route.ts` é pré-requisito da migração.
3. **Dashboard do scrapper:** ✅ **manter** o frontend Next.js do scrapper por enquanto. **Depois** remover o front de scraper que está dentro do studio (`dashboard/scraper-monitor`, `ScraperMonitor`, e parte do `ScraperTab`), consolidando o monitoramento no próprio scrapper.
4. **Moderação por tamanho:** ✅ arquivos **acima** do limite configurado **devem ir para aprovação manual** (`pending_approval`), **não pular**. → restaurar esse fluxo no scrapper novo (regressão da separação).
5. **Limite de tamanho:** é **configurável** via `telegram_scraper_settings.size_limit_mb`; valor atual = **450MB**. Docs antigos (750MB/1.5GB) estão errados.
6. **Meshy (`check-meshy.ts`):** ✅ **lixo** — remover.
7. **Custo de download:** ✅ deve ser **dinâmico via `feature_costs` por plano**, não `cost=1` hardcoded. → implementar lookup no `api/telegram/download`.
8. **Imagens/CDN (Cloudflare/R2):** ✅ topa, **mas só depois** dos ajustes gerais e de estabilizar. Nem tem conta Cloudflare ainda. → adiar para o fim do roadmap.

---

## 9. Plano de Limpeza Sugerido (ordem)
1. 🔐 Rotacionar `SERVICE_ROLE_KEY` + `TELEGRAM_SESSION`; remover `telegram-scraper/.env` e a pasta inteira do studio.
2. Resolver o proxy de download (Open Question #1) — é o blocker funcional nº1.
3. Studio: remover `ecosystem.config.js`, `start.sh`, `stop.sh`, `SCRAPER_SETUP.md`, deps `cheerio`+`dotenv`, renomear `package.json` name, mover scripts de migração soltos.
4. Scraper: remover `.env.local`, `server.ts`, frontend Next.js (se virar CLI puro), enxugar deps, mover scripts de debug.
5. Reconciliar metadados Stripe (Open Question #2) e remover código morto do webhook.
6. Atualizar `README.md` / `PROJETO.md` / `DEEP_DIVE` para a realidade pós-separação (ou apontá-los para este arquivo).
7. Pré-beta: CDN/R2 para imagens + thumbnails reduzidos.
```
