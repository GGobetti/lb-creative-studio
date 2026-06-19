# XP, Badges & Gamification Dashboard — Functional Spec

**Date:** 2026-06-19
**Branch:** sprint-8-xp-badges
**Status:** Approved — ready for implementation planning

---

## Overview

Introduzir um sistema de XP (experiência) separado dos créditos. Usuários ganham XP jogando os mini-games de curadoria. XP acumulado desbloqueia níveis, cada nível libera um badge visual e concede créditos automaticamente. Adicionalmente, o usuário pode resgatar manualmente XP acumulado por créditos a qualquer momento. Streak semanal mede consistência de participação.

---

## Goals

1. Dar ao usuário uma métrica de progressão e prestígio visível (nível + badge).
2. Incentivar retorno recorrente via streak semanal e trilha de níveis.
3. Permitir resgate flexível de XP por créditos (o usuário decide quando).
4. Expor configuração de XP/taxas ao administrador via painel admin.

## Non-Goals

- Leaderboard público entre usuários (fora de escopo nesta sprint).
- Níveis desbloqueando features do produto (apenas créditos nesta versão).
- Push notifications de streak (fora de escopo).

---

## Data Model

### `xp_transactions` — ledger imutável

```sql
CREATE TABLE xp_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type   text NOT NULL,
  -- valores: 'photo-match' | 'tag-detective' | 'category-sort' | 'quality-audit' | 'redemption'
  xp_amount   int  NOT NULL,  -- positivo = ganho, negativo = resgate
  source      text NOT NULL CHECK (source IN ('earned', 'redeemed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX xp_transactions_user_idx  ON xp_transactions(user_id);
CREATE INDEX xp_transactions_date_idx  ON xp_transactions(user_id, created_at);
```

RLS: usuário lê apenas suas próprias linhas; apenas `service_role` / RPCs security-definer inserem.

---

### `xp_levels` — configuração dinâmica de níveis

```sql
CREATE TABLE xp_levels (
  level          int  PRIMARY KEY,
  name           text NOT NULL,
  xp_required    int  NOT NULL,  -- XP acumulado necessário para atingir
  badge_icon     text NOT NULL,  -- emoji ou nome de ícone Lucide
  badge_color    text NOT NULL,  -- classe Tailwind ou hex
  credits_reward int  NOT NULL DEFAULT 0
);
```

Seed inicial:

| level | name             | xp_required | badge_icon | badge_color   | credits_reward |
|-------|------------------|-------------|------------|---------------|----------------|
| 1     | Rookie           | 0           | 🥉         | zinc-400      | 0              |
| 2     | Prototipador     | 500         | 🥈         | blue-400      | 100            |
| 3     | Maker            | 1500        | 🥇         | violet-500    | 250            |
| 4     | Artesão Digital  | 4000        | 🏆         | amber-500     | 500            |
| 5     | Mestre 3D        | 10000       | 💎         | cyan-400      | 1000           |
| 6     | Lenda Criativa   | 25000       | 👑         | yellow-400    | 2500           |

Editável via admin panel — sem hardcode no frontend.

---

### `user_badges` — registro de níveis desbloqueados

```sql
CREATE TABLE user_badges (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level           int  NOT NULL REFERENCES xp_levels(level),
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  credits_awarded int  NOT NULL  -- snapshot do credits_reward no momento
);

CREATE UNIQUE INDEX user_badges_user_level_idx ON user_badges(user_id, level);
```

---

### Alterações em tabelas existentes

**`game_rewards_config`** — adicionar coluna:
```sql
ALTER TABLE game_rewards_config ADD COLUMN xp_per_action int NOT NULL DEFAULT 10;
```

Valores iniciais por jogo:

| game_type      | xp_per_action |
|----------------|---------------|
| photo-match    | 10            |
| tag-detective  | 8             |
| category-sort  | 8             |
| quality-audit  | 15            |

**`xp_config`** — nova tabela de configuração global de XP:
```sql
CREATE TABLE xp_config (
  id                  int PRIMARY KEY DEFAULT 1,  -- singleton
  xp_to_credits_rate  numeric(6,2) NOT NULL DEFAULT 2.0,
  -- 100 XP = 100 / rate créditos (rate=2 → 50 créditos)
  max_redeem_per_day  int NOT NULL DEFAULT 5000,
  updated_at          timestamptz DEFAULT now()
);
```

---

## RPCs (Supabase Functions)

### `award_xp(p_user_id, p_game_type, p_xp_amount)`

