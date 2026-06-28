# LB Creative Studio - Roadmap Estratégico

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
