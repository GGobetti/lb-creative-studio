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
]

const CREATOR_SUFFIXES = [
  /\s*\(Aslan3D\)\s*/gi,
  /[-_\s]+rtprops\b/gi,
  /[-_\s]+DecorMaster\b/gi,
]

// ---------------------------------------------------------------------------
// Limpeza do título (não mexe em NO AMS nem Multiparts — ficam no nome)
// ---------------------------------------------------------------------------
function cleanTitle(raw: string): string {
  let text = raw

  // 1. Remover @canal (com ou sem _ antes)
  text = text.replace(/_?@[\w]+/g, '')

  // 2. Remover hashes de upload: _YYYYMMDD_N_XXXXXX
  text = text.replace(/_\d{8}_\d+_[a-z0-9]{4,}/gi, '')

  // 3. Remover hashes hexadecimais longos (≥14 chars contíguos)
  text = text.replace(/[a-f0-9]{14,}/gi, '')

  // 4. Remover prefixos de criadores
  for (const re of CREATOR_PREFIXES) {
    text = text.replace(re, '')
  }

  // 5. Remover sufixos de criadores
  for (const re of CREATOR_SUFFIXES) {
    text = text.replace(re, ' ')
  }

  // 6. Remover sufixo _stls ou " stls" (redundante)
  text = text.replace(/[-_\s]+stls\b/gi, '')

  // 7. Remover "multiparts3mf" embutido sem espaço (ex: no_ams_multiparts3mf_Silent)
  //    Mantém "Multiparts" ou "Multi Parts" com espaço — esses ficam
  text = text.replace(/multiparts3mf/gi, 'Multiparts')

  // 8. Substituir + por espaço
  text = text.replace(/\+/g, ' ')

  // 9. Substituir _ por espaço
  text = text.replace(/_/g, ' ')

  // 10. Remover numeração (1), (2)... no final
  text = text.replace(/\s*\(\d+\)\s*$/, '')

  // 11. Remover extensões embutidas no meio do nome (não extensão final real)
  text = text.replace(/\.(3mf|stl)\b/gi, '')

  // 12. Colapsar múltiplos espaços e normalizar hífens
  text = text.replace(/\s{2,}/g, ' ')
  text = text.replace(/\s*[-–—]\s*/g, ' - ')
  text = text.replace(/(\s+-\s+)+/g, ' - ')

  // 13. Title Case suave
  const LOWERCASE_WORDS = new Set([
    'de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'os', 'as',
    'the', 'of', 'and', 'in', 'for', 'no', 'na',
  ])
  // Preservar siglas/acrônimos em maiúsculo (AMS, SRT, PS4, etc.)
  text = text
    .trim()
    .split(' ')
    .map((word, i) => {
      if (!word) return word
      // Siglas: 2-4 letras maiúsculas (ex: AMS, FDM, SRT, PS4, XBOX)
      if (/^[A-Z0-9]{2,5}$/.test(word)) return word
      const lower = word.toLowerCase()
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')

  // 14. Limpar traços/espaços isolados no início/fim
  text = text.replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()

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
