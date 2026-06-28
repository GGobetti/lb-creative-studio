# Code Style & Conventions — LB Creative Studio

Guia de padrões de código do projeto. Todos os devs devem seguir isso.

---

## TypeScript & Typing

### Tipos Compartilhados

Coloque tipos reutilizáveis em `src/lib/supabase.ts` (ou em um `types/` se crescer).

```typescript
// ✅ BOM: tipo global
export type STLRecord = {
  id: string
  title: string
  file_name: string
  file_size_bytes: number
  r2_object_key: string | null
  photos: string[]
  moderation_status: 'pending' | 'approved' | 'rejected'
  download_count: number
}

// ❌ RUIM: tipo só local, repetido em vários componentes
interface STL {
  id: string
  title: string
  // ...
}
```

### Nomeação de Tipos

- **Use PascalCase** para tipos, interfaces, enums
- **Prefixe generics** se forem específicos: `PhotMatchVotePayload`, não `VotePayload`
- **Use `type` para unions**, `interface` para objetos que crescem

```typescript
// ✅ BOM
type ModStatus = 'pending' | 'approved' | 'rejected'
type PhotoMatchVotePayload = { stl_id: string; is_correct: boolean }

interface PhotoMatchGameState {
  current_stl: STLRecord | null
  user_vote_history: Map<string, boolean>
}

// ❌ RUIM
type Status_Types = 'pending' | 'approved' | 'rejected'
interface Vote {
  stl_id: string
  isCorrect: boolean // misture snake_case e camelCase
}
```

### Never `any`

```typescript
// ❌ RUIM
const response: any = await fetch(...)

// ✅ BOM
const response: Response = await fetch(...)
// ou se Response não é específico:
interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
const response: ApiResponse<STLRecord[]> = await fetch(...).json()
```

---

## Naming Conventions

### Variables & Functions

- **camelCase** para variáveis, funções, métodos
- **PascalCase** para componentes React, classes, tipos
- **snake_case** APENAS para:
  - Colunas de banco (usamos snake_case no Supabase)
  - Env vars (`STRIPE_SECRET_KEY`)
  - JSON keys que vêm da API

```typescript
// ✅ BOM
const userCredits = 50
const getDownloadCost = (plan: UserPlan): number => { ... }
const handlePhotoSubmit = () => { ... }

// ❌ RUIM
const user_credits = 50           // é variável, não coluna
const GetDownloadCost = (...) // funções não começam com maiúscula
const handle_photo_submit = () // misturando conventions
```

### Component Names

- **PascalCase** + `.tsx`
- **Sufixo descritivo**: `PhotoMatchGame.tsx`, não `Game.tsx`

```
✅ BOM:
src/components/games/PhotoMatchGame.tsx
src/components/games/CategoryClassifierGame.tsx
src/components/stl-search/STLDownloadModal.tsx

❌ RUIM:
src/components/games/Game.tsx (genérico demais)
src/components/games/photo-match.tsx (componente React = PascalCase)
```

### Boolean Variables

Prefixe com `is`, `has`, `can`:

```typescript
// ✅ BOM
const isLoading = true
const hasError = false
const canVote = user.credits > 0

// ❌ RUIM
const loading = true             // ambíguo
const error = false              // deveria ser um objeto Error
const vote = true                // vote é ação, não estado
```

---

## React & Components

### Functional Components Only

Sempre use functional components com hooks. Classes são obsoletas.

```typescript
// ✅ BOM
export default function PhotoMatchGame() {
  const [currentSTL, setCurrentSTL] = useState<STLRecord | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // ...
  }, [])

  return <div>...</div>
}

// ❌ RUIM
class PhotoMatchGame extends React.Component {
  // ...
}
```

### Props Typing

Sempre faça type ou interface para props. Não use `any`.

```typescript
// ✅ BOM
interface PhotoMatchGameProps {
  stl: STLRecord
  onVote: (isCorrect: boolean) => void
  disabled?: boolean
}

export function PhotoMatchGame({ stl, onVote, disabled = false }: PhotoMatchGameProps) {
  // ...
}

// ❌ RUIM
export function PhotoMatchGame(props: any) {
  // não dá pra saber qual prop espera
}

// ❌ RUIM
export function PhotoMatchGame({ stl, onVote }: { stl: any; onVote: any }) {
  // type inline, difícil de reutilizar
}
```

