### Task 13: Script de limpeza de títulos legados via IA

**Files:**
- Create: `scripts/cleanup-stl-titles.ts`

**Pré-requisito:**
- `ANTHROPIC_API_KEY` configurada em `.env.local`
- `@anthropic-ai/sdk` instalado (`npm install @anthropic-ai/sdk`)
- `tsx` disponível (`npx tsx`)

**Interfaces:**
- Consumes: `telegram_indexed_stls` (lê `id`, `title`)
- Produces: `telegram_indexed_stls.title` atualizado (somente em modo `--apply`)
- Modo padrão é dry run — imprime o que faria sem alterar nada

**Lógica de detecção de títulos sujos:**
Um título é candidato à limpeza se contiver qualquer um dos padrões:
- `@` (menção de canal)
- `_` (underscore — comum em nomes de arquivo)
- Sequência de maiúsculas com 3+ chars sem vogal (ex: `STL`, `TRX`, `FDM`)
- Começa com número ou símbolo especial
- Tem menos de 3 palavras reais (ex: `modelov2_final`)

- [ ] **Step 1: Instalar dependência se ainda não tiver**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Criar o script**

```typescript
// scripts/cleanup-stl-titles.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = !process.argv.includes('--apply')
const BATCH_SIZE = 20
const DELAY_MS = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function isDirtyTitle(title: string): boolean {
  if (!title) return false
  if (title.includes('@')) return true
  if (title.includes('_')) return true
  if (/[A-Z]{3,}/.test(title) && !/[aeiouAEIOU]/.test(title.replace(/[^A-Za-z]/g, ''))) return true
  if (/^\d/.test(title.trim())) return true
  const wordCount = title.trim().split(/\s+/).filter(w => w.length > 2).length
  if (wordCount < 2) return true
  return false
}

async function cleanTitle(originalTitle: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Você é um assistente de curadoria de STLs (modelos 3D para impressão).
Limpe o título abaixo removendo: nomes de canais Telegram (@canal), underscores, sufixos de versão (v1, v2, _final), abreviações desnecessárias e símbolos especiais.
Deixe o resultado em português brasileiro, descritivo e com no mínimo 2 palavras.
Responda APENAS com o título limpo, sem explicações.

Título original: ${originalTitle}
Título limpo:`,
      },
    ],
  })

  const cleaned = (message.content[0] as { text: string }).text.trim()
  return cleaned || originalTitle
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sem alterações)' : 'APPLY (alterações reais)'}`)
  console.log('Buscando STLs com títulos candidatos à limpeza...\n')

  const { data: stls, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title')
    .not('title', 'is', null)
    .limit(500)

  if (error || !stls) {
    console.error('Erro ao buscar STLs:', error)
    process.exit(1)
  }

  const candidates = stls.filter(s => isDirtyTitle(s.title))
  console.log(`${stls.length} STLs lidos. ${candidates.length} candidatos encontrados.\n`)

  let updated = 0
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)

    for (const stl of batch) {
      const newTitle = await cleanTitle(stl.title)

      if (newTitle === stl.title) {
        console.log(`  SKIP  | ${stl.title}`)
        continue
      }

      console.log(`  CLEAN | "${stl.title}" → "${newTitle}"`)

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('telegram_indexed_stls')
          .update({ title: newTitle })
          .eq('id', stl.id)

        if (updateError) {
          console.error(`  ERRO ao atualizar ${stl.id}:`, updateError)
        } else {
          updated++
        }
      } else {
        updated++
      }

      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\nConcluído. ${updated} títulos ${DRY_RUN ? 'seriam' : 'foram'} atualizados.`)
  if (DRY_RUN) {
    console.log('Para aplicar as mudanças, rode com: npx tsx scripts/cleanup-stl-titles.ts --apply')
  }
}

main().catch(console.error)
```

- [ ] **Step 3: Criar `.env.local` com as vars necessárias (se ainda não tiver)**

```
NEXT_PUBLIC_SUPABASE_URL=<url do projeto>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<sua chave>
```

- [ ] **Step 4: Rodar em dry run primeiro**

```bash
npx tsx scripts/cleanup-stl-titles.ts
# Revisar o output — ver se os títulos limpos fazem sentido
# Ajustar a função cleanTitle ou isDirtyTitle se necessário
```

- [ ] **Step 5: Rodar com --apply após aprovação do dry run**

```bash
npx tsx scripts/cleanup-stl-titles.ts --apply
```

- [ ] **Step 6: Commit do script (sem rodar)**

```bash
git add scripts/cleanup-stl-titles.ts
git commit -m "feat: add AI title cleanup script for legacy STL titles (dry run by default)"
```

---

---

