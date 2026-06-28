# Integração Mercado Livre - Produtos Filiados

## 📋 Visão Geral

Sistema de importação automática de produtos do Mercado Livre para a seção de "Produtos Afiliados" do LB Creative Studio.

**Fluxo Principal:**
1. Admin se conecta à conta do Mercado Livre (OAuth)
2. Admin cola link de afiliado do produto
3. Sistema busca dados (nome, preço, descrição, fotos) via API do ML
4. Produto é salvo no banco de dados
5. Usuário final vê produto listado e clica para comprar via link do admin (comissão!)

---

## 🔐 Autenticação OAuth

### Fluxo de Conectar ao Mercado Livre

**Endpoint:** `GET /api/auth/mercado-livre-url?user_id={userId}`

1. Cliente pega user_id autenticado
2. Faz requisição para gerar URL de autorização
3. Sistema retorna URL de autorização do ML
4. Usuario redireciona para `https://auth.mercadolibre.com/authorization?...`
5. ML redireciona de volta para `/api/auth/mercado-livre?code=...&state=...`
6. Sistema:
   - Troca `code` por `access_token` e `refresh_token`
   - Armazena credenciais em `marketplace_credentials` table
   - Redireciona para `/affiliate?success=mercado_livre_connected`

### Credenciais Armazenadas

**Table:** `marketplace_credentials`

```sql
{
  id: UUID,
  admin_id: UUID,           -- Proprietário do token
  marketplace: 'mercado_livre',
  access_token: string,     -- Token OAuth (expira em ~6 horas)
  refresh_token: string,    -- Para renovar quando expirar
  user_id_marketplace: int, -- ID do usuário no ML
  expires_at: timestamp,    -- Quando access_token expira
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 📦 Importação de Produtos

### Fluxo de Importar Produto

**Endpoint:** `POST /api/affiliate/import-mercado-livre`

```bash
curl -X POST https://lb-creative-studio-iota.vercel.app/api/affiliate/import-mercado-livre \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"affiliateLink": "https://meli.la/2Y6zGMW"}'
```

**Processamento:**
1. Valida link de afiliado
2. Resolve URL curta → ID do produto (ex: MLA880314064)
3. Busca token OAuth do admin no banco
4. Checa se token expirou; renova se necessário
5. Chama API do ML: `GET /items/{id}` com token
6. Extrai dados:
   - Nome do produto
   - Preço
   - Primeira foto (secure_url)
   - Descrição (se disponível)
7. Salva em `affiliate_products` com `marketplace='mercado_livre'`

### Dados Salvos no Banco

**Table:** `affiliate_products`

```sql
{
  id: UUID,
  admin_id: UUID,           -- Quem adicionou
  name: string,             -- Nome do produto
  description: text,        -- Descrição (opcional)
  price: decimal(10,2),     -- Preço em R$
  image_url: string,        -- Foto principal
  affiliate_link: string,   -- Link do produto (com parâmetros de afiliado)
  marketplace: 'mercado_livre',
  is_active: boolean,       -- Exibir aos usuários?
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 🔌 Componentes Frontend

### MercadoLivreConnect.tsx

Exibe status de conexão com o ML:
- ✓ Conectado: mostra status
- ✗ Não conectado: mostra botão "Conectar ao ML"

Ao clicar, chama `/api/auth/mercado-livre-url?user_id={id}` e redireciona para autorização.

### MercadoLivreImportForm.tsx

Formulário para importar produtos:
1. Input para colar link do ML
2. Botão "Importar Produto"
3. Mostra sucesso ou erro

Ao submeter, chama `POST /api/affiliate/import-mercado-livre` com o link.

### AffiliateProductsTab.tsx

Aba no admin que integra:
- MercadoLivreConnect (status + botão de conectar)
- MercadoLivreImportForm (importar produtos)
- AffiliateProductsList (listar produtos)

---

## 🛠️ Configuração de Variáveis

**.env.local (ou Vercel Settings)**

```
MERCADO_LIVRE_CLIENT_ID=<seu_app_id_do_mercado_livre>
MERCADO_LIVRE_CLIENT_SECRET=<seu_secret_do_mercado_livre>
MERCADO_LIVRE_REDIRECT_URI=https://lb-creative-studio-iota.vercel.app/api/auth/mercado-livre
```

> ⚠️ Os valores reais ficam **somente** no `.env.local` (local) e nas env vars do Vercel (produção). Nunca commitar.

**No Mercado Livre DevCenter:**
- Registrar redirect_uri exatamente como acima
- Habilitar "Authorization Code" flow
- Habilitar "Refresh Token" flow

---

## 📝 Próximos Passos

### MVP Atual ✅
- [x] OAuth flow funcionando
- [x] Importação básica de produtos
- [x] Armazenamento de credenciais
- [x] Renovação automática de tokens

### Melhorias Futuras
- [ ] Suportar múltiplos marketplaces (Shopee, AliExpress, Amazon)
- [ ] Sincronizar preços automaticamente (cron job)
- [ ] Dashboard de comissões geradas
- [ ] Webhook para quando alguém compra via afiliado
- [ ] Remoção em massa de produtos
- [ ] Buscar produto diretamente pelo nome (sem link)

---

## 🐛 Troubleshooting

### "Erro ao gerar URL de autorização"
- Verificar se `MERCADO_LIVRE_CLIENT_ID` e `MERCADO_LIVRE_CLIENT_SECRET` estão configurados no Vercel
- Verificar se `MERCADO_LIVRE_REDIRECT_URI` está registrado no DevCenter do ML

### "Link do produto não encontrado"
- O link pode estar incorreto ou expirado
- Tentar link completo do produto (não URL curta)
- Certificar que é um produto válido no ML

### "Token expirou"
- O sistema tenta renovar automaticamente
- Se falhar, pedir para usuário reconectar em "Conectar ao ML"

### Produtos não aparecem
- Verificar se `is_active=true` no banco
- Verificar se `marketplace='mercado_livre'`
- Limpar cache do navegador (Ctrl+Shift+Delete)

---

## 📚 Referências

- [Documentação Mercado Livre OAuth](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao)
- [API de Itens do ML](https://developers.mercadolivre.com.br/pt_br/itens)
- Branch: `feat/mercado-livre-affiliate-integration`
