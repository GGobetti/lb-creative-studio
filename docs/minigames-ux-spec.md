# Minigames UI/UX Spec
> Alinhado com design system: Cyan/Violet, dark-first, glass panels, Inter + Jakarta

---

## Hub de Jogos (`/games`)

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  ARENA DE CURAÇÃO               ⚡ 320 créditos  🔥 3d  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ 📸       │  │ 🏷️       │  │ 🗂️       │  │ ✅     │  │
│  │ PHOTO    │  │ TAG      │  │ CATEGORY │  │ AUDIT  │  │
│  │ MATCH    │  │ DETECTIVE│  │ SORT     │  │ CHECK  │  │
│  │          │  │          │  │          │  │        │  │
│  │ +10 ⚡   │  │ +5 ⚡   │  │ +25 ⚡  │  │ +15 ⚡ │  │
│  │ [Jogar]  │  │ [Jogar]  │  │ [Jogar]  │  │[Jogar] │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                         │
│  Streak ativo: 🔥🔥🔥  → Multiplicador 2x ativo hoje   │
│                                                         │
│  ─────── Progresso de Badges ──────────────────────     │
│  [████████░░] Curador (80/100 pontos → próximo badge)   │
└─────────────────────────────────────────────────────────┘
```

### Tokens aplicados
- Container: `glass-panel` com `dot-pattern` no fundo
- Header crédito: pill `bg-primary/10 text-primary` com `badge-pulse`
- Streak: `text-warning` + emoji
- Cards de game: `card-hover` + border cyan on hover
- Badge progress: `bg-primary` fill no track

---

## Game 1: Photo Match

### Objetivo
Usuário valida se a foto do STL bate com o nome/descrição.

### Layout (full screen modal / route)
```
┌─────────────────────────────────────────────┐
│  ← Sair          PHOTO MATCH         +10 ⚡ │
│  ─────────────────────────────────────────  │
│                                             │
│  ┌─────────────────────┐                   │
│  │                     │   "Porta Medieval  │
│  │   [Imagem do STL]   │    em Arco Gótico" │
│  │                     │                   │
│  │                     │   Descrição:       │
│  │    720 × 720px      │   "Ornate gothic   │
│  │                     │    arch doorway,   │
│  └─────────────────────┘    decorative..."  │
│                                             │
│  A foto representa o arquivo descrito?      │
│                                             │
│   ┌─────────────────┐   ┌────────────────┐  │
│   │  ✓ SIM, confere │   │  ✗ NÃO confere │  │
│   └─────────────────┘   └────────────────┘  │
│                                             │
│  [===========◯=======]  Progresso: 4/10    │
└─────────────────────────────────────────────┘
```

### Estados de feedback
```
[CORRETO]                    [ERRADO]
┌────────────────┐           ┌────────────────┐
│  ✓ Correto!    │           │  ✗ Ops...       │
│  +10 ⚡         │           │  A comunidade   │
│  [popup glow   │           │  diverge: foto  │
│   verde 0.5s]  │           │  será revisada  │
└────────────────┘           └────────────────┘
```

### UX Notes
- **Timer visual** (30s) com barra que esvazia (cor: primary → warning → destructive)
- **Sem opção "não sei"** — força decisão, mas sem punição por erro
- **Sequência de 10** por sessão → resultado final com créditos acumulados
- Animação de slide: próximo card entra da direita

### Componentes
- `PhotoMatchCard` — imagem + texto side-by-side
- `AnswerButton` — variant `success` e `destructive` com hover scale
- `TimerBar` — `h-1 bg-primary` que diminui via CSS animation
- `SessionProgress` — dots 10x (preenchidos conforme avança)

---

## Game 2: Tag Detective

### Objetivo
Usuário vê STL + set de hashtags, indica quais fazem sentido (checkboxes).

### Layout
```
┌─────────────────────────────────────────────┐
│  ← Sair        TAG DETECTIVE         +5 ⚡  │
│  ─────────────────────────────────────────  │
│                                             │
│  ┌───────────────────┐                     │
│  │   [Miniatura STL] │  Remova as tags      │
│  │   Dragon Pendant  │  que NÃO fazem       │
│  │   Jewelry, 45mm   │  sentido:            │
│  └───────────────────┘                     │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ #jewelry │ │ #dragon  │ │ #automotive │ │
│  │    ✓     │ │    ✓     │ │  ← REMOVER  │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ #pendant │ │ #rpg     │ │ #mechanical │ │
│  │    ✓     │ │    ✓     │ │  ← REMOVER  │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
│                                             │
│  [Confirmar seleção]                        │
│                                             │
│  [=========◯=========]  Tag 3/20            │
└─────────────────────────────────────────────┘
```

### UX Notes
- Tags incorretas ficam visualmente "tachadas" ao marcar para remover
- Feedback imediato: tag correta = glow green, errada = shake + vermelho
- **Modo bonus**: se sugerir nova tag relevante = +2 créditos extra
- Sessão de 20 tags (rápido, casual)

### Componentes
- `TagChip` — toggle estado: default / selected-remove / confirmed-correct / confirmed-wrong
- `TagSuggestInput` — input pequeno "sugerir nova tag" (opcional, bonus)

---

## Game 3: Category Classifier

### Objetivo
Usuário recebe 5 STLs e os arrasta para a categoria correta.

### Layout (drag & drop)
```
┌──────────────────────────────────────────────────────┐
│  ← Sair     CATEGORY SORT                   +25 ⚡   │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  Arraste cada modelo para a categoria correta:       │
│                                                      │
│  MODELOS:                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 🐉   │ │ 🔧   │ │ 💍   │ │ ⚽   │ │ 🏠   │      │
│  │Dragon│ │Wrench│ │Ring  │ │Ball  │ │Décor │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│                                                      │
│  CATEGORIAS:                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Figurines   │  │ Functional  │  │   Jewelry   │  │
│  │  [drop]     │  │  [drop]     │  │  [drop]     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │   Sports    │  │    Décor    │                   │
│  │  [drop]     │  │  [drop]     │                   │
│  └─────────────┘  └─────────────┘                   │
│                                                      │
│  [Confirmar]                     Rodada 2/5          │
└──────────────────────────────────────────────────────┘
```

### Versão mobile (sem drag): tap-to-select
```
[Tap no modelo] → [Tap na categoria]
                → flash highlight na categoria destino
