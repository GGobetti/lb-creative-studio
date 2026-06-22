# 🏭 LB Creative Studio — Documentação do Projeto

> ⚠️ **Documento histórico.** Para a arquitetura atual (pós-separação do scraper + migração para Cloudflare R2), a fonte de verdade é [`ARCHITECTURE.md`](ARCHITECTURE.md). Trechos abaixo sobre o scraper interno (`telegram-scraper/`) e proxy de download estão **obsoletos**.

> **Última atualização:** 17 de Junho de 2026 — Sessão 6 (01:06)
> **Stack:** Next.js 16.2.4 · React 19 · Supabase · Three.js r184 · TailwindCSS v4 · Zustand v5

---

## 🎯 Visão Geral do Produto

**LB Creative Studio** é uma plataforma SaaS voltada para o ecossistema de **impressão 3D / makers brasileiros**. O produto une três pilares:

| Pilar | Descrição |
|-------|-----------|
| **Gerador Paramétrico** | Editor 3D in-browser para criar placas, chaveiros e cortadores a partir de parâmetros e imagens |
| **Gestão de Portfólio** | Catálogo pessoal de modelos com precificação de impressão integrada |
| **Comunidade e Busca** | Busca de modelos STL de grupos Telegram + Hub Maker com recursos e tutoriais |

**Público-alvo:** Makers, impressores 3D, vendedores de peças personalizadas.  
**Monetização:** Sistema de créditos por plano (free, basic, pro) com ações pagas.

---

## 🏗️ Arquitetura

### Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16.2.4 (App Router) + React 19 + TypeScript |
| Styling | TailwindCSS v4 + Radix UI (primitivos) + Framer Motion |
| 3D Engine | Three.js r184 + @react-three/fiber v9 + @react-three/drei v10 |
| CSG | three-csg-ts (operações booleanas Union/Subtract) |
| SVG/STL | imagetracerjs + potrace (image → SVG path) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| State | Zustand v5 + Immer v11 (persist no localStorage) |

### Estrutura de Rotas

```
/                           → Landing Page (SSR)
/login                      → Autenticação (Supabase Auth)
/configurator/[id]          → Editor 3D Paramétrico
/dashboard                  → Dashboard principal (autenticado)
/dashboard/admin            → Painel sysadmin
/dashboard/calculator       → Calculadora de precificação livre
/dashboard/history          → Histórico de exports e transações (real)
/dashboard/hub              → Hub Maker (tutoriais, calibração)
/dashboard/portfolio        → Portfólio de modelos
/dashboard/profile          → Perfil do usuário
/dashboard/settings         → Configurações de custos
/dashboard/stl-search       → Busca de STLs (Telegram — UI mockada)
/api/import/makerworld      → Route Handler: Bambu Lab API com retry
```

### Componentes-chave

| Componente | Arquivo | Propósito |
|-----------|---------|-----------|
| `Configurator3D` | `components/Configurator3D.tsx` | Canvas 3D + CSG + Export STL |
| `ParametricSidebar` | `components/ParametricSidebar.tsx` | Controles paramétricos (sliders, texto, cor) |
| `CatalogFilter` | `components/landing/CatalogFilter.tsx` | Filtros client-side do catálogo (landing) |
| `MakerWorldImportModal` | `components/dashboard/MakerWorldImportModal.tsx` | Import via Bambu API + deduct credits |
| `PricingCalculator` | `components/dashboard/PricingCalculator.tsx` | Calculadora de custo de impressão |
| `DashboardSidebar` | `components/layout/DashboardSidebar.tsx` | Navegação do dashboard |
| `useConfiguratorStore` | `store/store.ts` | Zustand global (6 slices) |

---

## 🗄️ Banco de Dados (Supabase)

### Tabelas

| Tabela | Propósito | RLS |
|--------|-----------|-----|
| `profiles` | Dados do usuário (role, plan, credits) | Próprio + admin |
| `catalog_items` | Catálogo de produtos parametrizáveis | Público (is_active) + admin |
| `saved_projects` | Configurações salvas no configurador | Próprio |
| `transactions` | Ledger append-only de créditos (+/-) | Próprio (read) |
| `portfolio_items` | Portfólio de modelos do usuário | Próprio |
| `user_pricing_settings` | Configurações de custo persistidas | Próprio |
| `feature_costs` | Custos de features por plano | Autenticado (read) + admin |
| `customers` | Cadastro de clientes para cotações (CRM básico) | Próprio |
| `quotations` | Histórico de cotações de precificação | Próprio |

