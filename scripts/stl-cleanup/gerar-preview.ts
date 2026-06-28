/**
 * scripts/stl-cleanup/gerar-preview.ts
 *
 * Gera stl-names-preview.xlsx com sugestão de limpeza de SOMENTE o campo title
 * para todos os STLs ativos do banco. file_name não é alterado — é a chave de download.
 *
 * Regras:
 *   - Remove @canais do Telegram
 *   - Remove hashes aleatórios de upload
 *   - Remove prefixos de criadores (STLflix, 3DXM, Whale3D, etc.)
 *   - Remove sufixo _stls e extensões embutidas
 *   - Substitui + e _ por espaço
 *   - MANTÉM "NO AMS", "Multiparts", "Multi Parts" no título (engajamento do usuário)
 *   - Collapsa espaços e aplica Title Case suave
 *
 * Uso:
 *   npx tsx scripts/stl-cleanup/gerar-preview.ts
 *
 * Saída: scripts/stl-cleanup/stl-names-preview.xlsx
 */

import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ---------------------------------------------------------------------------
// Prefixos/sufixos de criadores a remover do título
// ---------------------------------------------------------------------------
const CREATOR_PREFIXES = [
  /^Whale3D[-–\s]*Studio\s*/i,
  /^Whale3D[-–\s]*/i,
  /^STLflix\s*[-–]\s*/i,
  /^3DXM\s*[-–]\s*/i,
  /^YoshStudios\s*/i,
  /^DecorMaster\s*/i,
  /^GeekSculpt3D\s*[-–]?\s*/i,
  /^Hex3D\s*[-–]?\s*/i,
  /^O3dlab\s*[-–]?\s*/i,
  /^@?o3dlab\s*[-–]?\s*/i,
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

// ---------------------------------------------------------------------------
// Limpeza do título
// ---------------------------------------------------------------------------
function cleanTitle(raw: string): string {
  let text = raw

  // ── 0. Tradução CJK ───────────────────────────────────────────────────────
  if (/[一-鿿぀-ヿ가-힯]/.test(text)) {
    if (CJK_TRANSLATIONS[text.trim()]) return CJK_TRANSLATIONS[text.trim()]
    text = text.replace(/[一-鿿぀-ヿ가-힯]+/g, ' ')
  }

  // ── 1. Extrair flags antes de limpar ──────────────────────────────────────
  const hasMultipartes = /multi[\s_-]?p(art(e?s?|i[eè]ces?)|artes?)|multipieces?/i.test(text)
  const hasNoAms = /no[\s_-]?ams|sem[\s_-]?ams|noams/i.test(text)

  // ── 2. Remover variantes de Multipartes e NO-AMS do texto ─────────────────
  text = text.replace(/[-_\s]*multi[\s_-]?p(art(e?s?|i[eè]ces?)|artes?)[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*multipieces?[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*MULTI[\s_-]PART[-_\s]*/g, ' ')
  text = text.replace(/[-_\s]*no[\s_-]?ams[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*sem[\s_-]?ams[-_\s]*/gi, ' ')
  text = text.replace(/[-_\s]*noams[-_\s]*/gi, ' ')

  // ── 3. Remoções gerais ────────────────────────────────────────────────────
  text = text.replace(/_?@[\w]+/g, '')
  text = text.replace(/_\d{8}_\d+_[a-z0-9]{4,}/gi, '')
  // Hashes hexadecimais 8+ chars (ex: 34c17d6abc, beacb6daa9bc7baf5648)
  text = text.replace(/(?=.*[a-f])[a-f0-9]{8,}/gi, '')

  for (const re of CREATOR_PREFIXES) text = text.replace(re, '')
  for (const re of CREATOR_SUFFIXES) text = text.replace(re, ' ')

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

  text = text.replace(/[-_\s]+stls\b/gi, '')
  text = text.replace(/\bmultiparts3mf\b/gi, '')
  text = text.replace(/\b3mf\d*\b/gi, '')
  text = text.replace(/\bFan\s*Art\b/gi, '')
  text = text.replace(/\bFinal\b/gi, '')
  text = text.replace(/\bPLA\s*[en]\s*PA\b/gi, '')
  text = text.replace(/\bPLA\b/gi, '')

  text = text.replace(/^T\.me\s*/i, '')
  text = text.replace(/\bT\.me\b/gi, '')

  // Versão decimal colada em nome (ex: Bowser1.3 → Bowser)
  text = text.replace(/\b([A-Za-z]{3,})\d+\.\d+\b/g, '$1')

  // Hashes de upload com data e fragmentos órfãos
  text = text.replace(/\b\d{8}\s+\d+\s+[a-z0-9]{4,}\b/gi, '')
  text = text.replace(/\b\d{1,6}\s+(?=[a-z]*\d[a-z0-9]*\b)[a-z0-9]{3,10}\b/gi, '')
  text = text.replace(/20\d{6}/g, '')

  // ── 4. CamelCase ─────────────────────────────────────────────────────────
  text = text.replace(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g, (word) =>
    word.replace(/([a-z])([A-Z])/g, '$1 $2')
  )

  // ── 5. Normalizar separadores e espaços ──────────────────────────────────
  text = text.replace(/\+/g, ' ')
  text = text.replace(/_/g, ' ')
  text = text.replace(/\s*\(\d+\)\s*$/, '')
  text = text.replace(/\.(3mf|stl)\b/gi, '')
  text = text.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '')
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

  // ── 7. Sufixo padronizado ─────────────────────────────────────────────────
  if (hasMultipartes || hasNoAms) {
    const parts = [
      hasMultipartes ? 'Multipartes' : null,
      hasNoAms ? 'NO-AMS' : null,
    ].filter(Boolean).join(' - ')
    text = `${text} - (${parts})`
  }

  return text
}

// ---------------------------------------------------------------------------
// Detecção de idioma por heurística simples
// ---------------------------------------------------------------------------
function detectLanguage(text: string): string {
  if (/[Ѐ-ӿ]/.test(text)) return 'ru'
  const lower = text.toLowerCase()
  if (/\b(notices|constructions|camion|monstre|le |la |les |du |des )\b/.test(lower)) return 'fr'
  if (/\b(segurando|saltitante|completo|separado|guardião|estátua|chaveiro|nozes|quebra)\b/.test(lower)) return 'pt'
  return 'en'
}

const MANUAL_TRANSLATIONS: Record<string, string> = {
  'Лего Harry Potter Косой Переулок': 'Lego Harry Potter Beco Diagonal',
  'Lego Camion Monstre': 'Lego Caminhão Monstro',
  'Lego Le Tumbler Notices de Constructions': 'Lego O Tumbler - Instruções de Montagem',
  'Lego Silver Champion Notices de Constructions': 'Lego Campeão Prateado - Instruções de Montagem',
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🔍 Buscando STLs ativos...')

  const PAGE = 1000
  let allStls: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title, file_name, tags')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .order('title')
      .range(from, from + PAGE - 1)
    if (error) throw error
    allStls = allStls.concat(data ?? [])
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  console.log(`✅ ${allStls.length} STLs carregados`)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Preview Limpeza')

  sheet.columns = [
    { header: 'id', key: 'id', width: 38 },
    { header: 'title_antes', key: 'title_antes', width: 55 },
    { header: 'title_depois', key: 'title_depois', width: 55 },
    { header: 'file_name (não muda)', key: 'file_name', width: 50 },
    { header: 'idioma_detectado', key: 'idioma_detectado', width: 16 },
    { header: 'traducao_sugerida', key: 'traducao_sugerida', width: 50 },
    { header: 'houve_mudanca', key: 'houve_mudanca', width: 14 },
    { header: 'aprovar', key: 'aprovar', width: 12 },
    { header: 'observacao', key: 'observacao', width: 35 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 20

  let changed = 0
  let unchanged = 0

  for (const stl of allStls) {
    const titleDepois = cleanTitle(stl.title ?? '')
    const idioma = detectLanguage(titleDepois)
    const traducao = MANUAL_TRANSLATIONS[titleDepois] ?? (idioma !== 'pt' && idioma !== 'en' ? '← preencher' : '')
    const houveMudanca = titleDepois !== stl.title

    if (houveMudanca) changed++
    else unchanged++

    const row = sheet.addRow({
      id: stl.id,
      title_antes: stl.title,
      title_depois: titleDepois,
      file_name: stl.file_name,
      idioma_detectado: idioma,
      traducao_sugerida: traducao,
      houve_mudanca: houveMudanca ? 'sim' : 'não',
      aprovar: '',
      observacao: '',
    })

    if (houveMudanca) {
      row.getCell('title_depois').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } }
    }

    if (idioma !== 'pt' && idioma !== 'en') {
      row.getCell('idioma_detectado').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } }
      row.getCell('traducao_sugerida').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } }
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Aba de instruções
  const instrSheet = workbook.addWorksheet('Instruções')
  instrSheet.getColumn(1).width = 90
  ;[
    ['=== Como usar este arquivo ==='],
    [''],
    ['IMPORTANTE: file_name NÃO será alterado — ele é a chave do download no R2.'],
    ['Somente o campo "title" (nome exibido na plataforma) será atualizado.'],
    [''],
    ['1. Filtre "houve_mudanca" = "sim" para ver só as linhas alteradas'],
    ['2. Compare title_antes com title_depois'],
    ['3. Coloque "sim" na coluna "aprovar" para aplicar a mudança'],
    ['4. Linhas sem "sim" em aprovar são ignoradas'],
    ['5. Use "observacao" para escrever um título personalizado se não gostar da sugestão'],
    ['6. Linhas rosa = idioma detectado como RU/FR — preencha traducao_sugerida'],
    ['7. NO AMS e Multiparts foram mantidos no título intencionalmente'],
    [''],
    ['Após preencher, rode:'],
    ['  npx tsx scripts/stl-cleanup/aplicar-aprovados.ts'],
  ].forEach(([text]) => {
    const row = instrSheet.addRow([text])
    if (text?.startsWith('===')) row.font = { bold: true, size: 13 }
    if (text?.startsWith('IMPORTANTE')) row.font = { bold: true, color: { argb: 'FFDC2626' } }
  })

  const outPath = path.join(process.cwd(), 'scripts/stl-cleanup/stl-names-preview.xlsx')
  await workbook.xlsx.writeFile(outPath)

  console.log(`\n📊 Resumo:`)
  console.log(`   Total de STLs:  ${allStls.length}`)
  console.log(`   Com mudança:    ${changed}`)
  console.log(`   Sem mudança:    ${unchanged}`)
  console.log(`\n✅ Arquivo gerado: ${outPath}`)
}

main().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
