# 🏭 LB Creative Studio

> 📐 **Arquitetura completa e fonte de verdade:** [`ARCHITECTURE.md`](ARCHITECTURE.md). Onde este README divergir, o ARCHITECTURE prevalece.

LB Creative Studio é uma plataforma SaaS voltada para o ecossistema de **impressão 3D e makers brasileiros**. A plataforma permite que usuários criem placas, chaveiros e cortadores parametrizados em 3D, precifiquem custos de filamentos e impressões, gerenciem portfólios, elaborem cotações comerciais completas em PDF e busquem arquivos STL compartilhados em canais do Telegram com controle inteligente de créditos, fila de processamento e aprovação de moderação.

---

## 🏗️ Estrutura do Ecossistema

São **dois projetos separados** (repos independentes):

1.  **`lb-creative-studio` (este repo) — Frontend & App SaaS (Next.js):**
    *   Painel do usuário, configurador 3D (Three.js), calculadora de impressão, CRM, cotações, games de curadoria e busca de STLs indexados.
    *   Deploy futuro: Vercel. Integra Supabase (banco/auth) e Stripe (pagamentos).
2.  **`lb-creative-scrapper` (repo separado) — Worker de ingestão (Node/GramJS):**
    *   Roda **local** na máquina do dono. Userbot GramJS que monitora grupos do Telegram, filtra STL/3MF/comprimidos, agrupa mídias e indexa no Supabase.
    *   ⚠️ Arquitetura-alvo: os binários vão para o **Cloudflare R2** (não mais o Telegram Vault) — ver [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.

---

## 🚀 Como Iniciar Localmente

### Pré-requisitos
*   Node.js (v18+) e npm instalados.
*   Conta no Supabase (URL e Service Role Key).
*   Credenciais da API do Telegram (obtenha em [my.telegram.org](https://my.telegram.org)).

---

### 💻 Passo 1: Executando o App Next.js

1.  Na pasta raiz do projeto, instale as dependências:
    ```bash
    npm install
    ```
2.  Crie um arquivo `.env.local` baseado no exemplo `.env.local.example`:
    ```bash
    cp .env.local.example .env.local
    ```
3.  Preencha as variáveis de ambiente necessárias (Supabase, URLs, etc.).
4.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
    O app estará acessível em `http://localhost:3000`.

---

### 🤖 Passo 2: Scraper (repo separado)

O scraper **não vive mais neste repositório**. Ele é o projeto separado **`lb-creative-scrapper`**, rodado localmente. Consulte o `README`/`AGENTS.md` daquele repo para setup (Telegram + Supabase + R2) e os comandos `npm run scan` / `npm run daemon`.

> Os antigos `start.sh`/`stop.sh`/`ecosystem.config.js` (PM2 do scraper interno) foram removidos nesta limpeza — o studio sobe apenas com `npm run dev`.

---

## 📈 Planejamento e Arquitetura

*   [PROJETO.md](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/PROJETO.md) - Documento técnico geral do projeto, status de desenvolvimento e histórico de sessões.
*   [TELEGRAM_STL_SEARCH_ROADMAP.md](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/TELEGRAM_STL_SEARCH_ROADMAP.md) - Arquitetura de indexação e histórico de evolução do recurso de busca global de arquivos STL no Telegram.
*   [supabase/migrations](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/supabase/migrations) - Arquivos SQL de migração de banco de dados para sincronização no Supabase.