### Edge Functions

| Função | Propósito |
|--------|-----------|
| `deduct-credits` | Deduz créditos atomicamente (suporta `item_id` e `feature_key`) |
| `add-credits` | Adiciona créditos (uso admin) |

### Tipos de CatalogItem

- `hybrid_parametric` → base geométrica + texto 3D (CSG)
- `image_to_3d` → imagem → SVG → mesh 3D extrudado

---

## 🗂️ Estado Global (Zustand Store)

Localização: `src/store/store.ts`

| Slice | Persistido | Conteúdo |
|-------|-----------|----------|
| `AuthSlice` | ❌ | user, profile, métodos de auth |
| `CatalogSlice` | ❌ | currentItem |
| `ParametricSlice` | ✅ | values (parâmetros 3D), color, preset |
| `ImageToStlSlice` | ❌ | sourceImageUrl, svgPathData, traceThreshold |
| `UiSlice` | ✅ | sidebarTab, uiMode (simple/advanced) |
| `PricingSlice` | ✅ | pricingSettings (impressoras, materiais, marketplaces) |

> 🔄 `PricingSlice` é persistido no `localStorage` e sincronizado automaticamente em background (via upsert debounced) com a tabela `user_pricing_settings` no Supabase sempre que o usuário faz alterações.

---

## 🔌 Integrações Externas

| Integração | Status | Mecanismo |
|------------|--------|-----------|
| Supabase Auth | ✅ Funcional | `@supabase/ssr` browser client |
| Supabase DB | ✅ Funcional | REST via client SDK |
| Supabase Edge Functions | ✅ Funcional | fetch com Bearer token |
| MakerWorld / Bambu API | ✅ Robusto | `api.bambulab.com` + retry com 3 variantes de header |
| Telegram STL | ✅ Funcional | Scraper Userbot (GramJS) + Fila Global Sequencial + Moderação de Arquivos Gigantes (> 1.5 GB) + API Proxy |
| Stripe Billing | ✅ Robusto | Checkout Sessions API + Webhook webhook-signature validator |

---

## 📊 Status dos Módulos

| Módulo | Status | Notas |
|--------|--------|-------|
| Landing Page | ✅ Completa | Filtros funcionais, CTA e links corrigidos |
| Autenticação | ✅ Funcional | Workaround de lock localStorage mantido |
| Configurador 3D | ✅ Funcional | Fontes "Draft" ainda sem implementação |
| Dashboard | ✅ Funcional | Refetch sem reload, session limpa |
| Portfólio | ✅ Funcional | Cadastro manual, upload de fotos, edição, e galeria de fotos enriquecida |
| Calculadora | ✅ Funcional | pricingSettings apenas no cliente (sem sync DB) |
| Admin Panel | ✅ Funcional | Sem CRUD de catálogo |
| MakerWorld Import | ✅ Robusto | Extração rica de metadados (likes, downloads, criador, galeria de fotos) |
| STL Search | ✅ Real | Busca real integrada de canais do Telegram + Fila Sequencial + Moderação de Aprovação/Cancelamento |
| Hub Maker | 🚧 Placeholder | Sem conteúdo real |
| Histórico | ✅ Real | Busca tabela `transactions` do Supabase |
| Salvar Projetos | ✅ Funcional | Salvamento no configurador e listagem no dashboard |
| Mobile | ⚠️ Incompleto | Sidebar não responsiva |
| CRM Clientes | ✅ Funcional | CRM básico com CRUD e busca reativa |
| Cotações | ✅ Funcional | Gerar a partir do cálculo, PDF, e compartilhamento |
| Suporte / Chamados | ✅ Completo | Abertura de chamados por usuários (categorias, anexos) e central de atendimento admin integrada |
| Feature Flags | ✅ Completo | Controle de ativação/desativação de features em tempo real via painel admin e banco de dados |
| Compra Créditos | ✅ Completo | Checkout seguro para compra de pacotes e assinatura com Stripe |

---

## 🐛 Issues e Dívidas Técnicas Ativas

