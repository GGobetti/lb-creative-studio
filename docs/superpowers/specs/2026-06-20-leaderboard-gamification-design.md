# Spec: Leaderboard Semanal + All-Time para Gaming Lab XP

**Data:** 2026-06-20  
**Escopo:** Implementação de ranking real (semanal + all-time) no Gaming Lab  
**Stack:** Next.js 16 · React 19 · Supabase PostgreSQL · Zustand · TailwindCSS v4  
**Status:** Pronto para implementação

---

## 1. Objetivo

Substituir o teaser "Em breve" do leaderboard (`WeeklyLeaderboardTeaser`) por um **ranking funcional e real** com dois períodos:
- **Semanal:** Reset toda segunda-feira, mostra makers mais ativos na semana
- **All-Time:** Ranking acumulado desde o início da plataforma

O leaderboard será acessível em dois pontos:
1. **Card resumido** no GameHub (top 5) — novo `LeaderboardCard`
2. **Página completa** em `/dashboard/games/leaderboard` — nova page com abas

---

## 2. Requisitos Funcionais

### 2.1 Card Resumido (GameHub)

**Localização:** `src/components/games/GameHub.tsx`  
**Componente novo:** `src/components/games/LeaderboardCard.tsx`

**Dados:**
- Top 5 usuários da semana corrente
- Por usuário: nome + XP total + badge atual + streak

**Interações:**
- Clique em "Ver Ranking Completo" navega para `/dashboard/games/leaderboard`
- Loading state enquanto busca dados
- Empty state se 0 usuários tiverem jogado (improvável, mas tratar)

**UX:**
- Mantém estilo glass-panel (Liquid Glass theme)
- Estrutura similar ao atual teaser (Trophy icon + descrição)
- Responsivo mobile

---

### 2.2 Página Completa (`/dashboard/games/leaderboard`)

**Localização:** `src/app/dashboard/games/leaderboard/page.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│  🏆 Ranking Gaming Lab              │
│  [Essa Semana] [All-Time]          │
├─────────────────────────────────────┤
│ Posição | Nome | XP | Badge | Streak│ Games
│ 1.      | João | 5k | Mestre| 15   │ 89
│ 2.      | Maria| 4.2k| Maker| 12   │ 76
│ ...                               │ ...
├─────────────────────────────────────┤
│ ➜ Sua Posição: #847 · 150 XP        │
└─────────────────────────────────────┘
```

**Dados:**
- Top 10 do período selecionado
- Colunas: posição | nome | XP total | badge atual | streak | games completados
- Seção destacada: "Sua Posição" mostrando rank do usuário logado
- Se usuário nunca jogou: mensagem "Você ainda não jogou. Comece um game para entrar no ranking"

**Interações:**
- Toggle entre abas "Essa Semana" / "All-Time"
- Ambas carregam simultâneamente (precache ou abas lazy)
- Dados recarregam a cada 30s (configurable, pode ser SWR)

**i18n:**
- PT-BR, EN, ES via `useTranslation()`

---

### 2.3 API Route: `/api/leaderboard`

**Endpoint:** `GET /api/leaderboard`

**Query Parameters:**
- `period`: `week` | `alltime` (default: `week`)
- `limit`: número de top results (default: 10, max: 100)
- `userId`: (opcional) retorna posição de um usuário específico além do top

**Autenticação:** Usuário autenticado (JWT via Supabase)

**Response (200 OK):**
```json
{
  "period": "week",
  "rankings": [
    {
      "rank": 1,
      "userId": "uuid-1",
      "name": "João Silva",
      "xp": 5000,
      "badge": "Mestre 3D",
      "streak": 15,
      "gamesPlayed": 89
    },
    {
      "rank": 2,
      "userId": "uuid-2",
      "name": "Maria Santos",
      "xp": 4200,
      "badge": "Maker",
      "streak": 12,
      "gamesPlayed": 76
    }
    // ... até limit (default 10)
  ],
  "userPosition": {
    "rank": 847,
    "userId": "current-user-id",
    "name": "Seu Nome",
    "xp": 150,
    "badge": "Rookie",
    "streak": 2,
    "gamesPlayed": 5
  } // null se usuário nunca jogou
}
```