1. Lê `game_rewards_config.xp_per_action` para o `p_game_type`.
2. Insere em `xp_transactions` (`source = 'earned'`).
3. Calcula XP total do usuário (sum de `xp_transactions` onde `user_id = p_user_id`).
4. Compara com `xp_levels` para detectar level-up (nível novo não presente em `user_badges`).
5. Se level-up: insere em `user_badges`, incrementa `profiles.credits += credits_reward`.
6. Retorna `{ xp_earned, xp_total, level_up: bool, new_level: int | null, credits_awarded: int }`.

### `redeem_xp(p_user_id, p_xp_to_redeem)`

1. Calcula `xp_available = sum(xp_amount) WHERE user_id = p_user_id` (ledger já inclui negativos).
2. Valida `xp_available >= p_xp_to_redeem` e `p_xp_to_redeem > 0`.
3. Verifica limite diário de resgate via `xp_config.max_redeem_per_day`.
4. Insere transação negativa (`source = 'redeemed'`, `xp_amount = -p_xp_to_redeem`).
5. Calcula créditos = `floor(p_xp_to_redeem / xp_config.xp_to_credits_rate)`.
6. Incrementa `profiles.credits += créditos`.
7. Insere em `transactions` (tabela de créditos existente) para auditoria.
8. Retorna `{ credits_earned, xp_redeemed, xp_remaining }`.

### `get_xp_summary(p_user_id)`

Retorna em uma única query:
- `xp_total` — soma de todos os `xp_amount` (inclui resgates negativos = XP disponível)
- `xp_earned_total` — soma apenas de registros `earned` (XP bruto acumulado histórico)
- `current_level` — nível atual baseado em `xp_earned_total` vs `xp_levels`
- `next_level_xp` — XP necessário para o próximo nível
- `current_streak_weeks` — semanas ISO consecutivas com ao menos 1 registro `earned` contando do presente para trás
- `best_streak_weeks` — maior sequência histórica
- `badges` — array de `user_badges` com join em `xp_levels`

**Nota:** nível é calculado sobre `xp_earned_total` (XP bruto), não sobre `xp_total` (que inclui resgates). Resgatar XP não faz o usuário regredir de nível.

---

## API Routes

### Novos endpoints

**`POST /api/games/award-xp`**
Usado por jogos que ainda não têm rota de API (QualityAudit, TagDetective, CategorySort).
Body: `{ game_type, xp_amount? }` (xp_amount opcional, usa config do banco se omitido).
Retorna resultado de `award_xp`.

**`POST /api/games/redeem-xp`**
Body: `{ xp_to_redeem: number }`.
Retorna resultado de `redeem_xp`.

**`GET /api/games/xp-summary`**
Retorna resultado de `get_xp_summary` para o usuário autenticado.

### Modificações em endpoints existentes

Todos os endpoints de jogo existentes passam a chamar `award_xp` após `record_game_action`:
- `photo-match-answer/route.ts` — adicionar chamada a `award_xp` quando `is_correct`
- `tag-detective-vote/route.ts` — chamar `award_xp` a cada voto inserido
- `category-vote/route.ts` — chamar `award_xp` a cada voto inserido
- `audit-vote/route.ts` — chamar `award_xp` a cada voto

---

## UI Components

### Navbar — `src/components/Navbar.tsx`

Adicionar pill de XP ao lado do pill de créditos existente:
```
[⚡ 340 créditos]  [⭐ 1.240 XP · Maker]
```
- Exibe: XP disponível (após resgates) + nome do nível atual
- Em mobile: oculta nome do nível, exibe apenas `⭐ 1.240`
- Clicar: navega para `/dashboard/profile?tab=xp`
- Dados: lidos do store global (novo campo `xpSummary` em `useConfiguratorStore`)

### Perfil — nova aba "XP & Badges"

Rota: `/dashboard/profile` com tab switcher adicionado.

#### 1. Hero Card de Nível
- Badge grande (ícone + nome + cor do nível)
- Barra de progresso: `XP earned / next_level_xp`
- Linha secundária: `🔥 7 semanas consecutivas`

#### 2. Trilha de Níveis
- Timeline horizontal (scroll em mobile)
- Nível desbloqueado: colorido, exibe data de desbloqueio
- Nível bloqueado: cinza, exibe XP necessário
- Hover/tap: tooltip com `credits_reward` do nível

#### 3. Gráfico de Timeline
- Toggle: **Acumulado** (linha) | **Atividade** (barras)
- Acumulado: eixo Y = XP total, eixo X = datas
- Atividade: barras empilhadas por `game_type` agrupadas por semana; cores distintas por jogo
- Filtro de período: "4 semanas" | "3 meses" | "Tudo"
- Biblioteca: Recharts (já comum em projetos Next.js com Tailwind)

