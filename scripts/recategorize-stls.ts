/**
 * scripts/recategorize-stls.ts
 *
 * Recategoriza STLs em massa baseado em regras de busca.
 * Pode adicionar categorias a STLs que contêm padrões específicos.
 *
 * Uso:
 *   npx tsx scripts/recategorize-stls.ts         # dry run
 *   npx tsx scripts/recategorize-stls.ts --apply # aplica mudanças
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

// ─────────────────────────────────────────────────────────────────────────────
// Regras de recategorização
// ─────────────────────────────────────────────────────────────────────────────
interface RecategorizationRule {
  name: string
  whereCondition: (title: string, fileName: string) => boolean
  categoriesToAdd: string[]
  categoriesToRemove?: string[]
}

const rules: RecategorizationRule[] = [
  // Religiosos
  {
    name: 'Religiosos',
    whereCondition: (title) =>
      /jesus|christ|maria|mary|cruz|cross|crucifix|angel|anjo|sagrado|holy|bible|biblia|saint|santo|church|igreja|pope|papa|altar|religiou|spiritual|deus|god|madonna|nativity|virgin mary|arcanjo|archangel michael/i.test(title),
    categoriesToAdd: ['Religiosos'],
  },
  // Articulados: flexi, articulated, etc
  {
    name: 'Articulados',
    whereCondition: (title) =>
      /articul|flexi|flexibl|spring|print.in.place|moving|poseable/i.test(title),
    categoriesToAdd: ['Articulados'],
    categoriesToRemove: ['NO-AMS'], // Articulados usam AMS, não NO-AMS
  },
  // Chaveiros
  {
    name: 'Chaveiros',
    whereCondition: (title) =>
      /chaveiro|keychain|key.chain|key.ring|portacha/i.test(title),
    categoriesToAdd: ['Chaveiros'],
  },
  // Multipiece/Multicolor → Multipartes/NO-AMS
  {
    name: 'Multipiece/Multicolor → Multipartes/NO-AMS',
    whereCondition: (title) =>
      /multi.piece|multipiece|multi.color|multicolor/i.test(title),
    categoriesToAdd: ['Multipartes/NO AMS'],
  },
  // Esportes: Mascotes e jogadores
  {
    name: 'Mascotes esportivos',
    whereCondition: (title) =>
      /mascote|canarinho|verde amarelo|brasil/i.test(title) &&
      /esporte|futebol|brasil/i.test(title),
    categoriesToAdd: ['Esportes'],
    categoriesToRemove: ['Utilidades'],
  },
  // Caixas de jogadores de futebol
  {
    name: 'Caixas de jogadores',
    whereCondition: (title) =>
      /caixa\s+(messi|neymar|cr7|ronaldo|pelé|ronaldinho)/i.test(title),
    categoriesToAdd: ['Esportes'],
    categoriesToRemove: ['Utilidades'],
  },
  // Remover "Outros" de itens que têm outras categorias
  {
    name: 'Limpar "Outros" redundante',
    whereCondition: () => false, // Será tratado especialmente no main()
    categoriesToAdd: [],
    categoriesToRemove: ['Outros'],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) console.log('🔍 DRY RUN — nenhuma alteração será feita (use --apply para aplicar)\n')
  else console.log('🚀 APLICANDO recategorização no banco...\n')

  const PAGE = 1000
  let allStls: any[] = []
  let from = 0

  // Carregar todos os STLs
  while (true) {
    const { data, error } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title, file_name, categories')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .eq('is_deleted', false)
      .eq('marked_for_removal', false)
      .eq('needs_validation', false)
      .range(from, from + PAGE - 1)
    if (error) throw error
    allStls = allStls.concat(data ?? [])
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  console.log(`✅ ${allStls.length} STLs carregados\n`)

  const changes: {
    id: string
    title: string
    before: string[]
    after: string[]
    rule: string
  }[] = []

  // Aplicar regras
  for (const stl of allStls) {
    for (const rule of rules) {
      if (rule.name === 'Limpar "Outros" redundante') {
        // Regra especial: remover "Outros" se tem outras categorias
        if (
          stl.categories &&
          stl.categories.includes('Outros') &&
          stl.categories.length > 1
        ) {
          const newCats = stl.categories.filter((c: string) => c !== 'Outros')
          if (newCats.join(',') !== stl.categories.join(',')) {
            changes.push({
              id: stl.id,
              title: stl.title,
              before: stl.categories,
              after: newCats,
              rule: rule.name,
            })
          }
        }
        continue
      }

      // Aplicar condição
      if (!rule.whereCondition(stl.title ?? '', stl.file_name ?? '')) {
        continue
      }

      // Montar novas categorias
      let newCats = [...(stl.categories ?? [])]

      // Remover categorias
      if (rule.categoriesToRemove) {
        newCats = newCats.filter((c: string) => !rule.categoriesToRemove!.includes(c))
      }

      // Adicionar categorias (sem duplicar)
      for (const cat of rule.categoriesToAdd) {
        if (!newCats.includes(cat)) {
          newCats.push(cat)
        }
      }

      // Ordenar
      newCats = [...new Set(newCats)].sort()

      // Registrar mudança
      if (newCats.join(',') !== stl.categories.join(',')) {
        changes.push({
          id: stl.id,
          title: stl.title,
          before: stl.categories ?? [],
          after: newCats,
          rule: rule.name,
        })
      }
    }
  }

  console.log(`📊 Total de mudanças: ${changes.length}\n`)

  // Agrupar por regra
  const byRule = new Map<string, typeof changes>()
  for (const change of changes) {
    if (!byRule.has(change.rule)) byRule.set(change.rule, [])
    byRule.get(change.rule)!.push(change)
  }

  for (const [rule, items] of byRule) {
    console.log(`📝 ${rule}: ${items.length} STL(s)`)
    items.slice(0, 3).forEach(({ title, before, after }) => {
      console.log(`   "${title}"`)
      console.log(`   ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
    })
    if (items.length > 3) console.log(`   ... e mais ${items.length - 3}`)
    console.log()
  }

  if (changes.length === 0) {
    console.log('✅ Nenhuma mudança necessária')
    return
  }

  if (DRY_RUN) {
    console.log(`\nRode com --apply para aplicar ${changes.length} mudanças.`)
    return
  }

  // Aplicar no banco
  console.log(`⏳ Aplicando ${changes.length} mudanças...\n`)

  let applied = 0
  let errors = 0

  for (const change of changes) {
    const { error } = await supabase
      .from('telegram_indexed_stls')
      .update({ categories: change.after })
      .eq('id', change.id)

    if (error) {
      console.error(`❌ Erro ao atualizar ${change.id}: ${error.message}`)
      errors++
    } else {
      applied++
    }
  }

  console.log(`✅ Concluído — ${applied}/${changes.length} aplicadas, ${errors} erro(s)`)
}

main().catch((err) => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