**Error Cases:**
- `400 Bad Request`: período inválido
- `401 Unauthorized`: sem autenticação
- `500 Internal Server Error`: erro na query

---

## 3. Arquitetura Técnica

### 3.1 Data Model

**Tabelas Existentes (sem mudanças):**
- `xp_transactions` — histórico de XP (user_id, xp_amount, created_at, game_type, source)
- `user_badges` — badges desbloqueadas por nível (user_id, level, unlocked_at, credits_awarded)
- `xp_levels` — configuração de níveis (level, name, badge_icon, badge_color, credits_reward)
- `game_user_stats` — estatísticas do usuário (user_id, total_points, current_streak, games_played)
- `profiles` — dados do usuário (id, full_name, email, ...)

**Índices (já existem):**
- `xp_transactions(user_id, created_at)` — filtragem semanal/all-time
- `user_badges(user_id)` — lookup de badge atual
- `game_user_stats(user_id)` — lookup de streak e games_played

**Sem migrations necessárias.** Índices existentes cobrem queries de leaderboard.

---

### 3.2 Query SQL (Abordagem 1 — Simples + Eficiente)

**Pseudo-SQL semanal (período last 7 days):**
```sql
WITH weekly_xp AS (
  SELECT 
    user_id,
    SUM(xp_amount) as total_xp,
    COUNT(*) as game_count
  FROM xp_transactions
  WHERE created_at >= now() - interval '7 days'
    AND source = 'earned'
  GROUP BY user_id
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank,
  p.id as user_id,
  p.full_name as name,
  wxp.total_xp as xp,
  ub.xp_levels.badge_icon as badge,
  gus.current_streak as streak,
  gus.games_played
FROM weekly_xp wxp
JOIN auth.users au ON au.id = wxp.user_id
JOIN profiles p ON p.id = au.id
LEFT JOIN user_badges ub ON ub.user_id = p.id AND ub.level = (
  SELECT MAX(level) FROM user_badges WHERE user_id = p.id
)
LEFT JOIN game_user_stats gus ON gus.user_id = p.id
ORDER BY total_xp DESC
LIMIT 10;
```

**Para all-time:** remover `WHERE created_at >= now() - interval '7 days'`

**Para posição de usuário:** `WHERE user_id = $1` e remover `LIMIT` pra pegar rank

---

### 3.3 Frontend Architecture

**Nova estrutura de componentes:**

```
src/components/games/
├── LeaderboardCard.tsx          (novo, substitui WeeklyLeaderboardTeaser)
│   ├── fetch GET /api/leaderboard?period=week&limit=5
│   ├── renderiza top 5 semanal
│   └── botão "Ver Ranking Completo"
│
└── [página]
    /dashboard/games/leaderboard/page.tsx (novo)
    ├── [week | alltime] tabs
    ├── LeaderboardTable.tsx (componente reutilizável)
    │   ├── renderiza rankings (top 10)
    │   └── column headers: posição | nome | XP | badge | streak | games
    ├── UserPositionCard.tsx (novo)
    │   ├── destaca "Você está em #X"
    │   └── mostra stats do usuário
    └── Empty state: "Comece a jogar para entrar no ranking"
```

**Estado (Zustand):**
- Opção 1: Manter tudo em componentes (simples, sem store)
- Opção 2: Adicionar slice em `xpSlice` do store (reutilizável)
- **Recomendação:** Opção 1 por agora. Dados são buscados via API + SWR/React Query, cacheado por 30s

**Caching:**
- Frontend: SWR com `revalidateOnFocus: false, dedupingInterval: 30000`
- Nenhum cache server-side (sempre fresh, queries são rápidas)

---

## 4. Integração com Componentes Existentes

### 4.1 Substituir `WeeklyLeaderboardTeaser`

