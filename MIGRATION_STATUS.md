# 🔄 Status da Migração - Games

## ✅ O que foi feito

### 1. Código implementado
- ✅ Botão "Pular" em todos os 4 games
- ✅ Novo sistema de recompensas (sem acerto/erro)
- ✅ Limites diários configuráveis
- ✅ Painéis de Admin adicionados ao menu

### 2. Migrations executadas
- ✅ `20260617_games_audit_voting_system.sql` - Tabelas criadas
- ✅ `20260617_games_daily_limits.sql` - Tabelas criadas

### 3. Atalhos no Admin
- ✅ Adicionados ao menu admin (em `src/app/dashboard/admin/page.tsx`)
- ✅ "Gestão de Games" aparece no topo

---

## ⚠️ Status do Seed Data

O schema cache do Supabase pode estar causan do atrasos. As tabelas foram criadas mas o seed pode não ter sido inserido automaticamente.

### Se precisar fazer seed manual:

1. Acesse: **Supabase Dashboard > SQL Editor**
2. Cole este SQL:

```sql
-- Recompensas por Game
insert into public.game_rewards_config (game_type, actions_per_reward, credits_per_reward) values
('photo-match',    5,  10),
('tag-detective',  8,  5),
('category-sort',  3,  25),
('quality-audit',  10, 50)
on conflict (game_type) do nothing;

-- Limites Globais
insert into public.game_daily_limits (id, max_actions_per_day, max_credits_per_day)
values ('00000000-0000-0000-0000-000000000000', 100, 500)
on conflict (id) do nothing;
```

3. Clique "RUN"

---

## 🎮 Pronto para usar!

Mesmo sem o seed, o sistema funciona. Acesse:

### Admin Panel
- **URL:** `/dashboard/admin`
- **O que ver:** Seção "Gestão de Games" com 2 atalhos

### Admin de Games
- **URL:** `/dashboard/admin/games`
- **Funcionalidades:**
  - Configurar recompensas por game
  - Configurar limites diários
  - Ver padrões atuais

### Moderação de Auditorias
- **URL:** `/dashboard/admin/audit-moderation`
- **Funcionalidades:**
  - Revisar STLs contestadas
  - Aprovar/rejeitar manualmente
  - Ver votos dos auditores

### Quality Audit (Jogador)
- **URL:** `/dashboard/games/quality-audit`
- **Novo sistema:** Ganha créditos a cada X ações, não por "acerto"

---

## 📋 Checklist

- [x] Código dos games atualizado
- [x] Migrations criadas
- [x] Tabelas criadas no Supabase
- [x] Atalhos adicionados ao admin menu
- [ ] Seed data (pode fazer manual se necessário)

---

## 🔧 Se tiver problemas

1. **Tabelas não aparecem no admin**
   - Recarregue a página (Ctrl+Shift+R)
   - Aguarde 2-3 minutos para cache do Supabase atualizar

2. **Seed data não inserido**
   - Copie o SQL acima e execute manualmente
   - Ou use: `supabase db pull` depois `supabase db push`

3. **Erro ao usar Quality Audit**
   - Verifique se a tabela `quality_audit_votes` existe
   - Verifique se a função `record_game_action` existe

---

## 🚀 Próximos passos

Tudo está pronto! Você pode:

1. Entrar no painel admin
2. Configurar recompensas e limites
3. Testar Quality Audit
4. Revisar auditorias no painel de moderação

**Aproveite!** 🎮
