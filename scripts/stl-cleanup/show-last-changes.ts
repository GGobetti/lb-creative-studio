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
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  })
}
loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Função de limpeza anterior (antes da mudança no threshold)
function cleanTitleOld(raw: string): string {
  let text = raw
  text = text.replace(/[a-f0-9]{14,}/gi, '')
  return text.trim()
}

async function main() {
  const PAGE = 1000
  let all: any[] = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .range(from, from + PAGE - 1)
    all = all.concat(data ?? [])
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }

  // Mostra STLs que PERDERAM hash 8-13 chars ao aplicar a mudança
  const altered: [string, string][] = []
  for (const stl of all) {
    const oldClean = cleanTitleOld(stl.title ?? '')
    const wouldHaveChanged = oldClean !== (stl.title ?? '')
    if (!wouldHaveChanged) {
      // Verifiquamos se tem hash 8-13 chars
      const hasHash8to13 = /(?=.*[a-f])[a-f0-9]{8,13}/.test(stl.title ?? '')
      if (hasHash8to13) {
        const newClean = stl.title.replace(/(?=.*[a-f])[a-f0-9]{8,}/gi, '').trim()
        altered.push([stl.title, newClean])
      }
    }
  }

  console.log(`\n📋 STLs alterados pela mudança de threshold (14 → 8 chars):\n`)
  altered.forEach(([before, after], i) => {
    console.log(`${i + 1}. ${before.padEnd(60)} → ${after}`)
  })
  console.log(`\nTotal: ${altered.length} alterações`)
}
main()