**Atual:**
```tsx
// src/components/games/WeeklyLeaderboardTeaser.tsx
// Apenas mostra contagem de makers ativos
```

**Novo:**
```tsx
// src/components/games/LeaderboardCard.tsx
// Mostra top 5 com dados reais
```

**Modificação em `GameHub.tsx`:**
```tsx
// antes:
<WeeklyLeaderboardTeaser />

// depois:
<LeaderboardCard />
```

---

### 4.2 i18n Strings (nova em `src/lib/translations.ts`)

```typescript
export const translations = {
  pt: {
    leaderboard: {
      title: "Ranking Gaming Lab",
      weekTab: "Essa Semana",
      allTimeTab: "All-Time",
      yourPosition: "Sua Posição",
      viewFullRanking: "Ver Ranking Completo",
      noGamesYet: "Você ainda não jogou. Comece um game para entrar no ranking!",
      rank: "Posição",
      name: "Nome",
      xp: "XP",
      badge: "Badge",
      streak: "Streak",
      games: "Games",
      rank_N: "#{rank}",
    }
  },
  en: { /* ... */ },
  es: { /* ... */ }
}
```

---

## 5. Edge Cases & Error Handling

| Cenário | Comportamento |
|---------|---------------|
| Usuário nunca jogou | Mostra mensagem "Comece a jogar", `userPosition: null` |
| Sem dados na semana | Top vazio, mas seção "Sua Posição" ainda aparece se user jogou all-time |
| Erro na API | Toast error + retry button (SWR automático) |
| Usuário sai logado | Dados não atualizam (normal) |
| Mobile < 640px | Tabela collapsa pra cards empilhados (TailwindCSS responsive) |
| Muitos usuários | Performance OK com índices; query ~50-200ms |

---

## 6. Testing Strategy

**Unit Tests:**
- API route: query correctness, edge cases (no games, early week, etc)
- Components: renders correctly with data, loading/error states

**Integration Tests:**
- End-to-end: card no GameHub → clica "Ver Ranking" → página carrega com abas funcionando

**Manual Testing:**
- Week reset: criar games, aguardar segunda para verificar reset
- All-time: comparar acumulado com week
- User position: conferir rank está correto

---

## 7. Deployment & Future Improvements

### 7.1 Rollout
1. Merge branch feature-leaderboard
2. Deploy em produção
3. Monitor performance de `/api/leaderboard` em logs

### 7.2 Melhorias Futuras (Backlog)
- **U8:** Materialized view `leaderboard_cache` com pg_cron refresh (15min)
  - Se bottleneck detectado em produção
  - Migration + cron job + atualizar API pra consultar view
- **U9:** Notificação push "Você subiu pra top 10!" (Supabase Realtime)
- **U10:** Badges especiais por posição (Top 3 semanal = badge 🥇🥈🥉)
- **U11:** Export leaderboard CSV (admin)

---

## 8. Checklist de Implementação

- [ ] Criar `LeaderboardCard.tsx` (top 5 card)
- [ ] Criar página `/dashboard/games/leaderboard/page.tsx`
- [ ] Criar `LeaderboardTable.tsx` (tabela reutilizável)
- [ ] Criar `UserPositionCard.tsx` (seção posição do user)
- [ ] Implementar API route `/api/leaderboard`
- [ ] Adicionar strings i18n
- [ ] Substituir `WeeklyLeaderboardTeaser` por `LeaderboardCard` em GameHub
- [ ] Testar queries (semanal, all-time, user position)
- [ ] Testar edge cases (sem games, mobile, etc)
- [ ] Verificar performance (backend logs)
- [ ] Commit + PR

---

## 9. Referências

- Tabelas XP: `docs/DEEP_DIVE_2026-06.md` (seção Sprints 6-7)
- Migrations aplicadas: `supabase/migrations/20260620_xp_gamification.sql`
- Components existentes: `src/components/games/GameHub.tsx`, `SessionResult.tsx`
- i18n: `src/lib/translations.ts` (PT/EN/ES)
- Store: `src/store/slices/xpSlice.ts`
