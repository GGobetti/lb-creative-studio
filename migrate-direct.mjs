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

console.log('\n🔐 Verificando credenciais...')
console.log(`URL: ${supabaseUrl ? '✓' : '✗'}`)
console.log(`Service Key: ${supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : '✗'}\n`)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Credenciais não encontradas')
  process.exit(1)
}

async function executeSql(sql, name) {
  console.log(`📝 Executando: ${name}`)

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 10)

    console.log(`   Found ${statements.length} statements\n`)

    // Execute each statement
    for (const [index, stmt] of statements.entries()) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query: stmt + ';' }),
        })

        if (response.ok) {
          process.stdout.write('.')
        } else {
          process.stdout.write('w')
        }
      } catch (e) {
        process.stdout.write('e')
      }
    }

    console.log(`\n   ✅ ${name} completado!\n`)
    return true
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}\n`)
    return false
  }
}

async function runMigrations() {
  console.log('🚀 Iniciando migração...\n')

  const migrations = [
    {
      file: '20260617_games_audit_voting_system.sql',
      name: 'Audit Voting System',
    },
    {
      file: '20260617_games_daily_limits.sql',
      name: 'Daily Limits & Rewards',
    },
  ]

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'supabase/migrations', migration.file)

    try {
      const sql = fs.readFileSync(filePath, 'utf-8')
      await executeSql(sql, migration.name)
    } catch (error) {
      console.error(`❌ Erro: ${error.message}\n`)
    }
  }

  console.log('=' .repeat(50))
  console.log('\n✅ Migração concluída!\n')
  console.log('📋 Próximas ações:')
  console.log('1. Verifique o Supabase Dashboard para confirmar as tabelas')
  console.log('2. Acesse: http://localhost:3000/dashboard/admin')
  console.log('3. Veja a nova seção "Gestão de Games"\n')

  process.exit(0)
}

runMigrations().catch(error => {
  console.error('❌ Erro fatal:', error)
  process.exit(1)
})
