# Plano — Limpeza do Ecossistema & Correções Pós-Separação

> **Data:** 2026-06-21 · **Base:** `ARCHITECTURE.md` (§7, §8) · **Status:** planejamento (nada executado)
> Decisões do dono já incorporadas. Execução só após aprovação.

## Objetivo
Concluir a separação `studio` ↔ `scrapper`, remover débito técnico residual e destravar os fluxos quebrados (download, Stripe), deixando o studio pronto para beta web.

## Princípios
- Fase 0 não muda comportamento (puro cleanup) → pode ir primeiro, sem risco.
- Fases 1+ mexem em comportamento → uma de cada vez, com verificação.
- Cada item referencia arquivo concreto.

---

## Fase 0 — Limpeza Segura (sem mudança de comportamento)

### Studio (`lb-creative-studio`)
- [ ] Deletar a pasta `telegram-scraper/` inteira (vazia, só `.env`+logs+node_modules). **Antes:** confirmar que nada referencia ela.
- [ ] Remover `ecosystem.config.js`, `start.sh`, `stop.sh` (PM2 do scraper interno — obsoletos).
- [ ] Remover/arquivar `SCRAPER_SETUP.md`.
- [ ] `package.json`: renomear `"name": "scratch"` → `"lb-creative-studio"`.
- [ ] Remover deps não usadas: `cheerio` (0 usos), `dotenv` (0 usos em `src/`). Rodar `npm run build` + `tsc --noEmit` depois.
- [ ] Mover scripts soltos da raiz para `scripts/` ou deletar: `migrate.mjs`, `migrate-direct.mjs`, `run-migration.js`, `run_migration.js`, `check-migration.mjs`, `check_db.js`, `direct-sql.sh`, `seed-data.mjs`, `verify-seed.mjs`.
- [ ] Revisar `RUN_MIGRATION.md` (único arquivo "credencial-ish" versionado).

