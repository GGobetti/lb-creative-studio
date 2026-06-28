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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const PAGE = 1000
  let all: any[] = []
  let from = 0
  while (true) {
    const { data } = await supabase.from('telegram_indexed_stls').select('id, title').neq('id','00000000-0000-0000-0000-000000000000').range(from, from+PAGE-1)
    all = all.concat(data ?? [])
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  const cjk = all.filter(s => /[一-鿿぀-ヿ가-힯]/.test(s.title ?? ''))
  console.log('Total com CJK:', cjk.length)
  cjk.forEach(s => console.log(JSON.stringify(s.title)))
}
main().catch(console.error)
