/**
 * scripts/cleanup-stl-titles.ts
 * Limpeza de títulos legados via IA (claude-haiku-4-5)
 *
 * Critérios de título "sujo":
 *  - title contém '@'
 *  - title começa com '@'
 *  - title é idêntico ao file_name (sem extensão)
 *  - title contém underscores ou hifens sem espaços
 *
 * Modo padrão: DRY RUN — processa mas não aplica
 * Com --apply: aplica as alterações no banco
 *
 * Uso:
 *   npx tsx scripts/cleanup-stl-titles.ts           # dry run
 *   npx tsx scripts/cleanup-stl-titles.ts --apply   # aplica
 */

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env loading (padrão dos outros scripts do projeto)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) return
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (key && !(key in process.env)) {
        process.env[key] = value
      }
    })
  }
}

loadEnv()

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DRY_RUN = !process.argv.includes('--apply')
const BATCH_SIZE = 10
const DELAY_BETWEEN_BATCHES_MS = 1000
const MODEL = 'claude-haiku-4-5-20251001'
const FETCH_LIMIT = 2000

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ---------------------------------------------------------------------------
// Dirty title detection
// ---------------------------------------------------------------------------
function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

function isDirtyTitle(title: string, fileName: string | null): boolean {
  if (!title) return false

  // Contém @ (menção de canal/usuário)
  if (title.includes('@')) return true

  // Começa com @
  if (title.startsWith('@')) return true

  // Idêntico ao file_name sem extensão (insensível a case)
  if (fileName) {
    const baseFileName = stripExtension(fileName)
    if (title.toLowerCase() === baseFileName.toLowerCase()) return true
  }

  // Contém underscores ou hifens sem espaços (padrão de nome de arquivo)
  if ((title.includes('_') || title.includes('-')) && !title.includes(' ')) return true

  // Padrão 3: contém 3+ consoantes MAIÚSCULAS consecutivas sem vogal (siglas como STL, TRX, FDM)
  const hasUnclearedAcronym = /\b[B-DF-HJ-NP-TV-Z]{3,}\b/.test(title)
  if (hasUnclearedAcronym) return true

  // Padrão 4: começa com número ou símbolo especial
  const startsWithNumberOrSymbol = /^[\d!@#$%^&*_\-.]/.test(title)
  if (startsWithNumberOrSymbol) return true

  // Padrão 5: string completamente vazia (sem nenhuma palavra real)
  const tooFewWords = title.trim().split(/\s+/).filter(w => w.length > 0).length < 1
  if (tooFewWords) return true

  return false
}

// ---------------------------------------------------------------------------
// AI title cleaning
// ---------------------------------------------------------------------------
async function cleanTitle(fileName: string | null, currentTitle: string): Promise<string> {
  const prompt = `Você está limpando o título de um arquivo STL de impressão 3D.
File name original: ${fileName ?? '(desconhecido)'}
Título atual: ${currentTitle}

Retorne APENAS o título limpo, sem explicação. Regras:
- Remova prefixos @canal e @usuário
- Expanda siglas óbvias de contexto 3D (ex: STL→"Arquivo STL", PLA→PLA)
- Substitua underscores e hifens por espaços
- Capitalize corretamente
- Mantenha nomes próprios e marcas
- Se o título já estiver limpo, retorne-o sem alteração`

  const message = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    { signal: AbortSignal.timeout(15_000) }
  )

  const block = message.content[0]
  if (block.type !== 'text') return currentTitle

  const cleaned = block.text.trim()
  // Sanidade: não aceitar resposta vazia ou muito longa (provavelmente erro)
  if (!cleaned || cleaned.length > 200) return currentTitle

  return cleaned
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------
interface ChangeRecord {
  id: string
  originalTitle: string
  newTitle: string
  fileName: string | null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60))
  console.log(`LIMPEZA DE TÍTULOS STL — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`)
  console.log('='.repeat(60))
  console.log(`Modelo: ${MODEL}`)
  console.log(`Batch size: ${BATCH_SIZE} | Pausa entre batches: ${DELAY_BETWEEN_BATCHES_MS}ms`)
  console.log()

  // Fetch STLs
  console.log(`Buscando até ${FETCH_LIMIT} registros de telegram_indexed_stls...`)
  const { data: stls, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, file_name')
    .not('title', 'is', null)
    .limit(FETCH_LIMIT)

  if (error || !stls) {
    console.error('Erro ao buscar STLs:', error)
    process.exit(1)
  }

  console.log(`${stls.length} registros lidos.`)

  // Filter candidates
  const candidates = stls.filter((s) => isDirtyTitle(s.title, s.file_name))
  console.log(`${candidates.length} títulos candidatos à limpeza.\n`)

  if (candidates.length === 0) {
    console.log('Nenhum título sujo encontrado. Encerrando.')
    return
  }

  // Process in batches
  const changes: ChangeRecord[] = []
  const skipped: string[] = []
  const errors: { id: string; error: string }[] = []

  let processed = 0

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE)
    console.log(`--- Batch ${batchNum}/${totalBatches} ---`)

    for (const stl of batch) {
      try {
        const newTitle = await cleanTitle(stl.file_name, stl.title)
        processed++

        if (newTitle === stl.title) {
          console.log(`  SKIP  | ${stl.title}`)
          skipped.push(stl.title)
          continue
        }

        console.log(`  CLEAN | "${stl.title}" → "${newTitle}"`)
        changes.push({
          id: stl.id,
          originalTitle: stl.title,
          newTitle,
          fileName: stl.file_name,
        })

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('telegram_indexed_stls')
            .update({ title: newTitle })
            .eq('id', stl.id)

          if (updateError) {
            console.error(`  ERRO  | id=${stl.id}:`, updateError.message)
            errors.push({ id: stl.id, error: updateError.message })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ERRO  | id=${stl.id}: ${msg}`)
        errors.push({ id: stl.id, error: msg })
      }
    }

    // Delay between batches (not after the last one)
    if (i + BATCH_SIZE < candidates.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  // Final report
  console.log()
  console.log('='.repeat(60))
  console.log('RELATÓRIO FINAL')
  console.log('='.repeat(60))
  console.log(`Candidatos encontrados : ${candidates.length}`)
  console.log(`Processados            : ${processed}`)
  console.log(`Com mudança            : ${changes.length}`)
  console.log(`Sem mudança (SKIP)     : ${skipped.length}`)
  console.log(`Erros                  : ${errors.length}`)
  console.log()

  if (changes.length > 0) {
    console.log(`Títulos que ${DRY_RUN ? 'SERIAM' : 'FORAM'} alterados:`)
    changes.forEach((c) => {
      console.log(`  [${c.id}] "${c.originalTitle}" → "${c.newTitle}"`)
    })
  }

  if (errors.length > 0) {
    console.log('\nErros:')
    errors.forEach((e) => console.log(`  [${e.id}] ${e.error}`))
  }

  console.log()
  if (DRY_RUN) {
    console.log('Modo DRY RUN — nenhuma alteração foi aplicada.')
    console.log(
      'Para aplicar, rode: npx tsx scripts/cleanup-stl-titles.ts --apply',
    )
  } else {
    console.log(`${changes.length - errors.length} títulos atualizados com sucesso.`)
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
