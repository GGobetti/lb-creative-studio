# Onboarding — Bem-vindo ao LB Creative Studio

Você é um novo dev? Comece por aqui. Este documento é seu guia passo-a-passo para entender, rodar e contribuir ao projeto.

---

## 1️⃣ Entenda o Projeto (5 min)

Leia nesta ordem:

1. **[README.md](../README.md)** — visão geral, stack, estrutura de pastas
2. **[ARCHITECTURE.md](../ARCHITECTURE.md)** — como funciona por dentro (a verdade técnica)
3. **[ROADMAP.md](../ROADMAP.md)** — onde vamos daqui pra frente

---

## 2️⃣ Setup Local (15 min)

### Pré-requisitos
- **Node.js 18+** — [instalar](https://nodejs.org)
- **Git** — você já tem (veio com o projeto)
- **Conta Supabase** (opcional, só pra banco remoto)
- **Stripe CLI** (opcional, só pra testar pagamentos localmente)

### Clonar e instalar

```bash
# Você já tem o projeto clonado, então:
cd lb-creative-studio
npm install
```

### Preencher `.env.local`

```bash
cp .env.local.example .env.local
```

Agora abra `.env.local` e preencha com:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — banco de dev
- `SUPABASE_SERVICE_ROLE_KEY` — acesso admin (nunca expor no browser)
- `STRIPE_*` — chaves de teste Stripe
- `R2_*` — credenciais Cloudflare R2

> 💡 **Guia completo:** veja [README.md](../README.md#variáveis-necessárias-envlocal)

### Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:3000` — você deve ver a landing page.

---

## 3️⃣ Explore o Código (15 min)

A estrutura em `src/`:

```
src/
  app/
    page.tsx            ← Landing page pública
    login/              ← Autenticação (Supabase)
    dashboard/          ← Área logada (games, STL search, admin)
    api/
      webhooks/stripe   ← Webhook de pagamentos
      telegram/download ← API de download STL
      games/            ← APIs dos minigames
  
  components/
    games/              ← Minigames (PhotoMatch, Category, etc.)
    stl-search/         ← Busca e download de STLs
    ui/                 ← Design system (botões, cards, etc.)
  
  lib/
    supabase.ts         ← Factory de clientes Supabase
    r2.ts               ← Geração de presigned URLs (R2)
```

**Comece por:**
1. `src/app/page.tsx` — entender a landing page
2. `src/components/games/PhotoMatch.tsx` — exemplo de um minigame
3. `src/app/api/telegram/download/route.ts` — como download funciona

---

## 4️⃣ Testar Pagamentos com Stripe (opcional, 5 min)

Se você vai mexer em checkout/webhooks:

```bash
# Em um terminal separado:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use cartão de teste: `4242 4242 4242 4242` (qualquer data/CVC futura).

> Para mais detalhes: [docs/SUBSCRIPTIONS_IMPLEMENTATION.md](SUBSCRIPTIONS_IMPLEMENTATION.md)

---

## 5️⃣ Entenda o Fluxo de Git (10 min)

**Leia:** [docs/WORKFLOW.md](WORKFLOW.md)

TL;DR:
- Sua branch = trabalhando em segurança
- Commits frequentes = backup automático
- Push cedo = trabalho não se perde
- PR = revisão antes de ir pra `main`
- `main` = sempre funcionando

**Exemplo de uma tarefa:**
```bash
git switch -c feat/seu-nome-da-feature
# ... você edita, commita, faz push ...
# ... abre PR no GitHub ...
# ... após ok, merge na main ...
```

---

## 6️⃣ Checklist: "Pronto pra Contribuir?"

- [ ] Rodar `npm run dev` e landing page aparece
- [ ] `.env.local` preenchido (mesmo que com valores fake)
- [ ] Entendi a diferença entre `main`, `feature-branch` e `PR`
- [ ] Li [WORKFLOW.md](WORKFLOW.md) — sei que assistente cuida de git
- [ ] Abri um arquivo em `src/components/games` — entendo a estrutura
- [ ] Rodei `stripe listen` (se vai mexer em pagamentos)

Se tudo ✅, você está pronto!

---

## 7️⃣ Próximos Passos Típicos

### Primeira tarefa: exploração
- Abre um minigame (ex.: `src/components/games/PhotoMatch.tsx`)
- Testa na UI (`http://localhost:3000/dashboard/games`)
- Entende o fluxo: seleção → votação → feedback

### Segunda tarefa: bugfix simples
- Procura por um issue simples no ROADMAP
- Abre uma branch `fix/nome-do-bug`
- Faz push e abre PR
- Recebe feedback e itera

### Terceira tarefa: feature nova
- Discute com o dono
- Planeja no ROADMAP
- Cria branch, implementa, testa
- Abre PR com descrição clara

---

## 🆘 Precisa de Ajuda?

- **"Como rodar isso?"** → ver [README.md](../README.md#setup-local)
- **"Qual é a arquitetura?"** → [ARCHITECTURE.md](../ARCHITECTURE.md)
- **"Meu download não funciona"** → [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **"Como mudo as regras do jogo?"** → [docs/minigames-ux-spec.md](minigames-ux-spec.md)
- **"Qual é o padrão de código aqui?"** → [docs/CODE_STYLE.md](CODE_STYLE.md)

---

## ✅ Você está pronto!

Bem-vindo ao time. Qualquer dúvida, o assistente está aqui. 🚀