### Hooks Organization

Agrupe hooks no topo do componente, nesta ordem:
1. `useState` (estado)
2. `useEffect` (efeitos colaterais)
3. Custom hooks
4. Outros hooks

```typescript
// ✅ BOM
export function PhotoMatchGame({ stl, onVote }: PhotoMatchGameProps) {
  // State
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Effects
  useEffect(() => {
    // fetch initial data
  }, [stl.id])

  useEffect(() => {
    // track analytics
  }, [selectedPhoto])

  // Custom hooks
  const { user } = useAuth()

  // Handlers
  const handleVote = async () => { ... }

  return <div>...</div>
}
```

### Never `dangerouslySetInnerHTML`

```typescript
// ❌ RUIM
<div dangerouslySetInnerHTML={{ __html: userText }} />

// ✅ BOM
<div>{userText}</div> // React já escapa por padrão
```

### Event Handlers

Prefixe com `handle`:

```typescript
// ✅ BOM
const handleVoteClick = (isCorrect: boolean) => { ... }
const handleModalClose = () => { ... }

// ❌ RUIM
const onVote = (isCorrect: boolean) => { ... }  // prefixo é pra props, não handlers internos
const closeModal = () => { ... }               // sem ação clara
```

---

## API Routes & Server Code

### Error Handling

Sempre retorne status codes apropriados:

```typescript
// ✅ BOM
export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID ausente.' }, { status: 400 })
    }

    const data = await database.fetch(id)
    if (!data) {
      return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('[API Route Name] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}

// ❌ RUIM
export async function POST(request: Request) {
  const data = await database.fetch(id) // pode explodir com 500 silencioso
  return NextResponse.json(data)         // sem status específico
}
```

### Logging

Use console com prefixo da rota/função:

```typescript
// ✅ BOM
console.log('[Telegram Download] Starting download for user:', userId)
console.error('[Telegram Download] R2 fetch failed:', error.message)

// ❌ RUIM
console.log('Starting download')  // qual rota? qual operação?
console.log(error)                // sem contexto
```

### Server vs. Client

Marque funções server com comentário claro:

```typescript
// ✅ BOM — arquivo: src/app/api/games/submit-vote/route.ts
// Server-only: executa no backend, pode usar service role key
export async function POST(request: Request) {
  const serviceSupabase = getSupabaseServiceRole()
  // ...
}

// Client-side: executa no browser
'use client'
export function VoteButton() {
  const handleVote = async () => {
    const response = await fetch('/api/games/submit-vote', {
      method: 'POST',
      body: JSON.stringify({ ... })
    })
  }
}
```

---

## Database & Supabase

### Column Naming

Banco usa **snake_case**:

```sql
-- ✅ BOM
CREATE TABLE users (
  id uuid PRIMARY KEY,
  full_name text,
  created_at timestamp default now(),
  is_admin boolean default false
)

-- ❌ RUIM
CREATE TABLE users (
  id uuid PRIMARY KEY,
  fullName text,           -- camelCase no banco é confuso
  CreatedAt timestamp      -- inconsistente
)
```

### ORM/Query Patterns

Use Supabase JS client:

```typescript
// ✅ BOM
const { data, error } = await supabase
  .from('telegram_indexed_stls')
  .select('id, title, file_size_bytes')
  .eq('id', stlId)
  .single()

if (error) throw new Error(error.message)

// ❌ RUIM
const data = await supabase
  .from('telegram_indexed_stls')
  .select('*')                    // seleciona tudo (ineficiente)
  .eq('id', stlId)
  // .single() (se espera 1, deve usar single)

// Sem error check
```

### RLS & Service Role

Documentar quando você está bypassando RLS:

```typescript
// ✅ BOM — Servidor, precisa bypass RLS
const adminSupabase = getSupabaseServiceRole()
const { data } = await adminSupabase
  .from('profiles')
  .select('*')  // sem RLS, vê todas as profiles

// Client-side
const userSupabase = getSupabaseUserClient(token)
const { data } = await userSupabase
  .from('profiles')
  .select('*')  // com RLS, só vê sua profile
```

---

## Imports & Exports

### Named vs Default Exports

