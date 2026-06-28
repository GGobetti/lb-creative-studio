# Setup de Admin de Games

## O que foi implementado

### 1. ✅ Botão "Pular" em todos os games
- Photo Match, Tag Detective, Category Sort, Quality Audit
- Avança sem ganhar créditos

### 2. ✅ Novo sistema de recompensas (sem "certo/errado")
- Quality Audit agora é apenas **categorização comunitária**
- Usuários ganham créditos **a cada X ações** (configurável)
- Sistema de limites diários (máx ações/dia e máx créditos/dia)

### 3. ✅ Painel de Moderação de Auditorias
- Visualizar STLs contestadas (30-70% consenso)
- Aprovar/rejeitar manualmente
- Acessível em: `/dashboard/admin/audit-moderation`

### 4. ✅ Painel Admin de Games (novo!)
- Configurar recompensas por game
- Configurar limites diários globais
- Acessível em: `/dashboard/admin/games`

---

## Migrations a rodar

Você já rodou:
- ✅ `20260617_games_audit_voting_system.sql`

Agora rode:
- **`20260617_games_daily_limits.sql`**

Copie o SQL e rode no Supabase SQL Editor.

---

## Adicionar ao Menu Admin

Para adicionar os atalhos ao menu admin, adicione isto ao topo de `src/app/dashboard/admin/page.tsx`:

```tsx
import { GameAdminShortcuts } from '@/components/admin/GameAdminShortcuts'
```

E no retorno do componente (logo após o header), adicione:

```tsx
{/* Games Admin Shortcuts */}
{profile?.role === 'sysadmin' && (
  <div className="mt-6">
    <GameAdminShortcuts />
  </div>
)}
```

---

## URLs de Acesso

- **Admin de Games:** `/dashboard/admin/games`
- **Moderação de Auditorias:** `/dashboard/admin/audit-moderation`

---

## Como Funciona

### Recompensas

Cada game tem uma configuração:
- **Ações por Recompensa:** a cada X ações, o usuário ganha créditos
- **Créditos por Recompensa:** quanto ele ganha

Exemplo (padrão):
```
Photo Match:     5 ações → 10 créditos
Tag Detective:   8 ações → 5 créditos
Category Sort:   3 ações → 25 créditos
Quality Audit:  10 ações → 50 créditos
```

### Limites Diários

- **Máx. Ações por Dia:** usuário não pode fazer mais que X ações (padrão: 100)
- **Máx. Créditos por Dia:** usuário não pode ganhar mais que X créditos (padrão: 500)

Ambos resetam à meia-noite.

### Quality Audit (sem "correto/errado")

- ✅ Usuário aprova/rejeita STLs
- ✅ Voto é registrado automaticamente
- ✅ Ganha créditos conforme ações
- ❌ Não há feedback "você acertou/errou"
- ❌ Não há validação de acerto

---

## Tabelas no Supabase

Criadas automaticamente pela migration:

1. **game_daily_limits** — Limites globais
2. **game_rewards_config** — Configuração de recompensas por game
3. **game_daily_activity** — Rastreamento de ações por usuário
4. **quality_audit_votes** — Votos do Quality Audit
5. **stl_audit_results** — Resultado final de cada auditoria (consenso 70%)

---

## API Endpoints

### POST `/api/games/audit-vote`
Registra um voto e calcula recompensas

```json
{
  "stl_id": "modelo-123",
  "approved": true,
  "rejection_reason": null,
  "game_type": "quality-audit"
}
```

Resposta:
```json
{
  "success": true,
  "credits_earned": 50,
  "can_continue": true,
  "actions_remaining": 45,
  "credits_remaining": 250
}
```

---

## Próximos passos opcionais

- [ ] Criar página de histórico de atividades do usuário
- [ ] Adicionar notificação quando usuário bate limite diário
- [ ] Analytics de auditorias (quais STLs mais contestadas)
- [ ] Badges/achievements por número de ações
