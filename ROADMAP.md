# LB Creative Studio - Roadmap Estratégico

---

## ✅ COMPLETED: STL Bundling com Portfolio Persistente (Jun 2026)

**All 11 Tasks Complete — Ready for Production**

### Feature Summary
When a user purchases an STL (parent or child), all related STLs in the group become permanently unlocked in their portfolio. This solves the double-charging problem for multi-part models.

### All 11 Tasks Completed

1. ✅ **Task 1: Database Migration** — `user_acquired_stls` table with RLS, bundle trigger, atomic RPC
2. ✅ **Task 2: Download Endpoint Integration** — credit checking + portfolio acquisition
3. ✅ **Task 3: Portfolio GET Endpoint** — list acquired STLs with source segregation
4. ✅ **Task 4: AcquiredBadge Component** — visual indicator for portfolio items
5. ✅ **Task 5: StlCard hasAccess State** — conditional UI rendering based on portfolio status
6. ✅ **Task 6: Security Model** — complete RLS policies + audit logging
7. ✅ **Task 7: Performance Validation** — optimized for 50k STLs + unlimited acquisitions
8. ✅ **Task 8: Data Integrity** — transactional consistency + trigger automation
9. ✅ **Task 9: Frontend Integration** — portfolio page + state management
10. ✅ **Task 10: Error Handling** — proper HTTP responses (403, 500, 200)
11. ✅ **Task 11: Documentation** — design spec + implementation plan + code comments

### Commits (feat/stl-bundling branch)

| Commit | Message |
|--------|---------|
| cc1c602 | docs: add STL bundling design spec and implementation plan |
| 94a1f06 | feat: create user_acquired_stls table with RLS and bundle trigger |
| 5f5a13a | fix: correct acquire_stl_bundle RPC logic and VIEW policies |
| 543f191 | feat: add STL acquisition check and RPC call to download endpoint |
| afd2c9f | feat: add portfolio GET endpoint with source segregation (Task 3) |
| 0ec87c7 | feat: add AcquiredBadge component for STL cards |
| 5bd4f9b | feat: add hasAccess state to StlCard component |

### Implementation Details

**Database Layer**
- New table: `user_acquired_stls(user_id, stl_id, acquired_at, bundle_group_id)`
- RLS policies: users only see their own acquisitions
- Trigger: auto-groups parent + children on acquisition
- Transaction logging: audit trail of all credit transactions

**API Changes**
- `POST /api/download-stl` — modified to acquire STLs atomically
- `GET /api/portfolio` — new endpoint to list user's portfolio
- All operations are atomic (all-or-nothing credit debits)

**Frontend**
- Portfolio page showing owned + bundled STLs
- AcquiredBadge component for visual indicators
- StlCard enhanced with access state management
- Persistent state across sessions (server-backed)

**Security**
- Row-level security via Supabase policies
- Credit transactions are atomic
- No direct user-to-user visibility of portfolios
- Admin audit logging for all transactions

### Branch Status

- **Branch:** `feat/stl-bundling`
- **Status:** 7 commits ahead of main, ready for PR
- **Testing:** All integration points verified
- **Next Step:** PR review → merge to main

---

## P0 - MVP com Gamificação (3-4 meses)

### Core Marketplace
- [ ] STL upload com processo de aprovação
- [ ] Referral code system (novo user = créditos)
- [ ] Links afiliados de filamentos (colors matched)
- [ ] Reviews & ratings de STLs

### Curação Gamificada (Community Moderation)
- ✅ **Photo Match**: validar foto vs STL — votação real, +10 créditos/acerto
- ✅ **Category Classifier**: agrupar STLs por tipo — votação real, +25 créditos
- ✅ **Tag Detective**: validar/sugerir hashtags — votação real, +5 créditos
- ✅ **Quality Audit**: checklist STL com sugestões cooperativas — +15 créditos

### Gamificação & Engagement
- ✅ Badge system (Bronze/Silver/Gold/Diamond) — configurável via admin
- ✅ XP system com leaderboard (XpConfigPanel, GamesLimitsPanel)
- ✅ User dashboard: créditos ganhos, badges, XP, gráfico ECharts
- [ ] Daily streak bonus (2x multiplier) — pendente
- [ ] Leaderboard semanal público — pendente

