# Troubleshooting — FAQ & Soluções Comuns

Encontrou um problema? Comece aqui.

---

## 🔴 Downloads retornam erro 503

**Erro visto:** "Este arquivo ainda não está disponível para download. Tente novamente em breve."

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| STL tem `r2_object_key = NULL` | Arquivo nunca foi upado pra R2 | Rodar `npx ts-node scripts/bulk-import-3mf.ts` ou verificar se upload funcionou |
| STL tem `r2_object_key` mas arquivo não existe em R2 | R2 não tem o arquivo | Verificar em `https://dash.cloudflare.com/` se bucket tem os arquivos |
| `R2_*` env vars inválidas | Credenciais R2 erradas ou rotacionadas | Ver [docs/CREDENTIALS.md](CREDENTIALS.md) — rotar chaves se necessário |
| Feature cost não existe | Campo `feature_costs` vazio ou `download_stl` não está lá | SQL: `SELECT * FROM feature_costs WHERE feature_key = 'download_stl'` — deve ter 1 linha |

### Passos de debug

```bash
# 1. Verificar se STL tem r2_object_key
supabase (no browser dashboard)
  → Selecionar table "telegram_indexed_stls"
  → Buscar pelo ID do STL
  → Ver coluna "r2_object_key" (deve ter valor tipo "stl/pokemon/0001-...-default.3mf")

# 2. Verificar se feature_costs existe
supabase
  → Table "feature_costs"
  → Filtrar por feature_key = 'download_stl'
  → Deve ter 1 linha com cost_free, cost_pro, cost_max

# 3. Testar acesso a R2 localmente
npx ts-node scripts/migrate-file-sizes.ts --dry-run
  → Se falhar a conectar em R2, problema é credenciais

# 4. Ver logs no Vercel
https://vercel.com/ggobetti/lb-creative-studio/logs
  → Procurar por "[Telegram Download API]" + ID do usuário
```

---

## 💰 Credits não debitam ou debitam errado

**Sintoma:** User baixa STL mas credits não mudam, ou muda valor errado.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Credits não mudam após download | `decrement_credits` RPC falhou | Verificar RLS em `profiles` table — deve ser atualizável pelo user |
| Débito valor errado (ex.: -1 ao invés de -3) | Feature cost desatualizado | `UPDATE feature_costs SET cost_free = 3 WHERE feature_key = 'download_stl'` |
| Débito de um user vai pro outro | Bug em transaction logging | Ver coluna `user_id` em `transactions` table — deve bater com auth user |
| User vê créditos negativos | Validação não passou | Antes de debit, sistema checa `if (credits < cost)` e retorna 402 |

### Passos de debug

```bash
# 1. Verificar feature_costs
supabase → Table "feature_costs" → feature_key = 'download_stl'
  Esperado:
    cost_free: 3
    cost_pro: 2 (ou menos)
    cost_max: 0 (ou menos)

# 2. Verificar transaction log do user
supabase → Table "transactions"
  → Filtrar por user_id = <seu-user-id>
  → Deve ter linha recente com credits_added = -3

# 3. Verificar credits em profiles
supabase → Table "profiles" → id = <seu-user-id>
  Antes: credits = 100
  Depois de download: credits = 97

# 4. Se usar RPC decrement_credits, testar manualmente
supabase → SQL Editor
  → SELECT * FROM decrement_credits(<user-id>, 3)
  → Deve retornar nova contagem
```

---

## ⚙️ Stripe Webhook não processa

**Sintoma:** User compra, Stripe envía webhook, mas créditos não aparecem.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Webhook retorna 401 | Assinatura inválida (STRIPE_WEBHOOK_SECRET errada) | Verificar em Vercel env var + testar com `stripe listen` localmente |
| Webhook retorna 400 | JSON parse falhou | Ver logs Vercel pra qual linha explodiu |
| Webhook retorna 500 | RPC add_credits falhou | Verificar se `add_credits` exists + teste manual em Supabase |
| Webhook não é chamado | Endpoint não registrado em Stripe | `https://dashboard.stripe.com/webhooks` — verificar se existe para domínio correto |