### 🔴 Críticos
- **Fontes 3D "Draft"** (Montserrat, Playfair, Lobster) — nunca implementadas, enganosas na UI

### 🟡 Importantes
- **Sidebar não responsiva** — app inacessível em mobile
- **Sem testes automatizados** — risco de regressão crescente

### 🟢 Melhorias Desejáveis
- Hub Maker: conteúdo real (vídeos, calibração, comunidade)
- CRUD de catálogo no admin
- Undo/Redo no configurador
- Compartilhar configuração via URL
- Preview/thumbnail ao salvar portfólio
- Filtros e busca reativos para STL Search e Histórico de transações

---

## 🗺️ Roadmap

### ✅ Sessão 1 — Análise Completa (14 Jun 2026, manhã)
- [x] Mapeamento completo da arquitetura, banco de dados e todos os módulos
- [x] Identificação de todas as issues e dívidas técnicas
- [x] Criação do `PROJETO.md` na raiz do repositório
- [x] Roadmap de 4 fases definido

### ✅ Sessão 2 — Correções Críticas (14 Jun 2026, tarde)
- [x] **MakerWorld API**: retry com 3 variantes de header, parse defensivo, erros claros
- [x] **Histórico real**: página busca tabela `transactions` do Supabase (não mais mock)
- [x] **Filtros do catálogo**: `CatalogFilter` client-side com `useState` + `useMemo`
- [x] **CTA da landing**: botão "Começar Agora" → `/login` (antes era inerte)
- [x] **Links do footer**: URLs reais para Telegram, Instagram, Hub Maker
- [x] **Debug limpo**: `console.log('[DEBUG]')` removidos do MakerWorldImportModal
- [x] **`require()` → `import()`**: Configurator3D usa dynamic import (2 ocorrências)
- [x] **Dashboard refactor**: `fetchDashboardData` com `useCallback`, sem `window.location.reload()`
- [x] **Session fetch limpa**: lógica de timeout+fallback localStorage removida
- [x] **TypeScript**: zero erros (`npx tsc --noEmit` passou)

### ✅ Sessão 3 — Sincronização, Projetos, CRM e Cotações (14 Jun 2026, fim de tarde)
- [x] **Sincronização de custos (P1.1)**: Sync bidirecional automático (Zustand -> Supabase `user_pricing_settings`).
- [x] **Salvar projetos (P1.4)**: Botão salvar no configurador 3D, modal de nome e listagem na dashboard para retomar edição.
- [x] **CRM de Clientes (P3.2)**: Cadastro, listagem, busca e exclusão de clientes para relacionamento de vendas.
- [x] **Cotações (P3.1, P3.3, P3.4)**: Geração a partir da calculadora, histórico filtrável, exportação para PDF formatada e compartilhamento social (WhatsApp, Telegram, E-mail).
- [x] **Filtros e Busca**: Buscas dinâmicas e filtros reativos implementados nas listagens de Portfólio, Clientes e Cotações.
- [x] **TypeScript**: Todos os novos módulos perfeitamente tipados e validados com `npx tsc --noEmit`.

### ✅ Sessão 4 — Redesign do Portfólio, Metadados Ricos e Cadastro Manual (14 Jun 2026, noite)
- [x] **Enriquecimento de metadados do MakerWorld**: criador, likes, downloads, licença, tags, fotos da galeria.
- [x] **Redesign do Portfólio**: modal de detalhes `max-w-4xl` com galeria/carrossel de fotos (sem achatamento) e estatísticas completas.
- [x] **CRUD de Portfólio Independente**: botão de cadastrar modelo, upload de imagem para storage e edição de modelos.
- [x] **TypeScript & Build**: validação completa com `npx tsc --noEmit` e `npm run build`.

### ✅ Sessão 5 — Fila Sequencial, Moderação de Tamanho e Cancelamento de Downloads (14 Jun 2026, fim de noite)
- [x] **Fila de Processamento Global**: Fila sequencial no scraper para processar um lote por vez, mitigando problemas de rede e rate-limits.
- [x] **Limite de 1.5 GB**: Detecção de arquivos gigantes, redirecionando-os para moderação com fotos de capa e metadados no banco.
- [x] **Painel de Moderação**: Grid de moderação sysadmin com fotos de capa e botões Aprovar/Rejeitar integrados.
- [x] **Cancelamento Ativo**: Ação de cancelar downloads ativos no painel de administração, interrompendo streams e limpando arquivos parciais.
- [x] **Exclusão Resiliente**: Limpeza imediata de arquivos temporários em caso de erro ou interrupção.
- [x] **Anti-Duplicação Silenciosa**: Rejeição silenciosa e imediata de itens idênticos já indexados ou pendentes na fila, anexando apenas novas imagens para evitar poluição visual de logs duplicados.
- [x] **TypeScript & Build**: Validação e build bem-sucedidos em Next.js e scraper.

