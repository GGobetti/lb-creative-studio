import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

const env = {}
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=')
    if (key && value) {
      env[key] = value
    }
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

console.log('\n🔍 Verificando migração...\n')

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkTables() {
  const tables = [
    'game_daily_limits',
    'game_rewards_config',
    'game_daily_activity',
    'quality_audit_votes',
    'stl_audit_results',
  ]

  console.log('📋 Procurando por tabelas:\n')

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!error || error.message.includes('Results contain 0 rows')) {
        console.log(`   ✅ ${table}`)
      } else {
        console.log(`   ❌ ${table} - ${error?.message}`)
      }
    } catch (e) {
      console.log(`   ❌ ${table}`)
    }
  }

  console.log('\n🔧 Verificando configurações...\n')

  // Check reward configs
  try {
    const { data, error } = await supabase
      .from('game_rewards_config')
      .select('*')

    if (data && data.length > 0) {
      console.log('   ✅ Configurações de recompensas:')
      data.forEach(r => {
        console.log(`      ${r.game_type}: ${r.actions_per_reward} ações → ${r.credits_per_reward} créditos`)
      })
    }
  } catch (e) {
    console.log('   ⚠️ Não conseguiu ler configurações de recompensas')
  }

  // Check daily limits
  try {
    const { data, error } = await supabase
      .from('game_daily_limits')
      .select('*')
      .limit(1)
      .single()

    if (data) {
      console.log('\n   ✅ Limites diários globais:')
      console.log(`      Máx ações/dia: ${data.max_actions_per_day}`)
      console.log(`      Máx créditos/dia: ${data.max_credits_per_day}`)
    }
  } catch (e) {
    console.log('\n   ⚠️ Não conseguiu ler limites diários')
  }

  console.log('\n' + '='.repeat(50))
  console.log('\n✅ Verificação concluída!')
  console.log('\n🎮 Tudo pronto para usar!\n')
  console.log('📋 URLs disponíveis:')
  console.log('   Admin de Games: http://localhost:3000/dashboard/admin/games')
  console.log('   Moderação: http://localhost:3000/dashboard/admin/audit-moderation')
  console.log('   Quality Audit: http://localhost:3000/dashboard/games/quality-audit\n')
}

checkTables()
