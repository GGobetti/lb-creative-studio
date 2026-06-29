# Design: STL Bundling com Portfolio Persistente

**Data:** 29 de Junho de 2026  
**Versão:** 1.0  
**Status:** ✅ Aprovado para implementação  
**Escopo:** Feature de "comprar um STL = desbloqueia todos os relacionados permanentemente"

---

## 1. Objetivo

Quando um usuário **compra/baixa um STL** (seja pai ou filho), todos os STLs relacionados do mesmo grupo ficam **desbloqueados permanentemente** no portfolio pessoal. Isso resolve o problema de precificação justa (não cobrar dobrado por partes de um modelo).

**Exemplo:**
- Usuário compra "Personagem - Corpo" (150 créditos)
- Sistema desbloqueia automaticamente: "Personagem - Cabeça", "Personagem - Braços" (filhos)
- Usuário agora tem acesso permanente aos 3 STLs

---

## 2. Requisitos Funcionais

### 2.1 Aquisição Permanente
- Quando STL é baixado → marcar em `user_acquired_stls` (novo)
- Relação é **bidireccional**: baixar pai OR filho desbloqueia todos do grupo
- Relação é **direta apenas**: sem transitivo (avós não se aplicam)
- Persistência: uma vez desbloqueado, **nunca expira** (diferente de crédito efêmero)

### 2.2 Portfolio Segregado
- Nova aba no dashboard: **"Meu Portfolio"**
- Dois sub-grupos:
  - **"Importados Makerworld"** (source='makerworld', do sistema existente)
  - **"Comprados STL Search"** (source='stl_search', novo)
- UI mostra: thumbnail, título, data de aquisição, botão "Baixar novamente" (sem custo)

### 2.3 Indicador Visual no Marketplace
- Cards de STL no marketplace mostram badge: **"Você já tem este"** se usuário tem acesso
- Botão muda: "Comprar X créditos" → "Baixar (desbloqueado)"
- Clique em "Baixar" gera presigned URL sem débito

### 2.4 Segurança (RLS Automática)
- Ninguém vê STLs adquiridos de outro usuário
- Download só funciona se `user_id` em `user_acquired_stls` (RLS valida)
- Admin vê tudo (policy `is_admin()`)

### 2.5 Sem Limites de Estratégia
- Criador pode ligar 10 STLs baratos a 1 caro → válido
- Não há limite de "filhos por pai" ou validação de preço justo
- É estratégia legítima de bundling

---

## 3. Arquitetura de Dados

### 3.1 Nova Tabela

```sql
CREATE TABLE public.user_acquired_stls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stl_id UUID NOT NULL REFERENCES public.telegram_indexed_stls(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('stl_search', 'makerworld')) DEFAULT 'stl_search',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices para performance (50k STLs, usuários sem limite)
  UNIQUE(user_id, stl_id)
);

CREATE INDEX idx_user_acquired_stls_user_id 
  ON public.user_acquired_stls(user_id);

CREATE INDEX idx_user_acquired_stls_user_stl 
  ON public.user_acquired_stls(user_id, stl_id);

CREATE INDEX idx_user_acquired_stls_source 
  ON public.user_acquired_stls(user_id, source);
```

### 3.2 VIEW com RLS

```sql
CREATE OR REPLACE VIEW public.vw_user_stl_portfolio AS
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

CREATE POLICY "vw_user_stl_portfolio: own view"
  ON public.vw_user_stl_portfolio FOR SELECT
  USING (auth.uid() = user_id);
```

### 3.3 RLS em user_acquired_stls

```sql
ALTER TABLE public.user_acquired_stls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_acquired_stls: own all"
  ON public.user_acquired_stls FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "user_acquired_stls: admin all"
  ON public.user_acquired_stls FOR ALL
  USING (public.is_admin());
```

### 3.4 Modificação em pricing_plans (futuro)

Para suporte a "planos com biblioteca incluída":

```sql
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS includes_stl_library BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_stl_library_downloads INT DEFAULT NULL;
```

(Opcional por agora, já que sistema usa créditos)

---

## 4. Fluxo de Funcionamento

### 4.1 User Clica "Baixar STL"

```
1. Frontend verifica: user_id já tem stl_id em user_acquired_stls?
   (Query com RLS automático)
   
   ├─ SIM → Mostra badge "Você já tem este"
   │        Botão: "Baixar (desbloqueado)"
   │        Clique → gera presigned URL (sem débito)
   │
   └─ NÃO → Mostra preço: "150 créditos"
            Botão: "Comprar agora"
            Clique → abre modal de créditos

2. Se SEM ACESSO → Modal de Créditos
   - Valida se user tem créditos suficientes
   - POST /api/download-stl { stlId }
   - Backend processa (ver seção 4.2)
   
3. Se COM ACESSO → Presigned URL direto
   - GET /api/download-stl?stlId=X
   - Backend valida RLS + gera URL
   - Não debita nada
```

### 4.2 Backend: Processa Compra

```typescript
// POST /api/download-stl

1. Auth: válida usuário autenticado
2. Valida: STL existe? User tem créditos suficientes?
3. Calcula grupo:
   - Se STL tem parent_id → pai + todos os filhos
   - Se STL é pai → ele + todos os filhos
4. Transaction (atômico):
   a. Desconta créditos em profiles.credits
   b. INSERT INTO user_acquired_stls (user_id, stl_id, source='stl_search')
      - Insere STL + pai + todos os irmãos (se aplicável)
   c. Log em transactions table
   d. Incrementa download_count em telegram_indexed_stls
   e. Log em telegram_downloads_history
5. Gera presigned URL (R2)
6. Retorna ao frontend
```