Use **named exports** por padrão. Default só para componentes principais:

```typescript
// ✅ BOM — arquivo: src/components/games/PhotoMatchGame.tsx
export default function PhotoMatchGame() { ... }  // componente principal

// ✅ BOM — arquivo: src/lib/supabase.ts
export function getSupabaseUserClient(token: string) { ... }
export function getSupabaseServiceRole() { ... }
export type STLRecord = { ... }

// ❌ RUIM
export default { getSupabaseUserClient, getSupabaseServiceRole }
// ou
export default function getSupabaseUserClient() { ... }
```

### Import Order

1. External libraries
2. Absolute imports (src/)
3. Relative imports
4. Blank line entre grupos

```typescript
// ✅ BOM
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getSupabaseUserClient } from '@/lib/supabase'

import { PhotoMatchCard } from './PhotoMatchCard'
import { VoteButtons } from './VoteButtons'

// ❌ RUIM
import { Button } from '@/components/ui/button'
import React from 'react'
import { PhotoMatchCard } from './PhotoMatchCard'
import { getSupabaseUserClient } from '@/lib/supabase'
// tudo misturado
```

---

## Comments & Documentation

### Only "Why", Not "What"

```typescript
// ❌ RUIM
// Incrementar contador
download_count++

// ✅ BOM
// Incrementar contador de downloads pra incluir em recomendações do sistema
download_count++
```

### Only When Non-Obvious

```typescript
// ✅ BOM — explica uma decisão não-óbvia
// Usar primeiro arquivo como fallback pra parent, pois múltiplas variantes
// precisam de um r2_object_key mas só baixam a selecionada
const parentR2Key = r2Keys[0]

// ❌ RUIM
// Definir title
const title = name
```

### No Comment Blocks

Docstrings em TypeScript são puro ruído:

```typescript
// ❌ RUIM
/**
 * Busca um STL do banco de dados
 * @param {string} stlId - ID do STL
 * @returns {Promise<STLRecord>} O registro do STL
 */
async function fetchSTL(stlId: string): Promise<STLRecord> {
  // ...
}

// ✅ BOM — tipo e nome falam por si
async function fetchSTL(stlId: string): Promise<STLRecord> {
  // ...
}
```

---

## Testing

### Test File Naming

Co-locate test files com source:

```
src/
  components/
    PhotoMatchGame.tsx
    PhotoMatchGame.test.tsx    ← test file next to component
  lib/
    supabase.ts
    supabase.test.ts
```

### Test Organization

```typescript
// ✅ BOM
describe('PhotoMatchGame', () => {
  it('renders current STL photo', () => {
    // ...
  })

  it('disables vote button when isSubmitting is true', () => {
    // ...
  })

  describe('handleVote', () => {
    it('calls onVote with correct parameter', () => {
      // ...
    })
  })
})
```

---

## Linting & Formatting

### ESLint + Prettier

Já configurados. Rodar antes de commitar:

```bash
npm run lint      # achar problemas
npm run format    # auto-fix formatting
npm run type-check # verificar tipos
```

### Pre-commit Hook

Opcional, mas recomendado:

```bash
# .husky/pre-commit
npm run type-check
npm run lint
```

---

## Summary

| Aspecto | Padrão |
|---------|--------|
| Variáveis | `camelCase` |
| Componentes React | `PascalCase` |
| Tipos/Interfaces | `PascalCase` |
| Banco de dados | `snake_case` |
| Booleans | `isX`, `hasX`, `canX` |
| Handlers | `handleX` |
| Props Types | Always typed (no `any`) |
| Comments | Só "Why", não "What" |
| Error Handling | Sempre try-catch, log com contexto |
| RLS | Documentar quando bypass |

---

## Checklist Antes de Commitar

- [ ] Sem `any` types
- [ ] Nomes descritivos (sem `temp`, `foo`, `x`)
- [ ] Erros logados com contexto: `console.error('[Route] message')`
- [ ] Sem `console.log` em produção (só em dev)
- [ ] Props tipadas
- [ ] Comentários só explicam "why", não "what"
- [ ] `npm run lint` passa
- [ ] `npm run type-check` passa
- [ ] Testes adicionados (se lógica nova)

Pronto! Você está alinhado com o style do projeto. 🎯
