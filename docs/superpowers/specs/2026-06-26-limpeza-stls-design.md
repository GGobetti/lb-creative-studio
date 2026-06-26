# Spec: Limpeza e Normalização do Banco de STLs

**Data:** 2026-06-26  
**Status:** Aprovado

---

## Contexto

O banco possui 1.147 STLs em `telegram_indexed_stls`. Dois problemas identificados:

1. **247 STLs sem foto** — impossíveis de revisar ou exibir com qualidade. Sem engajamento (0 favoritos, 1 download, 5 revisados, 53 com categoria).
2. **Nomes sujos** — filenames vindos do Telegram carregam @canais, hashes aleatórios, `+` no lugar de espaço, prefixos de criadores, sufixos redundantes e termos em outros idiomas sem tradução.

---

## Módulo 1 — Soft Delete de STLs sem foto

### Objetivo

Remover da plataforma os 247 STLs sem foto de forma reversível. Nenhum dado é apagado permanentemente nesta etapa.

### Alteração de schema

```sql
ALTER TABLE telegram_indexed_stls
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
```

### Comportamento

- STLs com `deleted_at IS NOT NULL` são filtrados em **todos** os queries da plataforma: busca, listing, curadoria normal, download, favoritos, categorização.
- A curadoria admin ganha um filtro **"Lixeira"** que exibe `deleted_at IS NOT NULL` para restauração ou deleção definitiva posterior.
- A marcação inicial popula `deleted_at = now()` para todos os STLs onde `photos = '{}'` e `id != '00000000-0000-0000-0000-000000000000'`.

### Dados afetados

| Situação | Quantidade | Decisão |
|----------|-----------|---------|
| Sem foto, sem engajamento | ~189 | Soft delete imediato |
| Sem foto, com categoria | 53 | Soft delete imediato (categoria preservada no banco) |
| Sem foto, revisados | 5 | Soft delete imediato |
| Sem foto, com download | 1 | Soft delete imediato |

Todos os 247 recebem `deleted_at`. A categoria, tags e metadados são preservados no banco e ficam disponíveis para restauração.

---

## Módulo 2 — Preview de Limpeza de Nomes (xlsx)

### Objetivo

Gerar um arquivo `.xlsx` com sugestão de limpeza de `title` e `file_name` para **todos os STLs ativos**, permitindo aprovação manual linha a linha antes de qualquer alteração no banco.

### Fluxo

```
Script gerar-preview.ts
  → Busca todos os STLs (deleted_at IS NULL)
  → Aplica regras de limpeza em cascata
  → Gera stl-names-preview.xlsx
     └─ Você preenche coluna "aprovar" (sim/não)
        └─ Script aplicar-aprovados.ts lê o xlsx e aplica só as linhas "sim"
```

### Estrutura do xlsx

| Coluna | Descrição |
|--------|-----------|
| `id` | UUID do STL |
| `title_antes` | Título atual |
| `title_depois` | Título sugerido |
| `file_name_antes` | Nome de arquivo atual |
| `file_name_depois` | Nome de arquivo sugerido |
| `tags_adicionadas` | Tags extraídas antes de remover termos do nome |
| `idioma_detectado` | `pt`, `en`, `ru`, `fr`, etc. |
| `traducao_sugerida` | Tradução para PT-BR (apenas quando idioma != pt/en) |
| `aprovar` | Preencher: `sim` ou `não` (padrão vazio) |
| `observacao` | Campo livre para anotações |

### Regras de limpeza (ordem de aplicação)

Aplicadas tanto em `title` quanto em `file_name`:

| # | Regra | Exemplo antes | Exemplo depois |
|---|-------|--------------|---------------|
| 1 | Extrair tags `no_ams` / `NO AMS` / variantes → adicionar à coluna `tags_adicionadas` como `no-ams` | `mario no ams multipart` | `mario multipart` + tag `no-ams` |
| 2 | Extrair tags `multiparts` / `multi parts` / `multipart` → tag `multipartes` | `mario multiparts 3mf` | `mario` + tag `multipartes` |
| 3 | Remover `@canal` (qualquer `@\w+`) | `Captain Mario @STL3DBrasilFree` | `Captain Mario` |
| 4 | Remover hashes de upload `_YYYYMMDD_N_XXXXXX` | `goofy_20260624_1_qxrwnd` | `goofy` |
| 5 | Remover hashes hexadecimais longos (≥10 chars) | `hotwheels_beacb6daa9bc7baf5648` | `hotwheels` |
| 6 | Remover prefixos de criadores conhecidos | `STLflix - Wall Mount - Dragon` | `Wall Mount - Dragon` |
| 7 | Remover sufixo `_stls` | `batman2_stls` | `batman2` |
| 8 | Remover `multiparts3mf` embutido no nome | `...no_ams_multiparts3mf_Silent...` | `...Silent...` |
| 9 | Substituir `+` por espaço | `Road+Runner` | `Road Runner` |
| 10 | Substituir `_` por espaço | `mickey_mouse_vibes` | `mickey mouse vibes` |
| 11 | Remover numeração `(1)`, `(2)` no final | `Tio Patinhas (1)` | `Tio Patinhas` |
| 12 | Remover extensões embutidas no nome (`.3mf`, `.stl`) | `figure.3mf20260119` | `figure 20260119` → já tratado pela regra 4 |
| 13 | Colapsar múltiplos espaços, hífens e travessões | `STLflix   Wall   Dragon` | `Wall Dragon` |
| 14 | Title Case suave (capitaliza apenas primeira letra de cada palavra, exceto artigos) | `HANNIBAL LECTER` | `Hannibal Lecter` |

**Prefixos de criadores a remover (regra 6):**
- `STLflix -`, `STLflix-`
- `3DXM -`, `3DXM-`
- `Whale3D- Studio`, `Whale3D-`
- `YoshStudios`
- `DecorMaster`
- `Aslan3D` (entre parênteses)
- `rtprops` (sufixo)

### Detecção de idioma e tradução sugerida

- Idiomas detectados automaticamente por heurística de caracteres (cirílico → russo, palavras francesas comuns, etc.)
- Para russo e francês: coluna `traducao_sugerida` preenchida com tradução PT-BR via IA (no momento da geração do xlsx)
- Para inglês: sem tradução obrigatória (nomes técnicos em inglês são aceitáveis)

### Scripts

`scripts/stl-cleanup/gerar-preview.ts` — gera o xlsx  
`scripts/stl-cleanup/aplicar-aprovados.ts` — lê xlsx preenchido e faz UPDATE no banco

---

## O que este spec NÃO cobre

- Deleção definitiva (purge) dos STLs na lixeira — decisão futura
- Remoção de arquivos do R2 — não está contemplada, os objetos ficam orphans temporariamente
- Limpeza de tags existentes no array `tags` — fora do escopo desta entrega

---

## Ordem de execução

1. Migration: adicionar coluna `deleted_at`
2. Migration: popular `deleted_at` nos 247 STLs sem foto
3. Código: filtrar `deleted_at IS NULL` em todos os queries da plataforma
4. UI: adicionar filtro "Lixeira" na curadoria admin
5. Script: `gerar-preview.ts` → gera xlsx
6. Revisão manual do xlsx pelo dono
7. Script: `aplicar-aprovados.ts` → aplica aprovados no banco