### Scrapper (`lb-creative-scrapper`)
- [ ] Remover `.env.local` (cópia indevida do studio com chaves Stripe que o CLI não usa).
- [ ] Remover `src/check-meshy.ts` (lixo — Meshy abandonado, decisão #6).
- [ ] Mover scripts de debug para `scripts/` ou remover: `check-all-jobs.ts`, `check-config.ts`, `check-in-progress.ts`, `check-jobs-status.ts`, `check_group.ts`, `clean-pending.ts`, `cleanup-duplicate-jobs.ts`, `cleanup-failed-cancelled.ts`, `debug-group-messages.ts`, `debug-group.ts`, `test-group.ts`.
- [ ] Corrigir `.env.example`: remover vars não lidas por `config.ts` (`VAULT_URL`, `VAULT_CREDENTIALS`, `SCRAPER_FILE_SIZE_LIMIT_MB`, `TARGET_GROUPS`); manter só as reais (Telegram + Supabase + Vault). Adicionar `TELEGRAM_PROXY_API_KEY` + `SCRAPER_PROXY_PORT` (ver Fase 1).

### Segurança (fazer cedo)
- [ ] Rotacionar `SUPABASE_SERVICE_ROLE_KEY` e `TELEGRAM_SESSION` (copiadas entre repos).
- [ ] Confirmar `.gitignore` cobrindo todos os `.env*` e `.mcp.json` em ambos os repos.

### Docs
- [ ] Atualizar `README.md` e `PROJETO.md` para apontar a arquitetura real (ou referenciar `ARCHITECTURE.md`).
- [ ] Marcar `docs/DEEP_DIVE_2026-06.md` como histórico (a afirmação "scraper sem Express/sem portas" está incorreta).

**Verificação Fase 0:** `tsc --noEmit` + `npm run build` passam em ambos os repos; site sobe; scraper `npm run scan` ainda roda.

---

## Fase 1 — Destravar o Produto (mudança de comportamento)

### 1A. Entrega via Cloudflare R2 (decisão #1 = R2, sem proxy)
> Spec detalhada: `docs/superpowers/specs/2026-06-21-download-proxy-design.md`
- [ ] **Pré-requisito manual:** criar conta Cloudflare → bucket R2 privado → API token (`Access Key ID`+`Secret`) → anotar `Account ID`.
- [ ] Migration: coluna `r2_object_key` em `telegram_indexed_stls`.
- [ ] Scraper: adicionar `@aws-sdk/client-s3`; trocar `VaultUploader` por `PutObject` no R2; remover `telegram/vault.ts` e `TELEGRAM_VAULT_CHANNEL_ID`; manter login GramJS (leitura dos grupos). Vars R2 no `.env`.
- [ ] Studio `api/telegram/download`: remover proxy/placeholder; novo fluxo = validar sessão → debitar crédito → `getSignedUrl` (presigned ~5min) → retornar `{url}`. Remover `TELEGRAM_PROXY_URL`/`TELEGRAM_PROXY_API_KEY` do `.env.local`.
- [ ] Studio `api/telegram/jobs`: `approve/cancel/retry` passam a operar via `telegram_scraper_jobs` no Supabase (sem proxy).
- [ ] Testar ponta-a-ponta: baixar no studio → presigned URL → arquivo do R2 no navegador → 1 débito; máquina do dono fora do caminho.

### 1B. Stripe real (decisão #2)
- [ ] Reconciliar metadados: `checkout/route.ts` deve gravar `metadata.type` (`'credits'`|`'subscription'`) e `metadata.itemId` que o `webhooks/stripe/route.ts` espera (ou vice-versa — escolher um contrato e alinhar os dois).
- [ ] Remover código morto de `addCreditsAtomic` (o `update({credits: amount})` sem `.eq()`).
- [ ] Testar com `stripe listen --forward-to localhost:3000/api/webhooks/stripe`: compra de pacote + assinatura + renovação (`invoice.paid`) creditam corretamente e são idempotentes.
- [ ] Garantir `STRIPE_MOCK` desligado nos ambientes reais.

### 1C. Custo de download dinâmico (decisão #7)
- [ ] `api/telegram/download`: trocar `cost = 1` por lookup em `feature_costs` conforme o `plan` do usuário (`cost_free`/`cost_pro`/`cost_max`). Definir a `feature_key` do download.

### 1D. Restaurar moderação por tamanho (decisão #4)
- [ ] No scrapper (`commands/scan.ts` + `commands/daemon.ts`): em vez de `continue` quando `fileSize > size_limit_mb`, criar job `status: 'pending_approval'` com fotos/metadados (o studio já tem a UI de aprovar/rejeitar). Confirmar `size_limit_mb` = 450 no banco.

**Verificação Fase 1:** download funciona; Stripe credita no fluxo real; custo respeita plano; arquivo grande aparece na fila de moderação do admin.

---

## Fase 2 — Consolidar Monitoramento (decisão #3)
- [ ] Manter o dashboard Next.js do scrapper (decisão: fica por enquanto).
- [ ] Migrar a visão de monitoramento do scraper para o dashboard do **scrapper** e **remover do studio**: `src/app/dashboard/scraper-monitor/`, `src/components/dashboard/ScraperMonitor.tsx`, e a parte de proxy/monitor do `src/components/admin/ScraperTab.tsx`. Decidir o que continua no admin do studio (ex.: moderação de jobs) vs. o que vai pro scrapper.

---

## Fase 3 — Escala / Estabilidade
> Nota: a conta Cloudflare/R2 já terá sido criada na Fase 1A (para os STLs). Aqui é só estender pras imagens.
- [ ] Migrar **thumbnails/fotos** do Supabase Storage pro R2 (mesma conta, egress grátis) → elimina o gargalo de egress do Supabase free.
- [ ] Gerar thumbnails reduzidos (~400px) no scrapper (hoje sobe a foto original) → corta storage e tráfego.
- [ ] Avaliar upgrade Supabase Pro quando o DB do free (500MB) apertar.

---

## Ordem recomendada
Fase 0 (segura, imediata) → 1B (Stripe, destrava receita) → 1A (proxy, destrava download) → 1C → 1D → Fase 2 → Fase 3.
