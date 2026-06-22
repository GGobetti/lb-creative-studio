# Spec — Entrega de STLs via Cloudflare R2

> **Data:** 2026-06-21 · **Atualizado:** 22/06/2026 — decisão mudou de "proxy local (opção a)" para **Cloudflare R2 (opção c)**. · **Status:** spec (não implementado)
> Substitui a ideia anterior de proxy HTTP local. **Não haverá proxy** nem MTProto no caminho do download.

## Contexto / Problema
O studio expõe "Baixar STL", mas o binário não está no Supabase. No legado ficava no **Telegram Vault** e o studio dependia de um **proxy local** (`TELEGRAM_PROXY_URL`) que não existe mais → download quebrado (ver `ARCHITECTURE.md` §6).

**Restrições do dono:**
- A máquina local faz **só ingestão** — **não** pode estar no caminho do download do usuário.
- Telegram **não serve** como CDN pública (canal privado exige login; Bot API limita a 20MB). É backup, não entrega.

## Decisão
Usar **Cloudflare R2** (S3-compatível, **egress grátis**) como **armazém-mestre + camada de entrega**. O **Telegram Vault é aposentado**. Custo ≈ só armazenamento (~US$0,015/GB/mês; 10GB grátis; 1M escritas/mês grátis).

## Fluxo-alvo
```
INGESTÃO (scraper local, 1x por arquivo):
   grupo origem (Telegram) → baixa pro disco → PUT no R2 (bucket privado) → indexa no Supabase
                                                              (guarda r2_object_key)

DOWNLOAD (studio web, N vezes):
   usuário clica → valida sessão → debita crédito (custo dinâmico via feature_costs)
                → gera presigned URL do R2 (válida ~5 min) → retorna ao cliente
                → usuário baixa DIRETO do R2 (egress grátis, máquina do dono fora do caminho)
```

## Mudanças no scraper (`lb-creative-scrapper`)
- Adicionar cliente R2: `@aws-sdk/client-s3`, endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`, credenciais R2.
- Em `scraper/core.ts`, **trocar** `VaultUploader.upload(...)` por `PutObjectCommand` (Body = stream do arquivo já baixado). Sugestão de `Key`: `stl/<file_hash>.<ext>` (dedup natural por hash).
- Remover `telegram/vault.ts`, `VaultUploader`, `TELEGRAM_VAULT_CHANNEL_ID` e a lógica de "pular o próprio Vault".
- Manter login GramJS (ainda é preciso pra **ler** os grupos de origem e baixar).
- `.env`: remover `TELEGRAM_VAULT_CHANNEL_ID`; adicionar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

## Mudanças no studio (`lb-creative-studio`)
- `src/app/api/telegram/download/route.ts`: remover toda a parte de `TELEGRAM_PROXY_URL`/fetch do proxy e o fallback placeholder. Novo fluxo: validar sessão → verificar/debitar crédito (custo dinâmico, ver Fase 1C) → gerar **presigned URL** (`@aws-sdk/client-s3` + `getSignedUrl`) a partir de `r2_object_key` → responder `{ url }` (ou redirect 302).
- `src/app/api/telegram/jobs/route.ts`: ações `approve/cancel/retry` deixam de chamar proxy; passam a atualizar `telegram_scraper_jobs` no Supabase (status), e o scraper consome a fila. `reject` já é direto no banco.
- Remover do `.env.local`: `TELEGRAM_PROXY_URL`, `TELEGRAM_PROXY_API_KEY`. Adicionar credenciais R2 (server-side).

## Banco
- `telegram_indexed_stls`: adicionar coluna **`r2_object_key`** (texto). Migrar/aposentar o uso de `telegram_message_id` como ponteiro do arquivo (pode manter por histórico).
- Migration nova em `supabase/migrations/`.

## Pré-requisitos (uma vez, manual)
1. Criar conta Cloudflare → bucket R2 (privado).
2. Gerar API Token R2 → `Access Key ID` + `Secret`.
3. Anotar `Account ID` (endpoint).

## Fora de escopo
- Proxy local (opção a) e VPS (opção b) — descartados.
- Migrar thumbnails pro R2 (vai pra Fase 3 do plano).
- Manter Vault como backup secundário — opcional, não implementar agora.

## Riscos / Pontos de atenção
- **Presigned URL** deve ter expiração curta (~5 min) e bucket **privado**, senão fura o paywall de créditos.
- Ingestão usa banda de casa do dono (download do Telegram + upload pro R2) — aceito (1x por arquivo).
- Definir a `feature_key` do download para o custo dinâmico (Fase 1C).
- GramJS continua necessário no scraper (leitura dos grupos) — não remover o login.

## Critério de pronto
Clicar "Baixar" no studio → presigned URL do R2 → arquivo real chega no navegador → 1 débito (custo por plano) registrado em `transactions`; máquina do dono não é acionada; `approve/cancel/retry` funcionam via banco.