### Passos de debug

```bash
# 1. Verificar endpoint registrado
https://dashboard.stripe.com/webhooks
  → Deve ter endpoint para "https://lb-creative-studio-iota.vercel.app/api/webhooks/stripe"
  → Clicar nele → Ver "Signing secret" (seu STRIPE_WEBHOOK_SECRET)

# 2. Testar webhook localmente
stripe listen --forward-to localhost:3000/api/webhooks/stripe
  → Copiar chave (começa com "whsec_")
  → Colocar em .env.local como STRIPE_WEBHOOK_SECRET
  → Fazer um teste de pagamento (4242 4242 4242 4242)
  → Deve receber evento no terminal

# 3. Ver logs Vercel
https://vercel.com/ggobetti/lb-creative-studio/logs
  → Procurar por "[Stripe Webhook]" ou erros relacionados

# 4. Testar RPC add_credits manualmente
supabase → SQL Editor
  → SELECT * FROM add_credits(<user-id>, 100, 'payment_intent_xxx')
  → Deve retornar novo saldo

# 5. Verificar idempotência
supabase → Table "transactions"
  → payment_intent_id deve ser UNIQUE
  → Se mesmo intent_id chegar 2x, só debita uma vez
```

---

## 🎮 Minigame não carrega ou não funciona

**Sintoma:** PhotoMatch ou Category Classifier não abre, ou votação não salva.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Página em branco | Component não renderiza | Verificar console do browser pra erro JS |
| "Nenhum STL pendente" | Nenhum STL tem status `pending` | Inserir teste com `UPDATE telegram_indexed_stls SET moderation_status = 'pending' WHERE id = '...'` |
| Vote não salva | RPC `cast_moderation_vote` falhou | Verificar se RPC existe em Supabase + testa manualmente |
| Não ganha XP | XP increment não funcionou | Verificar `xp_transactions` table pra ver se tem log |

### Passos de debug

```bash
# 1. Ver console do browser
F12 → Console
  → Procurar por erros vermelho (Network, JS syntax, etc.)

# 2. Verificar STLs pendentes
supabase → Table "telegram_indexed_stls"
  → Adicionar filter: moderation_status = 'pending'
  → Deve ter alguns STLs listados
  Se vazio: INSERT um manualmente para teste

# 3. Testar RPC do jogo
supabase → SQL Editor
  → SELECT * FROM cast_moderation_vote(
      '<stl-id>',
      '<your-user-id>',
      'photo_match',
      true
    )
  → Deve retornar novo status do STL

# 4. Verificar XP log
supabase → Table "xp_transactions"
  → Filtrar por user_id = <seu-id>
  → Deve ter linhas recentes após votações
```

---

## 🔐 Auth não funciona (login/logout)

**Sintoma:** Não consigo fazer login ou logout não funciona.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Login page vazia | Supabase client não carregou | Verificar `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` |
| "Email/password inválido" | Credenciais erradas ou user não existe | Supabase → Auth → Users — criar user de teste |
| Logout não funciona | Session cookie não é deletada | Ver em DevTools → Application → Cookies — deve ter `sb-*` |
| Fico logado depois de fechar abas | Session persiste corretamente (é normal) | Não é bug — Supabase mantém session em localStorage |

### Passos de debug

```bash
# 1. Verificar env vars
cat .env.local | grep SUPABASE
  → NEXT_PUBLIC_SUPABASE_URL deve parecer: https://yruoiwtnxopcbiiuvxxa.supabase.co
  → NEXT_PUBLIC_SUPABASE_ANON_KEY deve ter ~120 caracteres

# 2. Criar user de teste
supabase → Auth → Users
  → "Create new user"
  → Email: test@example.com
  → Password: testPassword123
  → Marcar "Auto confirm user"

# 3. Testar login local
npm run dev
  → http://localhost:3000/login
  → Usar credenciais acima
  → Deve redirecionar pra /dashboard

# 4. Ver localStorage
F12 → Application → Local Storage
  → Deve ter chave "sb-" com JSON da session
```