```

### UX Notes
- **Drag & drop** via `@dnd-kit/core` (acessível, touch-friendly)
- Mobile fallback: tap-to-assign (tap modelo → tap categoria)
- Drop zone: `border-dashed border-primary/40` → `border-primary` quando hover de drag
- Feedback: ✓ verde ou shake+vermelho ao confirmar round
- 5 rounds por sessão, créditos ao final

### Componentes
- `STLDraggable` — card pequeno com thumbnail + nome
- `CategoryDropZone` — área com label + ícone + contagem de itens dropados
- `RoundResult` — mostra acertos/erros com animação

---

## Game 4: Quality Audit

### Objetivo
Checklist de qualidade de um STL recém-subido. Aprova ou rejeita com justificativa.

### Layout
```
┌─────────────────────────────────────────────────┐
│  ← Sair      QUALITY AUDIT              +15 ⚡  │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │   [Preview 3D rotativo ou imagem HD]    │   │
│  │   "Samurai Helmet - Full Scale"         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Verifique os critérios:                        │
│                                                 │
│  ○ A imagem representa o arquivo?               │
│  ○ O nome é descritivo e claro?                 │
│  ○ A descrição tem pelo menos 20 palavras?      │
│  ○ Tem pelo menos 2 tags relevantes?            │
│  ○ Não é conteúdo adulto/ofensivo?              │
│                                                 │
│  ┌───────────────────┐  ┌───────────────────┐  │
│  │  ✓ APROVAR STL   │  │  ✗ REJEITAR STL   │  │
│  └───────────────────┘  └───────────────────┘  │
│                                                 │
│  [Se rejeitar → dropdown de motivo]             │
│   ○ Imagem não confere   ○ Descrição vazia      │
│   ○ Conteúdo inapropriado ○ Outro               │
└─────────────────────────────────────────────────┘
```

### UX Notes
- Checklist é **visual only** (não precisa marcar) — serve de guia para a decisão
- Rejeição **requer motivo** → motivo ajuda o criador a corrigir
- +15 créditos independente de aprovar ou rejeitar (ação tem valor)
- STL só é efetivamente rejeitado após N usuários rejeitarem (segurança)
- Mostra para o usuário: "Você auditou 47 STLs" (gamificação implícita)

### Componentes
- `AuditChecklist` — lista visual de critérios (não interativa, apenas referência)
- `RejectionReasonSelect` — dropdown com motivos padrão
- `AuditCounter` — "Auditados por você: 47"

---

## Sistema de Recompensas — UI

### Credits Popup (ao ganhar)
```
┌──────────────────────┐
│   +25 ⚡             │
│   Créditos ganhos!   │
│                      │
│   Total: 345 ⚡      │
│   [Ver carteira]     │
└──────────────────────┘
```
- Animação: slide up + fade in, 2s auto-dismiss
- Partículas leves (confetti cyan/violet, apenas em streak ou badge)

### Badge Unlock (ao conquistar)
```
┌──────────────────────────────────────┐
│                                      │
│   🏆  BADGE DESBLOQUEADO!            │
│                                      │
│   ┌────────────────────────────┐     │
│   │  ◆  CURADOR PRATA          │     │
│   │     100 pts alcançados     │     │
│   └────────────────────────────┘     │
│                                      │
│   Novo poder: sua aprovação vale 2x  │
│                                      │
│   [Compartilhar]  [Ver perfil]       │
└──────────────────────────────────────┘
```
- Full-screen overlay com glow animado (badge-pulse)
- Compartilhamento via Web Share API → rede social + referral embutido

### Streak Banner (tela inicial ou hub de games)
```
┌──────────────────────────────────────┐
│  🔥  Streak de 5 dias!               │
│  Multiplicador 2x ativo hoje         │
│  Jogue até 23:59 para manter         │
└──────────────────────────────────────┘
```
- `bg-warning/10 border-warning/30 text-warning`
- Aparece no topo do hub apenas quando streak > 0

---

## Tabela de Pontos/Badges

| Badge | Pontos | Poder desbloqueado |
|-------|--------|--------------------|
| 🥉 Iniciante | 10 | Acesso a todos os games |
| 🥈 Curador | 100 | Aprovações valem 2x |
| 🥇 Especialista | 500 | Streak bonus extra (+5 créditos) |
| 💎 Moderador | 2000 | Aprovação solo (sem precisar de N users) |

---

## Fluxo de Navegação

```
/games                          → Hub com os 4 games
/games/photo-match              → Game Photo Match
/games/tag-detective            → Game Tag Detective
/games/category-sort            → Game Category Sort
/games/quality-audit            → Game Quality Audit
/games/leaderboard              → Top curators da semana
/profile/[user]/badges          → Badges do perfil (público)
```

---

## Anti-Gaming Rules (UX implication)

| Regra | UX feedback |
|-------|-------------|
| Max 50 games/dia por tipo | "Limite diário atingido. Volte amanhã 🌙" |
| Créditos por minigame só confirmados após 24h | "Pendente de validação" badge no extrato |
| Respostas muito rápidas (<2s) ignoradas | Timer mínimo obrigatório antes de habilitar botões |
| Padrão de resposta suspeito (sempre SIM) | Flag silenciosa, sem punição imediata |

---

## Stack técnica sugerida

| Feature | Lib |
|---------|-----|
| Drag & drop (Category Sort) | `@dnd-kit/core` |
| Animações feedback | `framer-motion` (já usa?) ou CSS puro |
| Confetti | `canvas-confetti` (leve, ~3kb) |
| Timer bar | CSS animation via Tailwind |
| Touch drag fallback | `@dnd-kit` nativo (suporta touch) |