**Idempotência:** UNIQUE constraint em `(user_id, stl_id)` evita duplicatas se query retornar

---

## 5. Fluxo de UI/UX

### 5.1 Marketplace (STL Search) — Mudanças Mínimas

**Card do STL:**
```
┌────────────────────────────┐
│ [Thumbnail]                │
├────────────────────────────┤
│ "Personagem - Corpo"       │
│ Por: @creator_name         │
│                            │
│ ✅ Você tem este!          ← Badge (se acquired)
│ (ou vazio se sem acesso)   │
│                            │
│ 150 créditos               │
│ [Comprar] ou [Baixar]      │
└────────────────────────────┘
```

**Lógica de botão:**
- Se em `user_acquired_stls` → "Baixar (desbloqueado)"
- Se não → "Comprar X créditos"

### 5.2 Dashboard → Nova Aba "Meu Portfolio"

```
Dashboard
├─ Home
├─ STL Search
├─ Gaming Lab
├─ Billing
├─ **Meu Portfolio** ← NOVO
│   ├─ "Importados Makerworld" (source='makerworld')
│   │   └─ Grid de STLs
│   │
│   └─ "Comprados STL Search" (source='stl_search')
│       └─ Grid de STLs
│           ├─ Thumbnail
│           ├─ Título
│           ├─ "Adquirido em: 25 Jun 2026"
│           └─ [Baixar novamente]
│
└─ Perfil
```

---

## 6. Segurança

| Aspecto | Mecanismo |
|---------|-----------|
| **Acesso não-autorizado** | RLS em `user_acquired_stls`: usuário só vê seus STLs |
| **Download sem permissão** | Backend valida `user_id` em `user_acquired_stls` antes de gerar URL |
| **Race condition** | UNIQUE constraint + transaction atômico |
| **Reparação de dados** | Se duplicata inserir, CONFLICT ignora (idempotente) |
| **Admin audit** | Admin vê toda tabela (policy `is_admin()`) |

---

## 7. Performance (50k STLs, usuários sem limite)

| Query | Tempo | Índice |
|-------|-------|--------|
| "User tem STL X?" | ~1ms | `(user_id, stl_id)` |
| "Listar portfolio paginado (20/página)" | ~10ms | `user_id` |
| "Calcular grupo (pai + 10 filhos)" | ~5ms | `parent_id` em `telegram_indexed_stls` |
| "INSERT 10 STLs ao grupo" | ~20ms | Bulk insert |

**Paginação:** Se user tem 1000+ STLs, UI mostra 20 por página (já existe em STL Search)

---

## 8. Integração com Sistema Existente

### 8.1 Compatibilidade com Créditos
- ✅ Usar campo `profiles.credits` existente
- ✅ Log em `transactions` existente
- ✅ Validação de créditos idêntica

### 8.2 Compatibilidade com Stripe
- ✅ Webhook `/functions/v1/stripe-sync` já existe
- ✅ Ao confirmar pagamento (invoice.paid), inserir em `user_acquired_stls`
- ✅ Não quebra upgrade/downgrade de planos

### 8.3 Compatibilidade com Gamificação
- ✅ Créditos ganhos em games podem ser usados para comprar STLs
- ✅ XP não é afetado

---

## 9. Casos de Teste

| Caso | Esperado | Validação |
|------|----------|-----------|
| Compra pai de 3 filhos | Todos 3 desbloqueados | Query `user_acquired_stls` retorna 4 |
| Compra filho quando pai já tem | Nada novo (UNIQUE constraint) | Sem erro, sem duplicata |
| Re-downloa filho já adquirido | Sem débito, presigned URL direto | RLS vê em acquired_stls |
| Admin vê todos | Sem RLS | Policy `is_admin()` ignora filter |
| User de outro vê portfolio | Erro/vazio | RLS retorna 0 rows |

---

## 10. Roadmap de Implementação

**Fase 1: Backend (Core)**
- [ ] Migration `_create_user_acquired_stls.sql`
- [ ] Função RPC `acquire_stl_bundle()` (atômico)
- [ ] Modificação em `/api/download-stl` (check acquired_stls)
- [ ] Tests: segurança, idempotência

**Fase 2: Frontend (UI)**
- [ ] Badge "Você tem este" em STL card
- [ ] Indicador visual no botão
- [ ] Nova aba "Meu Portfolio"
- [ ] Paginação em portfolio

**Fase 3: Analytics (Futuro)**
- [ ] Dashboard para criadores: "STLs desbloqueados via bundling"
- [ ] Métrica de ROI por grupo

---

## 11. Decidido vs Explorável

✅ **Decidido (não muda):**
- Relação bidireccional (pai ou filho = todos desbloqueados)
- Permanente no BD
- Apenas pai-filho direto (sem transitivo)
- Sem limite de estratégia

🔄 **Explorável (depois):**
- Limit de STLs/mês nos planos Pro/Max
- Expiração automática (não previsto agora)
- Compartilhamento de bundle entre usuários (não previsto)
- Preço dinâmico baseado no tamanho do grupo (não previsto)

---

## Aprovação Técnica

- ✅ Schema: simples, normalizado, com RLS
- ✅ Performance: O(log n) com índices certos
- ✅ Segurança: RLS automática, sem race conditions
- ✅ Integração: compatível com sistema atual (créditos, Stripe, games)
- ✅ UX: mudanças mínimas, intuitivo

**Pronto para implementation plan.**