#### 4. Card de Resgate
- Exibe: `XP disponível: 1.240` e taxa atual (`100 XP = 50 créditos`)
- Input numérico + preview de créditos a receber
- Botão "Resgatar" → modal de confirmação → chama `/api/games/redeem-xp`
- Após resgate: atualiza store de créditos + xpSummary

#### 5. Histórico de Badges
- Grid de cards: badge desbloqueada (ícone, nome, data, créditos ganhos)
- Badges não desbloqueadas: exibidas em cinza com cadeado

---

## Admin Panel

### Nova seção: "Configuração de XP"

Adicionar tab/seção no painel admin existente (`/dashboard/admin`).

**Sub-seção 1 — XP por jogo:**
Tabela editável com os campos de `game_rewards_config`:
- `game_type` (readonly)
- `xp_per_action` (input numérico editável)
- `actions_per_reward` e `credits_per_reward` (já existentes, exibir aqui também)

**Sub-seção 2 — Configuração global:**
Formulário com campos de `xp_config`:
- `xp_to_credits_rate` — taxa de conversão (ex: 2.0 = 100 XP vale 50 créditos)
- `max_redeem_per_day` — limite de XP resgatável por dia por usuário

**Sub-seção 3 — Níveis:**
Tabela editável de `xp_levels`:
- `level` (readonly)
- `name`, `xp_required`, `badge_icon`, `badge_color`, `credits_reward` (todos editáveis)

---

## State Management

Adicionar ao `useConfiguratorStore`:
```ts
xpSummary: XpSummary | null
setXpSummary: (summary: XpSummary | null) => void
refreshXpSummary: () => Promise<void>  // chama GET /api/games/xp-summary
```

`refreshXpSummary` é chamado:
- No login / carregamento inicial do dashboard
- Após cada sessão de jogo (quando API retorna `level_up: true` ou ao final de sessão)
- Após resgate de XP

---

## Streak Logic (detalhamento)

```sql
-- Semanas ISO com pelo menos 1 registro earned
WITH weekly_activity AS (
  SELECT DISTINCT DATE_TRUNC('week', created_at)::date AS week_start
  FROM xp_transactions
  WHERE user_id = p_user_id AND source = 'earned'
),
-- Streak atual: semanas consecutivas de trás para frente a partir da semana atual
streak_calc AS (
  SELECT week_start,
         DATE_TRUNC('week', now())::date
           - (ROW_NUMBER() OVER (ORDER BY week_start DESC) - 1) * INTERVAL '7 days'
           AS expected_week
  FROM weekly_activity
)
SELECT COUNT(*) AS current_streak
FROM streak_calc
WHERE week_start = expected_week::date
```

Semana atual (sem atividade ainda) não quebra o streak — só a semana passada sem atividade quebra.

---

## Implementation Sequence

1. **Migrations** — `xp_transactions`, `xp_levels` (seed), `user_badges`, `xp_config`, alter `game_rewards_config`
2. **RPCs** — `award_xp`, `redeem_xp`, `get_xp_summary`
3. **API Routes** — `award-xp`, `redeem-xp`, `xp-summary`; atualizar rotas existentes de jogos
4. **Store** — adicionar `xpSummary` ao `useConfiguratorStore`
5. **Navbar** — pill de XP
6. **Profile page** — aba XP & Badges (Hero → Trilha → Gráfico → Resgate → Histórico)
7. **Admin panel** — seção de Configuração de XP
8. **Testes E2E** — fluxo completo: jogar → ganhar XP → level up → resgatar

---

## Decisions Closed

- **Biblioteca de gráficos:** Apache ECharts via `echarts-for-react`. Suporta gradientes, barras empilhadas animadas e dark mode nativo — visual adequado para dashboard de gamificação. Adicionar dependência `echarts` + `echarts-for-react`.
- **Taxa de conversão XP → créditos:** configurável pelo admin via `xp_config.xp_to_credits_rate`. Sem mínimo de resgate hardcoded — mínimo pode ser definido no painel (campo `min_redeem_xp`, default 100).
- **Limite diário de resgate:** configurável via `xp_config.max_redeem_per_day`. Sem cooldown adicional além do limite diário.

### Adição ao `xp_config`

```sql
ALTER TABLE xp_config ADD COLUMN min_redeem_xp int NOT NULL DEFAULT 100;
```

Admin panel expõe os três campos de `xp_config`:
- Taxa de conversão (`xp_to_credits_rate`)
- Mínimo por resgate (`min_redeem_xp`)
- Limite diário (`max_redeem_per_day`)
