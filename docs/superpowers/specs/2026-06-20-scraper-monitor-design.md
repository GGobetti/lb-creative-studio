---
title: Tela de Monitoramento do Scraper Telegram
date: 2026-06-20
status: approved
---

# Design: Tela de Monitoramento do Scraper Telegram

## Objetivo

Criar uma página de dashboard em tempo real para monitorar o status do scraper CLI independente, visualizar fila de aprovações e moderar imagens antes que arquivos sejam indexados na aplicação.

## Contexto

O scraper agora é um CLI independente (`lb-creative-scrapper`) que:
- Varre grupos Telegram periodicamente
- Baixa arquivos STL/ZIP e fotos
- Cria jobs na tabela `telegram_scraper_jobs`
- Faz upload para Vault (outro grupo Telegram)
- Indexa no Supabase

A tela de admin existente (`ScraperTab.tsx`) é complexa. Precisamos de uma **página de monitor separada** que:
- Roda aberta constantemente (monitor em tempo real)
- Foco em: **aprovação de arquivos + moderação de fotos**
- Ações rápidas e frequentes

## Localização & Acesso

- **Rota:** `/dashboard/scraper-monitor`
- **Arquivo:** `src/app/dashboard/scraper-monitor/page.tsx`
- **Acesso:** Autenticado + role `sysadmin`
- **Tipo:** Client component (usa realtime)

## Layout: Dois Painéis

### Coluna Esquerda (40%)

#### 1. Card de Status (sticky/fixo)
- **Indicador visual:** Bola pulsing com cor
  - Verde: `healthy` (diff < 120s)
  - Amarelo: `warning` (diff < 300s)
  - Vermelho: `offline` (diff >= 300s)
  - Cinza: `unknown` (sem heartbeat)
- **Texto:** "Servidor Ativo há 2m" / "Offline há 5m" / "Status Desconhecido"
- **Botão:** Refresh manual (ícone `RefreshCw`)

#### 2. Resumo Rápido (badges)
Layout em linha com 4 badges:
- `5 pendentes` (indigo) → jobs com status `pending`
- `2 em progresso` (multi-cor) → jobs com status downloading/uploading/indexing
- `1 falha` (vermelho) → jobs com status `failed`
- `12 completados` (verde) → jobs com status `completed`

#### 3. Jobs em Progresso (scrollável, altura máx 400px)
Lista de jobs com status ativo: `downloading_file`, `uploading_vault`, `indexing`

**Cada item mostra:**
```
📄 coruja.stl | Baixando 60% | LB Creative STLs
```

- Nome do arquivo (truncado)
- Status + progresso (%)
- Origem (chat_title)
- Cor de fundo leve por status (azul para download, roxo para upload, âmbar para indexação)

**Atualização:** Polling a cada 3s para campo `progress`

#### 4. Histórico Recente (mini seção, altura máx 200px)
Últimos 5 jobs com status `completed` ou `failed`:
```
✅ modelo123.stl | LB Creative STLs | 2m atrás
❌ erro_arquivo.zip | Grupo X | 5m atrás
```

---

### Coluna Direita (60%)

**Abas internas:** dois tabs selecionáveis

#### Tab 1: Fila de Aprovação

**Descrição:** Arquivos que excederam limite automático de tamanho (default 750 MB), aguardando aprovação manual.

**Layout:** Grid responsivo (1-2 colunas em desktop)

**Cada Card:**
- **Imagem:** Thumbnail (primeira foto) ou placeholder com ícone
- **Nome:** Nome do arquivo (título)
- **Origem:** Chat/grupo (subtítulo)
- **Tamanho:** Badge no topo-direito (ex: "2.5 GB")
- **Data:** Data de criação (pequeno)
- **Botões:** 
  - Verde: `✅ Aprovar`
  - Vermelho-claro: `❌ Rejeitar`
- **Ação ao hover:** Overlay "Ver Detalhes"

**Ações:**
- Click em "Ver Detalhes" → abre modal com gallery de fotos + info completa + opções de editar fotos
- "Aprovar" → envia pra API `/api/telegram/jobs` com action `approve`, remove card
- "Rejeitar" → envia pra API `/api/telegram/jobs` com action `reject`, remove card

**Paginação:** "Ver Mais / Ver Menos" (mostra 3 por padrão, depois todas)

**Empty State:** "Nenhum arquivo aguardando aprovação no momento."

---

#### Tab 2: Moderação de Fotos

**Descrição:** Grid de todas as imagens dos jobs pendentes/em progresso. Útil pra barrar propaganda ou conteúdo indesejado.

**Layout:** Grid 6 colunas (responsivo: 3-4 em tablet, 2 em mobile)

**Cada Imagem:**
- **Aspecto:** Quadrado (aspect-square)
- **Border:** Cinza-claro por padrão
- **Checkbox:** Invisível até hover → aparece no topo-direito
- **Ao selecionar:** 
  - Border fica vermelho
  - Imagem fica um pouco opaca (80%)
  - Escala um pouco menor (scale-95)
