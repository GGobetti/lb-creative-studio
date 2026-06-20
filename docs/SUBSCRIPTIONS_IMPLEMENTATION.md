# Subscriptions Implementation Guide

## Overview

Sistema de assinaturas recorrentes (planos Pro e Max) com suporte a upgrade/downgrade automático via Stripe.

## Architecture

### Tables

#### `subscriptions`
Rastreia assinaturas ativas de usuários:
- `user_id` - UUID do usuário
- `stripe_subscription_id` - ID da assinatura no Stripe
- `stripe_customer_id` - ID do cliente no Stripe
- `current_plan_id` - ID do plano atual (referencia `pricing_plans.id`)
- `status` - 'active', 'past_due', 'canceled', 'unpaid'
- `period_start` / `period_end` - Datas do ciclo de cobrança atual
- `cancel_at` - Quando a cancelação foi agendada
- `canceled_at` - Quando foi efetivamente cancelada

#### `subscription_changes`
Histórico de mudanças de plano (upgrade/downgrade):
- `user_id` - Quem fez a mudança
- `subscription_id` - Qual assinatura foi alterada
- `from_plan_id` / `to_plan_id` - Planos antes/depois
- `change_type` - 'upgrade' ou 'downgrade'
- `effective_date` - Quando a mudança entra em vigor
- `proration_credit` - Crédito/cobrança adicional do Stripe

### Endpoints

#### POST `/api/subscription-change`
Muda o plano de uma assinatura ativa.

**Request:**
```json
{
  "fromPlanId": 4,  // ID do plano atual
  "toPlanId": 3    // ID do novo plano
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": 123,
    "planId": 3,
    "status": "active",
    "periodEnd": "2026-07-30T23:59:59Z"
  }
}
```

**Lógica:**

1. **Validação:**
   - Usuário deve ter assinatura ativa
   - fromPlanId deve corresponder ao plano atual
   - Ambos os planos devem existir

2. **Upgrade** (plano mais caro):
   - Stripe cobra a diferença IMEDIATAMENTE
   - Crédito aplicado pelos dias já usados do mês
   - Novo plano começa IMEDIATAMENTE
   - `proration_behavior: 'always_invoice'`

3. **Downgrade** (plano mais barato):
   - Não é cobrado nada agora
   - Novo plano entra em vigor no PRÓXIMO CICLO DE COBRANÇA
   - Stripe abate o crédito não utilizado do plano atual
   - `billing_cycle_anchor: 'now'` (começa no próximo ciclo)
   - **Nota:** Downgrade é permitido apenas se for upgrade futuro

4. **Bloqueio de Downgrade:**
   - Max → Pro: BLOQUEADO (precisa cancelar Max primeiro)
   - Pro → Max: PERMITIDO (upgrade)
   - Pro → Free: BLOQUEADO (precisa cancelar Pro primeiro)

### Stripe Webhook Events

O endpoint `/functions/v1/stripe-sync` sincroniza:

#### `customer.subscription.created`
Quando usuário assina um plano:
- Cria entrada em `subscriptions` table
- Vincula ao plano correspondente (`pricing_plans`)

#### `customer.subscription.updated`
Quando assinatura muda (upgrade/downgrade via dashboard ou via API):
- Atualiza `current_plan_id`, `status`, `period_start/end`
- Log automático em `subscription_changes` não incluído (registrado apenas para mudanças via `/api/subscription-change`)

#### `customer.subscription.deleted`
Quando usuário cancela a assinatura:
- Marca status como 'canceled'
- Registra `canceled_at`

## Fluxo de Uso

### Upgrade (Pro → Max)

```
1. User clica "Upgrade para Max" na página de billing
2. POST /api/subscription-change { fromPlanId: 3, toPlanId: 4 }
3. Backend valida e chama Stripe API
4. Stripe:
   - Cobra: (Max_price - Pro_price) * (dias_restantes / dias_mês)
   - Cria invoice
5. Backend:
   - Atualiza subscriptions table
   - Log em subscription_changes (change_type: 'upgrade')
6. Webhook recebe customer.subscription.updated
   - Sincroniza status e datas do novo ciclo

User paga diferença imediatamente e começa a usar Max.
```

### Downgrade (Max → Pro)

```
1. User clica "Fazer downgrade para Pro"
2. POST /api/subscription-change { fromPlanId: 4, toPlanId: 3 }
3. Backend valida (não permite downgrade direto)
4. Resposta: "Precisa cancelar Max primeiro"
5. User clica "Cancelar Pro"
6. POST /api/cancel-subscription { planId: 4, newPlanId: 3 }
7. Stripe:
   - Agenda Max para cancelar no final do ciclo
   - Agenda Pro para começar no próximo ciclo
8. Webhook recebe customer.subscription.updated
   - Registra cancel_at

User mantém Max até final do mês, depois muda para Pro automaticamente.
```

## Configuração no Stripe

### Webhooks Necessários

No Stripe Dashboard → Webhooks, garantir que estão marcados:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Endpoint: `https://{project}.supabase.co/functions/v1/stripe-sync`

## TODO / Future Improvements

1. **Campos em profiles:**
   - `stripe_customer_id` - Para vincular usuário a cliente Stripe
   - `subscription_id` - Cache da assinatura ativa (denormal, mas mais rápido)

2. **Endpoint de cancelamento:**
   - POST `/api/cancel-subscription` com validação de downgrade

3. **UI na página de billing:**
   - Mostrar "Cancelar primeiro" para downgrades bloqueados
   - Agendar novo plano (downgrade futuro)
   - Histórico de mudanças em `subscription_changes`

4. **Sincronização de Stripe → BD:**
   - Adicionar endpoint de sincronização manual (GET `/api/sync-subscriptions`)
   - Para casos onde webhook falhou

5. **Tratamento de falhas:**
   - Retry automático no Stripe se cobrança falhar
   - Notificação ao usuário de `past_due`
   - Fluxo de recuperação antes de cancelamento

## Testing

```bash
# Simular webhook no desenvolvimento com Stripe CLI
stripe trigger customer.subscription.created

# Ver logs do Stripe webhook
stripe logs tail

# Testar endpoint localmente
curl -X POST http://localhost:3000/api/subscription-change \
  -H "Content-Type: application/json" \
  -d '{"fromPlanId": 3, "toPlanId": 4}'
```

## Known Limitations

1. **Cancelamento:** Ainda não há endpoint de cancelamento agendado (TODO)
2. **Proration:** Stripe calcula automaticamente, mas é complexo de debugar
3. **Múltiplas assinaturas:** Sistema assume 1 assinatura ativa por usuário
4. **Billing Portal:** Não está integrado ainda (poderia deixar user gerenciar via Stripe)
