# 🏭 LB Creative Studio

LB Creative Studio é uma plataforma SaaS voltada para o ecossistema de **impressão 3D e makers brasileiros**. A plataforma permite que usuários criem placas, chaveiros e cortadores parametrizados em 3D, precifiquem custos de filamentos e impressões, gerenciem portfólios, elaborem cotações comerciais completas em PDF e busquem arquivos STL compartilhados em canais do Telegram com controle inteligente de créditos, fila de processamento e aprovação de moderação.

---

## 🏗️ Estrutura do Projeto

O projeto é dividido em dois serviços principais:

1.  **Frontend & App SaaS (Next.js):** 
    *   Localizado na raiz do repositório.
    *   Painel do usuário, configurador 3D (Three.js), calculadora de impressão, CRM básico de clientes, cotações e visualização de arquivos indexados do Telegram.
2.  **Serviço de Scraper & Proxy (Node.js):**
    *   Localizado no diretório [telegram-scraper](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/telegram-scraper).
    *   Userbot baseado em GramJS que monitora grupos configurados no Telegram, filtra arquivos STL/3MF/comprimidos, agrupa mídias de um mesmo post, realiza o envio seguro dos arquivos para um canal privado (Vault) e gerencia uma fila sequencial inteligente de processamento.

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

### 🤖 Passo 2: Executando o Scraper do Telegram

1.  Navegue até a pasta do scraper:
    ```bash
    cd telegram-scraper
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Crie um arquivo `.env` baseado no exemplo `.env.example`:
    ```bash
    cp .env.example .env
    ```
4.  Preencha com suas credenciais do Telegram (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`), as chaves do Supabase e o ID do canal Vault.
5.  Execute o scraper em modo de desenvolvimento:
    ```bash
    npm run dev
    ```
    *Na primeira inicialização, ele solicitará seu número de telefone e o código enviado pelo Telegram para gerar a string de sessão (`TELEGRAM_SESSION`). Copie a string exibida no terminal e cole no seu `.env` para evitar logins futuros.*
    
    O proxy de download do scraper rodará localmente na porta `5001`.

---

## 📈 Planejamento e Arquitetura

*   [PROJETO.md](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/PROJETO.md) - Documento técnico geral do projeto, status de desenvolvimento e histórico de sessões.
*   [TELEGRAM_STL_SEARCH_ROADMAP.md](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/TELEGRAM_STL_SEARCH_ROADMAP.md) - Arquitetura de indexação e histórico de evolução do recurso de busca global de arquivos STL no Telegram.
*   [supabase/migrations](file:///Users/ggobetti/Projetos%20Pessoais/lb-creative-studio/supabase/migrations) - Arquivos SQL de migração de banco de dados para sincronização no Supabase.
