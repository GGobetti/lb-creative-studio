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

  // Busca todos que têm hash 8-13 chars (removidos pela mudança)
  const withHash = all.filter(s =>
    /(?=.*[a-f])[a-f0-9]{8,13}/.test(s.title ?? '')
  )

  console.log(`\n📋 ${withHash.length} STLs com hash 8-13 caracteres:\n`)
  withHash.forEach((s, i) => {
    const cleaned = (s.title ?? '')
      .replace(/(?=.*[a-f])[a-f0-9]{8,}/gi, '')
      .trim()
    console.log(`${String(i + 1).padStart(2)}. ${(s.title ?? '').padEnd(65)} → ${cleaned}`)
  })
}
main()