### ✅ Sessão 6 — Sistema SaaS e Pagamentos Stripe (16/17 Jun 2026)
- [x] **Página de Faturamento (`/dashboard/billing`)**: Interface amigável exibindo plano atual, saldo de créditos e opções para assinatura mensal ou pacotes de créditos avulsos.
- [x] **Rota de Checkout (`/api/checkout`)**: Criação de sessões Stripe Checkout dinâmicas com suporte a pagamentos PIX/Cartão tanto para produtos unitários quanto para assinaturas.
- [x] **Webhook do Stripe (`/api/webhooks/stripe`)**: Automação segura (com validação de assinatura) de recebimento de pagamentos, injetando saldo na carteira e registrando as operações na ledger (`transactions`).
- [x] **Compra Créditos**: Checkout seguro para compra de pacotes e assinatura com Stripe.
- [x] **Admin - Visão 360 do Usuário**: Modal detalhado no painel Sysadmin consolidando perfil, plano, saldos, ledger de transações e chamados de suporte abertos pelo usuário.
- [x] **Auditoria Administrativa**: O painel Sysadmin agora registra automaticamente na tabela de `transactions` quando um admin altera manualmente os créditos de um usuário, garantindo a trilha de auditoria contábil.
- [x] **TypeScript & Build**: Projeto compilando nativamente (`npx tsc --noEmit`).

---

### 🏃 Fase 1 — Estabilização (Próximos passos imediatos)

> **Objetivo:** Completar o que foi iniciado e fechar gaps que afetam experiência real de usuário.

#### P1.1 — Sincronizar `pricingSettings` com o banco
- [x] Ao fazer login: buscar `user_pricing_settings` e popular o Zustand
- [x] Ao alterar configuração: fazer upsert na tabela

#### P1.2 — Fontes 3D reais no Configurador
- Converter Montserrat, Playfair Display, Lobster de TTF → JSON (facetype.js)
- Hospedar no Supabase Storage
- Remover label "Draft" da UI quando funcionarem
- **Impacto:** Feature advertida mas nunca entregue

#### P1.3 — Mobile: sidebar responsiva
- Trocar sidebar fixa por drawer/sheet (Radix Dialog ou nativo)
- Menu hamburger no header do dashboard
- **Impacto:** App atualmente inacessível em telefone

#### P1.4 — Salvar Projetos no Configurador
- [x] Botão "Salvar" no Configurador3D
- [x] Upsert em `saved_projects` com nome + config_state atual
- [x] Listagem na dashboard com botão "Continuar editando"

---

### 🚀 Fase 2 — Features Essenciais

#### P2.1 — Telegram STL Search (backend real)
- [x] Criar tabela `telegram_indexed_stls` e `telegram_scraper_jobs` com RLS apropriado.
- [x] Desenvolver script de Userbot (Node/GramJS) com buffer e hashtags.
- [x] Criar fila global sequencial de downloads e processamento no scraper.
- [x] Criar controle de moderação e aprovação manual para arquivos > 1.5 GB.
- [x] Adicionar suporte para cancelamento ativo e limpeza resiliente do HD local.

#### P2.2 — Hub Maker com conteúdo real
- Tabela `hub_resources` (type: video/link/download, title, url, thumbnail)
- CRUD no admin para gerenciar recursos
- Embed de vídeos YouTube
- Links reais de STLs de calibração

#### P2.3 — CRUD de catálogo no Admin
- Formulário criar/editar `catalog_items`
- JSON editor para `params_schema`
- Upload de thumbnail
- Toggle is_active

---

### 🌟 Fase 3 — Gestão Comercial & Monetização

> **Objetivo:** Adicionar ferramentas de vendas (cotações, CRM básico, canais de envio) e monetização direta.