---

## 🚀 Deploy para Vercel falha

**Sintoma:** Push na main, Vercel tenta fazer build, falha.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Build falha com "NEXT_PUBLIC_* not found" | Env var faltando em Vercel | Ir em Vercel → Settings → Environment Variables — verificar se todas estão lá |
| "cannot find module X" | Dependency não foi instalada | `npm install` + rodar `npm run build` local |
| TypeScript error em tipo | Tipo importado errado | `npm run type-check` localmente pra achar erro |
| Deploy fica lento (timeout) | Muitos arquivos sendo enviados | Verificar `.gitignore` — deve ter `node_modules`, `.next`, etc. |

### Passos de debug

```bash
# 1. Testar build local
npm run build
  → Se falhar aqui, mesma falha em Vercel
  → Ler error message pra achar linha do problema

# 2. Verificar type checking
npm run type-check
  → Deve passar sem erros

# 3. Verificar env vars em Vercel
https://vercel.com/ggobetti/lb-creative-studio/settings/environment-variables
  → Copiar todas as vars de `.env.local`
  → Colar em Vercel
  → Re-deploy

# 4. Ver logs Vercel
https://vercel.com/ggobetti/lb-creative-studio/deployments
  → Clicar na deployment que falhou
  → "View Logs" → scroll até erro
```

---

## 📊 Banco está lento ou bugado

**Sintoma:** Queries demoram, ou retornam erro estranho.

### Causas possíveis

| Sintoma | Causa | Solução |
|---------|-------|--------|
| Query retorna 0 linhas quando deveria ter muitas | RLS filtrando por acidente | Verificar RLS policy da table — `enable_rls = true` mas policy está muito restritiva |
| Erro "column does not exist" | Migration não foi aplicada | `supabase db push` pra aplicar migrations pendentes |
| Timeout em query grande | Query muito cara (sem índice, cartesian join, etc.) | Verificar em "Database" → "Performance" se tem query lenta |

### Passos de debug

```bash
# 1. Verificar migrations aplicadas
supabase status
  → Deve dizer "Linked to project: yruoiwtnxopcbiiuvxxa"
  → "Applied migrations: X/Y"
  → Se Y > X, rodar: supabase db push

# 2. Testar query no SQL Editor
supabase → SQL Editor
  → Colar query que está falhando
  → Ver mensagem de erro
  → Ajustar até funcionar

# 3. Ver RLS status
supabase → Table X → "Settings" → "Security" → "Row Level Security"
  → Se "Enabled" mas nenhuma policy, tudo é bloqueado
  → Ou policy está muito restritiva (filtra auth.uid())

# 4. Ver índices
supabase → Table X → "Indexes"
  → Verificar se coluna frequente tem índice
  → Se não, criar: CREATE INDEX idx_table_column ON table(column)
```

---

## 🆘 Nada acima resolve meu problema

1. **Anotar tudo que você tentou** — detalhes importam
2. **Verificar logs em 3 lugares:**
   - Browser console (`F12`)
   - Vercel logs (`https://vercel.com/...logs`)
   - Supabase logs (`Supabase Dashboard → Logs`)
3. **Git status:**
   - `git status` — tem mudanças não commitadas?
   - `git log --oneline -5` — quais commits estão na main?
4. **Chamar o dono com:**
   - Screenshot do erro
   - Passos pra reproduzir
   - Logs acima
   - O que já tentou

---

## ✅ Problema resolvido?

1. Documentar a solução aqui (adicionar à FAQ)
2. Fazer commit: `git commit -am "docs: adicionar solução para XXX ao troubleshooting"`
3. Push: `git push origin main`

Assim, próximo dev não precisa sofrer com mesmo problema! 🚀
