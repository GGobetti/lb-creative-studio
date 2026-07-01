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
  /^STLflix\s*[-–\s]*/i,
  /^3DXM\s*[-–\s]*/i,
  /^YoshStudios\s*/i,
  /^DecorMaster\s*/i,
  /^GeekSculpt3D\s*[-–\s]*/i,
  /^Hex3D\s*[-–\s]*/i,
  /^[Оo]3dlab\s*[-–\s]*/i,  // Cirílico О + latin o
  /^@?o3dlab\s*[-–\s]*/i,
  /^Aslan3D\s*[-–\s]*/i,
  /^Allstlbrasill\s*[-–\s]*/i,
  /^@allstlbrasill\s*[-–\s]*/i,
  /^@avante3d\s*[-–\s]*/i,
  /^Print3DWorld\s*[-–\s]*/i,
  /^@?stl3dbrasil\s*[-–\s]*/i,
  /^Boxi3d\s*[-–\s]*/i,
]

const CREATOR_SUFFIXES = [
  /\s*\(Aslan3D\)\s*/gi,
  /[-_\s]+rtprops\b/gi,
  /[-_\s]+DecorMaster\b/gi,
  /[-_\s]+GeekSculpt3D\b/gi,
  /[-_\s]+Hex3D\b/gi,
  /[-_\s]+O3dlab\b/gi,
  /[-_.,\s]+model[-_\s]*files?\b/gi,
]

// ---------------------------------------------------------------------------
// Traduções manuais de títulos em CJK (chinês/japonês/coreano)
// ---------------------------------------------------------------------------
const CJK_TRANSLATIONS: Record<string, string> = {
  '栗宝宝': 'Castanha Baby',
  '巨无霸汉堡mw': 'Caixa de Lenços/Papeleira Big Mac Hamburguer',
  '新炭治郎25厘米高拆件 无多色打印': 'Tanjiro 25cm - (Multipartes - NO-AMS)',
  '冰淇淋玩具': 'Sorvete Brinquedo',
  '三层收纳盘': 'Organizador 3 Níveis',
  'USB C清洁器': 'Limpador USB',
  '仿真手铐': 'Algemas Realistas',
  '双色无牙仔手机支架': 'Suporte Celular Dragão',
  '标准18.2cm Bowser1.3': 'Bowser 18.2cm',
  '收纳盒土王': 'Organizador Rei da Terra',
}

