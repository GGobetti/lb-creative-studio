/**
 * scripts/stl-cleanup/aplicar-limpeza.ts
 *
 * Aplica a limpeza de títulos diretamente no banco (todos os STLs com mudança).
 * Não altera file_name — apenas o campo title.
 *
 * Modo padrão: DRY RUN (mostra o que seria feito)
 * Com --apply: aplica no banco
 *
 * Uso:
 *   npx tsx scripts/stl-cleanup/aplicar-limpeza.ts          # dry run
 *   npx tsx scripts/stl-cleanup/aplicar-limpeza.ts --apply  # aplica
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  })
}
loadEnv()

const DRY_RUN = !process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ---------------------------------------------------------------------------
// Limpeza de título (idêntica ao gerar-preview.ts)
// ---------------------------------------------------------------------------
const CREATOR_PREFIXES = [
  /^Whale3D[-–\s]*Studio\s*/i,
  /^Whale3D[-–\s]*/i,
  /^STLflix\s*[-–]\s*/i,
  /^3DXM\s*[-–]\s*/i,
  /^YoshStudios\s*/i,
  /^DecorMaster\s*/i,
]

const CREATOR_SUFFIXES = [
  /\s*\(Aslan3D\)\s*/gi,
  /[-_\s]+rtprops\b/gi,
  /[-_\s]+DecorMaster\b/gi,
]

function cleanTitle(raw: string): string {
  let text = raw

  text = text.replace(/_?@[\w]+/g, '')
  text = text.replace(/_\d{8}_\d+_[a-z0-9]{4,}/gi, '')
  text = text.replace(/[a-f0-9]{14,}/gi, '')

  for (const re of CREATOR_PREFIXES) text = text.replace(re, '')
  for (const re of CREATOR_SUFFIXES) text = text.replace(re, ' ')

  text = text.replace(/[-_\s]+stls\b/gi, '')
  text = text.replace(/multiparts3mf/gi, 'Multiparts')
  text = text.replace(/\+/g, ' ')
  text = text.replace(/_/g, ' ')
  text = text.replace(/\s*\(\d+\)\s*$/, '')
  text = text.replace(/\.(3mf|stl)\b/gi, '')
  text = text.replace(/\s{2,}/g, ' ')
  text = text.replace(/\s*[-–—]\s*/g, ' - ')
  text = text.replace(/(\s+-\s+)+/g, ' - ')

  const LOWERCASE_WORDS = new Set([
    'de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'os', 'as',
    'the', 'of', 'and', 'in', 'for', 'no', 'na',
  ])
  text = text
    .trim()
    .split(' ')
    .map((word, i) => {
      if (!word) return word
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word
      const lower = word.toLowerCase()
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')

  text = text.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
  return text
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — nenhuma alteração será feita (use --apply para aplicar)\n')
  else console.log('🚀 APLICANDO alterações no banco...\n')

  const PAGE = 1000
  let allStls: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .range(from, from + PAGE - 1)
    if (error) throw error
    allStls = allStls.concat(data ?? [])
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  console.log(`✅ ${allStls.length} STLs carregados`)

  const changes: { id: string; before: string; after: string }[] = []
  for (const stl of allStls) {
    const after = cleanTitle(stl.title ?? '')
    if (after !== stl.title) {
      changes.push({ id: stl.id, before: stl.title, after })
    }
  }

  console.log(`📝 ${changes.length} títulos com alteração\n`)

  if (DRY_RUN) {
    const preview = changes.slice(0, 20)
    preview.forEach(({ before, after }) => {
      console.log(`  ANTES:  ${before}`)
      console.log(`  DEPOIS: ${after}`)
      console.log()
    })
    if (changes.length > 20) console.log(`  ... e mais ${changes.length - 20} alterações`)
    console.log('\nRode com --apply para aplicar.')
    return
  }

  // Aplicar em lotes de 50
  const BATCH = 50
  let applied = 0
  let errors = 0
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async ({ id, after }) => {
        const { error } = await supabase
          .from('telegram_indexed_stls')
          .update({ title: after })
          .eq('id', id)
        if (error) { console.error(`Erro em ${id}:`, error.message); errors++ }
        else applied++
      })
    )
    process.stdout.write(`\r   Aplicados: ${applied}/${changes.length}`)
  }

  console.log(`\n\n✅ Concluído — ${applied} títulos atualizados, ${errors} erros`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
