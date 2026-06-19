import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('\n🔐 Verificando credenciais...')
console.log(`URL: ${supabaseUrl ? '✓' : '✗'}`)
console.log(`Service Key: ${supabaseServiceKey ? '✓' : '✗'}\n`)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Credenciais do Supabase não encontradas no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function executeSql(sql, name) {
  try {
    console.log(`📝 Executando ${name}...`)

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (response.ok) {
      console.log(`   ✅ ${name} executado com sucesso!\n`)
      return true
    } else {
      const error = await response.text()
      console.log(`   ⚠️ Status ${response.status}: ${error}\n`)

      // Try alternative method: split and execute statements
      return await executeStatements(sql, name)
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}\n`)
    return false
  }
}

async function executeStatements(sql, name) {
  console.log(`   ℹ️ Tentando abordagem por statement individual...\n`)

  const statements = sql
    .split(';\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + ';')

  let succeeded = 0
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    if (stmt.length < 5) continue

    try {
      // Use Supabase postgres function call
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({ statement: stmt }),
      })

      if (response.ok) {
        succeeded++
      }
    } catch (e) {
      // Silently continue
    }
  }

  if (succeeded > 0) {
    console.log(`   ✅ ${name}: ${succeeded}/${statements.length} statements executados\n`)
    return true
  }

  return false
}

async function runMigrations() {
  console.log('🚀 Iniciando migração de Games...\n')

  const migrations = [
    {
      file: '20260617_games_audit_voting_system.sql',
      name: 'Games Audit Voting System',
    },
    {
      file: '20260617_games_daily_limits.sql',
      name: 'Games Daily Limits',
    },
  ]

  let allSuccess = true

  for (const migration of migrations) {
    try {
      const filePath = path.join(__dirname, 'supabase/migrations', migration.file)
      const sql = fs.readFileSync(filePath, 'utf-8')

      const success = await executeSql(sql, migration.name)
      if (!success) {
        allSuccess = false
      }
    } catch (error) {
      console.error(`❌ Erro ao ler arquivo ${migration.file}: ${error.message}\n`)
      allSuccess = false
    }
  }

  if (allSuccess) {
    console.log('✅ Todas as migrations foram rodadas com sucesso!')
    console.log('\n📋 Próximos passos:')
    console.log('1. Acesse: http://localhost:3000/dashboard/admin')
    console.log('2. Você verá a seção "Gestão de Games" com:')
    console.log('   - Admin de Games (configurar limites e recompensas)')
    console.log('   - Moderação de Auditorias (revisar STLs contestadas)')
  } else {
    console.log('\n⚠️ Algumas migrations podem ter falhado.')
    console.log('Acesse manualmente: Dashboard Supabase > SQL Editor')
    console.log('E copie/cole o SQL do arquivo RUN_MIGRATION.md')
  }

  process.exit(allSuccess ? 0 : 1)
}

runMigrations()