#### P3.1 — Módulo de Cotações a partir de Precificações
- [x] **Criação de Cotação**: Botão na Calculadora ou Portfólio para "Gerar Cotação" a partir do cálculo.
- [x] **Estrutura de Dados**: Tabela `quotations` ligada ao usuário e a um cliente.
- [x] **Exportação para PDF**: Geração de PDF profissional da cotação (breakdown de custos e observações) usando a função nativa `@media print` estilizada para download direto.
- [x] **Histórico**: Tela de Histórico de Cotações com listagem, filtros de status (*Rascunho*, *Enviada*, *Aprovada*, *Recusada*) e ações de exclusão.

#### P3.2 — CRM de Clientes Básico
- [x] **Cadastro de Clientes**: Tabela `customers` (Nome, E-mail, WhatsApp, Telegram, Notas).
- [x] **Associação**: Vincular cotações a um cliente cadastrado para facilidade de gestão de vendas.

#### P3.3 — Compartilhamento Multicanal (Telegram, WhatsApp, Email)
- [x] **WhatsApp**: Link direto de compartilhamento (`wa.me`) formatado com mensagem personalizada e link do orçamento.
- [x] **Email**: Envio de e-mail com corpo formatado utilizando o protocolo `mailto:` nativo.
- [x] **Telegram**: Envio simplificado de link com link preview pré-formatado.

#### P3.4 — Filtros e Busca nas Telas
- [x] **Cotações**: Filtros por status, cliente e busca por nome.
- [x] **Portfólio & Clientes**: Filtros refinados por categoria/origem e busca textual dinâmica reativa no client.
- [ ] **Histórico & STL Search**: Filtros por data/grupo nos canais de STL e histórico de transações.

#### ✅ P3.5 — Compra de Créditos (Gateway de Pagamento Stripe)
- [x] **Integração**: Checkout transparente com redirecionamento para Stripe Checkout.
- [x] **Pacotes de Créditos**: Interface na área de perfil/créditos para seleção de planos ou recarga avulsa de créditos.
- [x] **Webhook de Confirmação**: API de rota que recebe o evento do Stripe e credita a carteira do usuário registrando tudo na contabilidade (`transactions`).

---

### 💎 Fase 4 — Diferenciação & Escalabilidade

- **Undo/Redo** no configurador (histórico de `ParametricValues`)
- **Compartilhar configuração via URL** (query params serializados)
- **Canvas snapshot** → thumbnail automático ao salvar no portfólio
- **Marketplace LB**: usuários vendem configurações parametrizadas
- **IA Generativa**: prompt de texto → parâmetros 3D automáticos
- **Integração Bambu Cloud**: sync de perfis de impressão reais
- **STL Viewer**: visualizar modelo antes de baixar (peso, dimensões, análise básica)
- **Multi-dispositivo**: sincronização total do estado entre sessões

---

## 🏷️ Glossário

| Termo | Significado |
|-------|-------------|
| **Credits** | Moeda interna da plataforma usada para ações pagas |
| **Profile** | Dados do usuário no banco (role, plan, credits) |
| **CatalogItem** | Template de produto parametrizável |
| **PortfolioItem** | Modelo adicionado ao portfólio pelo usuário |
| **SavedProject** | Configuração do configurador salva pelo usuário |
| **Transaction** | Registro de movimento de créditos (+/-) |
| **FeatureCost** | Custo em créditos de uma feature por plano |
| **hybrid_parametric** | Item que combina base geométrica + texto 3D |
| **image_to_3d** | Item que converte imagem em modelo 3D |
| **CSG** | Constructive Solid Geometry: union, subtract em 3D |
| **sysadmin** | Role especial com acesso total ao admin panel |

---

## 📋 Convenções de Desenvolvimento

- **Atualizar `PROJETO.md`** a cada sessão antes de fazer commits
- Bugs resolvidos → mover de "Issues Ativas" para "✅ Concluído" no roadmap
- Novos módulos → adicionar na tabela de Status dos Módulos
- TypeScript: manter `npx tsc --noEmit` passando sem erros antes de commitar
- Features novas → criar issues na seção "Issues e Dívidas Técnicas" antes de implementar

---

*Criado: 14 Jun 2026 · Atualizado automaticamente a cada sessão de desenvolvimento.*