function cleanTitle(raw: string): string {
  let text = raw

  // ── 0. Tradução CJK ───────────────────────────────────────────────────────
  if (/[一-鿿぀-ヿ가-힯]/.test(text)) {
    // Busca tradução exata primeiro
    if (CJK_TRANSLATIONS[text.trim()]) return CJK_TRANSLATIONS[text.trim()]
    // Se não tem tradução exata, remove os caracteres CJK e continua a limpeza
    text = text.replace(/[一-鿿぀-ヿ가-힯]+/g, ' ')
  }

  // ── 1. Extrair flags antes de limpar ──────────────────────────────────────
  // Detectar variantes de Multipartes
  const hasMultipartes = /multi[\s_-]?p(art(e?s?|i[eè]ces?)|artes?)|multipieces?/i.test(text)
  // Detectar variantes de NO-AMS
  const hasNoAms = /no[\s_-]?ams|sem[\s_-]?ams|noams/i.test(text)

  // ── 2. Remover todas as variantes do texto ────────────────────────────────
  // Multipartes (todas as formas)
  text = text.replace(/[-_\s]*multi[\s_-]?p(art(e?s?|i[eè]ces?)|artes?)[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*multipieces?[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*MULTI[\s_-]PART[-_\s]*/g, ' ')

  // NO-AMS (todas as formas)
  text = text.replace(/[-_\s]*no[\s_-]?ams[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*sem[\s_-]?ams[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*noams[-_\s]*/gi, ' ')

  // ── 3. Remoções gerais ────────────────────────────────────────────────────
  text = text.replace(/_?@[\w]+/g, '')
  text = text.replace(/_\d{8}_\d+_[a-z0-9]{4,}/gi, '')
  // Hashes hexadecimais 8+ chars (ex: 34c17d6abc, beacb6daa9bc7baf5648)
  // Lookahead garante ≥1 letra a-f (diferencia de número puro tipo 2024, 12345678)
  text = text.replace(/(?=.*[a-f])[a-f0-9]{8,}/gi, '')

  for (const re of CREATOR_PREFIXES) text = text.replace(re, '')
  for (const re of CREATOR_SUFFIXES) text = text.replace(re, ' ')

  // Impressoras e slicers
  text = text.replace(/\bLABA1\b/gi, '')
  text = text.replace(/\bBambu\s*Lab\b/gi, '')
  text = text.replace(/\bBambulab\b/gi, '')
  text = text.replace(/\bBambu\s*Studio\b/gi, '')
  text = text.replace(/\bBambustudio\b/gi, '')
  text = text.replace(/\bBambulabprinter\b/gi, '')
  text = text.replace(/\bBambu\s*Laba?\d*\b/gi, '')
  text = text.replace(/\bBambu\b/gi, '')
  text = text.replace(/\bChitubox\b/gi, '')
  text = text.replace(/\bA1\s*Mini\b/gi, '')

  // Termos genéricos de metadado
  text = text.replace(/[-_\s]+stls\b/gi, '')
  text = text.replace(/\bmultiparts3mf\b/gi, '')
  text = text.replace(/\b3mf\d*\b/gi, '')           // 3mf, 3mf20260619, etc
  text = text.replace(/\bFan\s*Art\b/gi, '')
  text = text.replace(/\bFinal\b/gi, '')
  text = text.replace(/\bPLA\s*[en]\s*PA\b/gi, '')
  text = text.replace(/\bPLA\b/gi, '')

  // Hashes de upload com data (ex: 20260619 1 7xaf44 ou 3mf20260619 1 7xaf44)
  text = text.replace(/\b\d{8}\s+\d+\s+[a-z0-9]{4,}\b/gi, '')
  // Fragmentos órfãos tipo hash: número + string com dígitos misturados (ex: "1 7xaf44", "16099 N6968m")
  // Lookahead garante que a string seguinte contenha ao menos 1 dígito (diferencia de palavra real)
  text = text.replace(/\b\d{1,6}\s+(?=[a-z]*\d[a-z0-9]*\b)[a-z0-9]{3,10}\b/gi, '')
  // Data de 8 dígitos — isolada ou colada em palavra (ex: Komba20260616 → Komba)
  text = text.replace(/20\d{6}/g, '')

  // Links de canal
  text = text.replace(/^T\.me\s*/i, '')
  text = text.replace(/\bT\.me\b/gi, '')

  // Versão decimal colada em nome (ex: Bowser1.3 → Bowser). Só remove se houver ponto (X.Y).
  text = text.replace(/\b([A-Za-z]{3,})\d+\.\d+\b/g, '$1')

  // ── 4. CamelCase ─────────────────────────────────────────────────────────
  text = text.replace(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g, (word) =>
    word.replace(/([a-z])([A-Z])/g, '$1 $2')
  )

  // Remover parênteses de sufixo já existentes (qualquer capitalização) — serão
  // recalculados e reinseridos de forma padronizada no passo 7.
  text = text.replace(/\(\s*chaveiro\s*\)/gi, '')
  text = text.replace(/\(\s*articulado\s*\)/gi, '')
  text = text.replace(/\(\s*chaveiro\s*-\s*articulado\s*\)/gi, '')
  text = text.replace(/\(\s*articulado\s*-\s*chaveiro\s*\)/gi, '')
  text = text.replace(/\(\s*multipartes(\s*-\s*no-?ams)?\s*\)/gi, '')
  text = text.replace(/\(\s*no-?ams\s*\)/gi, '')

  // ── 5. Normalizar separadores e espaços ──────────────────────────────────
  text = text.replace(/\+/g, ' ')
  text = text.replace(/_/g, ' ')
  text = text.replace(/\s*\(\d+\)\s*$/, '')
  text = text.replace(/\.(3mf|stl)\b/gi, '')
  text = text.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '')
  // Remover pontuação solta (ponto, vírgula, dois-pontos no início/fim ou sozinhos)
  text = text.replace(/(?<!\w)[.,;:]+(?!\w)/g, '')
  text = text.replace(/\s{2,}/g, ' ')
  text = text.replace(/\s*[-–—]\s*/g, ' - ')
  text = text.replace(/(\s+-\s+)+/g, ' - ')
  text = text.replace(/^[\s\-–—.,]+|[\s\-–—.,]+$/g, '').trim()

  // ── 6. Title Case suave ───────────────────────────────────────────────────
  const LOWERCASE_WORDS = new Set([
    'de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'os', 'as',
    'the', 'of', 'and', 'in', 'for', 'no', 'na',
  ])
  text = text
    .split(' ')
    .map((word, i) => {
      if (!word) return word
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word
      const lower = word.toLowerCase()
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
    .trim()

  // ── 7. Adicionar sufixos padronizados ────────────────────────────────────
  const suffixes: string[] = []

  // Multipartes / NO-AMS
  if (hasMultipartes || hasNoAms) {
    const parts = [
      hasMultipartes ? 'Multipartes' : null,
      hasNoAms ? 'NO-AMS' : null,
    ].filter(Boolean).join(' - ')
    suffixes.push(`(${parts})`)
  }

  // Chaveiro / Articulado — unificados em um único parêntese (padrão Multipartes - NO-AMS)
  const isArticulado = /articul|flexi|flexibl|spring|print.in.place|moving|poseable/i.test(raw)
  const isChaveiro = /chaveiro|keychain|key.chain|key.ring|portacha/i.test(raw)
  if (isChaveiro || isArticulado) {
    const parts = [
      isChaveiro ? 'Chaveiro' : null,
      isArticulado ? 'Articulado' : null,
    ].filter(Boolean).join(' - ')
    suffixes.push(`(${parts})`)
  }

  if (suffixes.length > 0) {
    text = `${text} - ${suffixes.join(' ')}`
  }

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

  const isMeaningless = (t: string) =>
    !t.trim() || /^[\d\s\-_.#()/\\]+$/.test(t.trim()) || t.trim().length < 2

  const changes: { id: string; before: string; after: string }[] = []
  const tbdList: { id: string; title: string; after: string }[] = []
  for (const stl of allStls) {
    let after = cleanTitle(stl.title ?? '')
    if (isMeaningless(after)) {
      after = 'TBD'
    }
    if (after === stl.title) continue
    if (after === 'TBD') {
      tbdList.push({ id: stl.id, title: stl.title, after })
    }
    changes.push({ id: stl.id, before: stl.title, after })
  }

  console.log(`📝 ${changes.length} títulos com alteração`)
  if (tbdList.length > 0) {
    console.log(`🔖 ${tbdList.length} virarão "TBD" (título ficaria vazio ou sem sentido):`)
    tbdList.forEach(({ title }) => console.log(`   → "${title}"`))
  }
  console.log()

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
