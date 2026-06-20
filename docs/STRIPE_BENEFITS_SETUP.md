# Configurando Benefícios de Produtos no Stripe

## Opção 1: Via Script (Recomendado)

### 1. Pegar seus Product IDs

Acesse: https://dashboard.stripe.com/products

Copie os IDs dos produtos (começam com `prod_`)

### 2. Atualizar o script

Edite `scripts/update-stripe-benefits.js` e substitua os `productId`:

```javascript
const updates = [
  {
    productId: 'prod_YOUR_PRO_ID',    // ← Coloque seu ID do Pro
    benefits: benefits.pro,
  },
  {
    productId: 'prod_YOUR_MAX_ID',    // ← Coloque seu ID do Max
    benefits: benefits.max,
  },
]
```

### 3. Rodar o script

```bash
# Primeiro, você precisa de um token admin
# Gere um token aleatório ou use uma variável de ambiente
export STRIPE_ADMIN_TOKEN="seu_token_secreto"
export API_URL="http://localhost:3000"

node scripts/update-stripe-benefits.js
```

### 4. Pronto! ✅

Os benefícios foram sincronizados:
- Webhook vai buscar automaticamente
- UI vai mostrar benefícios dinâmicos

---

## Opção 2: Via cURL

```bash
curl -X POST http://localhost:3000/api/admin/sync-stripe-benefits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token_secreto" \
  -d '{
    "updates": [
      {
        "productId": "prod_YOUR_PRO_ID",
        "benefits": [
          {"id": "credits_100", "label": "100+ créditos/mês"},
          {"id": "support_standard", "label": "Suporte padrão"},
          {"id": "updates_free", "label": "Atualizações grátis"}
        ]
      },
      {
        "productId": "prod_YOUR_MAX_ID",
        "benefits": [
          {"id": "credits_300", "label": "300+ créditos/mês"},
          {"id": "downloads_higher", "label": "Limite maior de downloads"},
          {"id": "export_discount", "label": "Desconto por exportação"},
          {"id": "support_priority", "label": "Suporte prioritário"}
        ]
      }
    ]
  }'
```

---

## Estrutura de Benefícios

Cada benefício tem:
- **id**: Identificador único (usado para comparação)
- **label**: Texto que o usuário vê

Exemplo:
```json
{"id": "credits_100", "label": "100+ créditos/mês"}
```

---

## Como Funcionamento

1. Você cadastra benefícios via script/cURL
2. Endpoint atualiza o metadata do Stripe product
3. Stripe envia webhook `product.updated`
4. Webhook sincroniza para `pricing_plans.benefits` no Supabase
5. UI carrega benefícios dinâmicos

---

## Segurança

⚠️ O endpoint requer um token admin. Configure:

```bash
export STRIPE_ADMIN_TOKEN="seu_token_super_secreto"
```

Em produção, use variáveis de ambiente seguras ou adicione autenticação via Supabase.