- **Erro de carregamento:** Mostra "Foto Expirada" em vermelho

**Barra de Ação (ao selecionar):**
- Botão "Desmarcar Todos"
- Botão "Ignorar X selecionadas" (cinza, localStorage)
- Botão "🚫 Banir X selecionadas" (vermelho, ativa POST)

**Fluxo de Banning:**
1. Calcula hash perceptual de cada imagem
2. POST pra `/api/telegram/banned-images` com hash + URL
3. Adiciona à tabela `telegram_banned_images`
4. Remove foto da view, desmarcar, alerta de sucesso

**Empty State:** "Nenhuma foto aguardando moderação."

---

## Atualização em Tempo Real

### Supabase Realtime (Websocket)

**Canais:**
1. `telegram_scraper_jobs` → eventos INSERT, UPDATE
2. `telegram_scraper_settings` → eventos UPDATE (heartbeat)

**Listeners:**
- Qualquer mudança → refetch jobs inteiros
- Heartbeat muda → update status visual

### Polling Local

**A cada 3 segundos:**
- Buscar progresso de jobs com status `downloading_file`
- Atualizar campo `progress` visualmente

---

## Componentes & Reutilização

| Componente | Origem | Adaptação |
|-----------|--------|-----------|
| Status indicator + badge | `ScraperTab.tsx:722-745` | Copiar, simplificar |
| Cards de jobs | `ScraperTab.tsx:455-514` | Copiar estrutura |
| Grid de imagens | `ScraperTab.tsx:594-629` | Copiar estrutura + lógica |
| Tabs | `ScraperTab.tsx:410-428` | Simplificar (só 2 abas) |
| Realtime logic | `ScraperTab.tsx:144-165` | Copiar pattern |
| API calls | Existentes | Reutilizar `/api/telegram/jobs` e `/api/telegram/banned-images` |

---

## Fluxo de Dados

```
Usuário abre página
  ↓
Carrega estado inicial (jobs, settings)
  ↓
Inscreve em Realtime (telegram_scraper_jobs, telegram_scraper_settings)
  ↓
A cada 3s: polling de progresso
  ↓
Usuário clica "Aprovar" / "Rejeitar" / "Banir"
  ↓
POST pra API (job action ou banned-images)
  ↓
Realtime atualiza estado automaticamente
  ↓
UI re-renderiza
```

---

## Estados & Filtros

### Fila de Aprovação
- Mostra: jobs com status `pending_approval`
- Filtro: automático (só pending_approval)

### Moderação de Fotos
- Mostra: todas as fotos de jobs com status `pending_approval`, `downloading_file`, `uploading_vault`, `indexing`
- Filtro: esconde fotos em `dismissedPhotos` (localStorage)
- Filtro automático: remove fotos em blacklist `telegram_banned_images`

### Jobs em Progresso
- Mostra: status em `["pending", "downloading_file", "uploading_vault", "indexing"]`
- Ordenação: mais recentes primeiro

### Histórico Recente
- Mostra: últimos 5 jobs com status em `["completed", "failed"]`
- Ordenação: mais recentes primeiro

---

## Responsividade

- **Desktop (1024px+):** Layout 2 colunas lado-a-lado (40/60)
- **Tablet (768-1023px):** Colunas empilhadas (stacked), total width
- **Mobile:** Stacked vertical, abas com scroll horizontal

---

## Segurança & Validação

1. **Autenticação:** Verificar token JWT
2. **Autorização:** Apenas `sysadmin` pode acessar
3. **API:** Mesmas validações de `/api/telegram/jobs`
4. **Hash de imagens:** Calcular localmente via `getPerceptualHash()` (já existe no projeto)

---

## Dependências

- React 19
- Next.js 16.2.4
- Supabase client (realtime)
- Tailwind CSS
- Radix UI (buttons, etc)
- Framer Motion (animações)
- Lucide React (ícones)
- `getPerceptualHash` (já existe em `lib/imageHash.ts`)

**Nenhuma dependência nova necessária.**

---

## Criação de Páginas

1. `src/app/dashboard/scraper-monitor/page.tsx` → Server component wrapper
2. `src/components/dashboard/ScraperMonitor.tsx` → Client component principal
3. `src/components/dashboard/ScraperMonitorStatus.tsx` → Card de status (opcional, pode ser inline)

---

## Métricas de Sucesso

✅ Status do scraper atualiza em tempo real  
✅ Fila de aprovação aparece e permite aprovar/rejeitar  
✅ Moderação de fotos funciona com seleção múltipla + ban  
✅ Progresso de downloads visível  
✅ Jobs em progresso listados  
✅ Layout responsivo  
✅ Zero dependências novas  

---

## Próximas Etapas

1. Escrever implementation plan (writing-plans)
2. Criar arquivo de página
3. Implementar componente principal
4. Testar realtime + polling
5. Testar ações (aprovar, rejeitar, ban)
6. Verificar responsividade
7. Deploy