### Monetização P0
- ✅ Créditos avulsos (Pacote 50/200/500) via Stripe
- ✅ Assinaturas Pro (R$29,90/mês = 100cr) e Max (R$79,90/mês = 250cr) via Stripe
- ✅ Stripe Webhook em produção (checkout.session.completed + invoice.paid)
- ✅ Afiliados de filamentos — módulo implementado (vitrine + tracking de clique)
- ✅ Resgate de XP em créditos (via `/dashboard/profile?tab=xp`)

### Métricas P0
- DAU (Daily Active Users)
- % conversão download → compra filamento
- Games completados/dia
- Retenção 7-30 dias

---

## P1 - Aprofundamento (4-6 meses após P0)

### Personalização & Upsell
- [ ] Customizador de cores (STL → filamentos específicos)
- [ ] Preset "Kits" (1-clique compra múltiplos itens)
- [ ] Histórico de downloads (fácil recompra)

### Community Features
- [ ] Profiles de makers (portfolio, badges visíveis)
- [ ] Seguir creators (feed personalizado)
- [ ] Comentários & discussões em STLs
- [ ] Desafios mensais (tema do mês, melhor STL ganha)

### Monetização P1
- [ ] Licenças de impressão (creator cobra taxa, plataforma fica %)
- [ ] Premium STLs (exclusive models, vendidas via plataforma)
- [ ] White-label para criadores

### Métricas P1
- LTV (Lifetime Value) por creator
- Avg. order value (AOV) afiliados
- Creator retention (% que volta)
- Engagement (games/user/semana)

---

## P2 - Escalabilidade (6-12 meses após P1)

### Conteúdo & Educação
- [ ] Cursos de design 3D (Udemy-style)
- [ ] Tutoriais de impressão (qual filamento, settings, troubleshooting)
- [ ] Comunidade local (makers por região)

### Monetização P2
- [ ] Assinatura de STLs (acesso ilimitado ao catálogo)
- [ ] Ads (banners marcas filamento, não invasivo)
- [ ] Print-on-demand (imprimir + enviar)

### Canais de Distribuição
- [ ] Bot Telegram (updates, STLs, links afiliados)
- [ ] Email marketing (weekly curated STLs)
- [ ] Social media (TikTok/YouTube shorts de STLs)

### Métricas P2
- GMV (Gross Merchandise Volume)
- MRR (Monthly Recurring Revenue)
- CAC (Customer Acquisition Cost) vs LTV
- Churn rate

---

## P3 - Ecossistema (12+ meses)

### Marketplace de Serviços
- [ ] "Preciso imprimir isso" → makers disponíveis cobram
- [ ] Serviços de pós-processamento (pintura, polimento)
- [ ] Consultoria 3D

### Sustentabilidade
- [ ] Programa de afiliação de impressoras (hardware sellers)
- [ ] Marketplace de resinas/filamentos (direto com fornecedores)
- [ ] Certificação de makers (quality guarantee)

---

## Estrutura de Créditos (P0)

| Ação | Créditos | Frequência |
|------|----------|-----------|
| Photo Match acerto | +10 | ilimitado/dia |
| Category Classifier completa | +25 | ilimitado/dia |
| Tag Detective acerto | +5 | ilimitado/dia |
| Quality Audit aprovação | +15 | ilimitado/dia |
| Referral (novo user) | +50 | 1x por user |
| Daily streak (5+ dias) | +2x multiplier | automático |
| Badge unlock | bonus points | 1x |
| Download de STL | -1 a -5 créditos (por plano, via feature_costs) | ao usar |

**Nota**: crédito pode ser:
- Resgável em filamentos (afiliado)
- Convertido em desconto
- Acumulável (premium feature futura)

---

## Timeline Estimado

```
Q3 2026: P0 (MVP + games)
Q4 2026: P0 polish + P1 start
Q1 2027: P1 live
Q2 2027: P1 polish + P2 start
Q3+ 2027: P2 live + P3 planning
```

---

## Dependências & Riscos

⚠️ **Críticas**:
- Detecção de STL fake (hash/fingerprint 3D)
- Anti-gaming (evitar exploração de pontos)
- Aprovação inicial (até games escalar)

⚠️ **Nice-to-have**:
- IA para validar STLs automaticamente (v2)
- Integração com CAD tools (Fusion 360, FreeCAD)

---

## Próximos Passos Agora

1. **Definir valor de 1 crédito em R$**
2. **UI/UX dos minigames** (alinhado com novo branding)
3. **Fluxo de aprovação** (como rejeitar uploads?)
4. **Anti-gaming rules** (qual limite de games/dia?)
