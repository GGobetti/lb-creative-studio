# Gestão de Credenciais — LB Creative Studio

Documento de referência para credenciais do projeto. **Nunca commitar valores reais.**

---

## 🔐 Credenciais Ativas

| Credencial | Tipo | Onde Vive | Uso | Rotação |
|------------|------|----------|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL | `.env.local`, Vercel | Banco Supabase | Nunca (é pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave | `.env.local`, Vercel | Cliente browser (auth, leitura) | Nunca (é pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave | `.env.local` (servidor), Vercel | Backend com bypass RLS | **Anualmente** |
| `STRIPE_SECRET_KEY` | Chave | `.env.local`, Vercel | Backend Stripe (cobrança) | **Anualmente** |
| `STRIPE_WEBHOOK_SECRET` | Chave | `.env.local`, Vercel | Validar webhooks Stripe | **Anualmente** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave | `.env.local`, Vercel | Cliente Stripe (checkout) | Nunca (é pública) |
| `R2_ACCOUNT_ID` | ID | `.env.local`, Vercel | Cloudflare R2 | Nunca |
| `R2_ACCESS_KEY_ID` | Chave | `.env.local`, Vercel | Autenticação R2 | **Anualmente** |
| `R2_SECRET_ACCESS_KEY` | Chave | `.env.local` (nunca em Vercel público) | Autenticação R2 | **Anualmente** |
| `R2_BUCKET` | Nome | `.env.local`, Vercel | Bucket R2 para STLs | Nunca |
| `MERCADO_LIVRE_CLIENT_ID` | ID | `.env.local`, Vercel | OAuth Mercado Livre | Conforme expire |
| `MERCADO_LIVRE_CLIENT_SECRET` | Chave | `.env.local`, Vercel | OAuth Mercado Livre | Conforme expire |
| `MERCADO_LIVRE_REDIRECT_URI` | URL | `.env.local`, Vercel | Callback OAuth | Conforme mude domínio |

---

## 🏠 Onde Cada Credencial Vive

### `.env.local` (máquina do dev)
- **Arquivo:** `/Users/ggobetti/Projetos\ Pessoais/lb-creative-studio/.env.local`
- **Gitignored:** Sim ✅ (nunca commita)
- **Quem vê:** Só quem está com o laptop
- **Backup:** Não tem (guarda em local seguro / Bitwarden / 1Password)

### Vercel (produção)
- **URL:** `https://vercel.com/ggobetti/lb-creative-studio/settings/environment-variables`
- **Gitignored:** N/A (não está no git)
- **Quem vê:** Ggobetti (owner do projeto)
- **Backup:** Vercel armazena

### Supabase (banco remoto)
- **URL:** `https://supabase.com/dashboard/project/yruoiwtnxopcbiiuvxxa/settings/database`
- **Quem vê:** Ggobetti (owner do projeto)
- **O quê:** `SUPABASE_SERVICE_ROLE_KEY` em "Settings > API"

### Stripe (pagamentos)
- **URL:** `https://dashboard.stripe.com/apikeys`
- **Quem vê:** Ggobetti (owner da conta)
- **O quê:** Secret Key, Webhook Signing Secret (em "Webhooks > Endpoint > Signing secret")

### Cloudflare R2 (armazenamento)
- **URL:** `https://dash.cloudflare.com/?to=/:account/r2/api-tokens`
- **Quem vê:** Ggobetti (owner da conta)
- **O quê:** R2 API Token (Access Key ID + Secret Access Key)

---

## 🔄 Como Rotar Credenciais

### ⚠️ CRÍTICO: Stripe Webhook Secret
**Por quê?** Exposto em git history (veja commit history se necessário auditar).

**Quando:** Imediatamente (ou em breve).

**Como:**
1. Ir em `https://dashboard.stripe.com/webhooks`
2. Clicar no endpoint `https://lb-creative-studio-iota.vercel.app/api/webhooks/stripe`
3. "Reveal" a signing secret
4. Copiar novo valor
5. Atualizar `.env.local` local e Vercel env var `STRIPE_WEBHOOK_SECRET`
6. Testar com `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### ⚠️ CRÍTICO: R2 Access Key
**Por quê?** Exposto em git history.

**Quando:** Imediatamente (ou em breve).

**Como:**
1. Ir em `https://dash.cloudflare.com/?to=/:account/r2/api-tokens`
2. Criar novo token com permissões R2 (read/write)
3. Copiar `Access Key ID` e `Secret Access Key`
4. Atualizar:
   - `.env.local`: `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`
   - Vercel: mesmas variáveis (não `R2_SECRET_ACCESS_KEY` públicamente)
5. Testar se downloads ainda funcionam

### 🟡 ALTO: Supabase Service Role Key
**Por quê?** Bypass RLS total, nunca deve vazar.

**Quando:** Anualmente ou se suspeitar que foi exposto.

**Como:**
1. Ir em `https://supabase.com/dashboard/project/yruoiwtnxopcbiiuvxxa/settings/api`
2. Em "Service Role Key", clicar em "Rotate key"
3. Copiar novo valor
4. Atualizar:
   - `.env.local`: `SUPABASE_SERVICE_ROLE_KEY`
   - Vercel: `SUPABASE_SERVICE_ROLE_KEY`
5. **Testar:** rodar scripts (migrate-file-sizes.ts, bulk-import-3mf.ts) pra confirmar acesso

### 🟡 ALTO: Stripe Secret Key
**Por quê?** Cobranças de verdade.

**Quando:** Anualmente ou se suspeitar que foi exposto.

**Como:**
1. Ir em `https://dashboard.stripe.com/apikeys`
2. Clicar em "Roll key" em "Secret key"
3. Copiar novo valor
4. Atualizar:
   - `.env.local`: `STRIPE_SECRET_KEY`
   - Vercel: `STRIPE_SECRET_KEY`
5. **Testar:** fazer um checkout de teste pra confirmar

### 🟢 BAIXO: Chaves públicas
Não precisam rotar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`.

---

## 📋 Checklist de Rotação

Quando for rotar, marque:

- [ ] Stripe Webhook Secret
  - [ ] Gerada nova chave
  - [ ] Atualizada `.env.local`
  - [ ] Atualizada Vercel
  - [ ] Testada com `stripe listen`

- [ ] R2 Access Key + Secret
  - [ ] Geradas novas chaves
  - [ ] Atualizadas `.env.local`
  - [ ] Atualizadas Vercel (secret não public)
  - [ ] Testado download (`npx ts-node scripts/migrate-file-sizes.ts --dry-run`)

- [ ] Supabase Service Role Key
  - [ ] Rotacionada via Supabase dashboard
  - [ ] Atualizada `.env.local`
  - [ ] Atualizada Vercel
  - [ ] Testado script (`npx ts-node scripts/migrate-file-sizes.ts --dry-run`)

- [ ] Stripe Secret Key
  - [ ] Rolada via Stripe dashboard
  - [ ] Atualizada `.env.local`
  - [ ] Atualizada Vercel
  - [ ] Testado checkout de teste

---

## 🚨 Se uma credencial vazar

1. **Rotação imediata** — siga o passo-a-passo acima para a chave afetada
2. **Auditoria** — rodar `git log --all -p | grep -i <credencial>` pra ver quando foi exposta
3. **Limpeza do git** — se necessário, rodar `git filter-branch` ou `git filter-repo` pra remover histórico
4. **Notificação** — avisar qualquer serviço (Stripe, Supabase, Cloudflare) que tenha um incident

---

## ✅ Última Rotação Conhecida

| Chave | Última Rotação | Quem | Status |
|-------|----------------|------|--------|
| STRIPE_WEBHOOK_SECRET | Nunca (exposta em git) | — | ⚠️ PRECISA ROTAR |
| R2_ACCESS_KEY_ID | Nunca (exposta em git) | — | ⚠️ PRECISA ROTAR |
| R2_SECRET_ACCESS_KEY | Nunca (exposta em git) | — | ⚠️ PRECISA ROTAR |
| SUPABASE_SERVICE_ROLE_KEY | Nunca | — | 🟡 Verificar |
| STRIPE_SECRET_KEY | Nunca | — | 🟡 Verificar |

> Atualizar esta tabela após cada rotação.
