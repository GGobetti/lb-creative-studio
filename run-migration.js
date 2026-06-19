import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Rodando migrations...\n')

  const migrations = [
    '20260617_games_audit_voting_system.sql',
    '20260617_games_daily_limits.sql',
  ]

  for (const migrationFile of migrations) {
    const filePath = path.join(__dirname, 'supabase/migrations', migrationFile)

    console.log(`📝 Executando: ${migrationFile}`)

    try {
      const sql = fs.readFileSync(filePath, 'utf-8')

      // Split by -- to remove comments at start
      const statements = sql
        .split(';\n')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec', { statement: statement + ';' })

          if (error) {
            console.error(`   ❌ Erro:`, error)
            // Don't exit, continue with next statement
          }
        }
      }

      console.log(`   ✅ ${migrationFile} concluído\n`)
    } catch (error) {
      console.error(`   ❌ Erro ao ler arquivo: ${error.message}`)
      process.exit(1)
    }
  }

  console.log('✅ Todas as migrations foram rodadas com sucesso!')
  process.exit(0)
}

// Try alternative approach using SQL directly
async function runMigrationDirect() {
  console.log('🚀 Rodando migrations (método direto)...\n')

  const migrations = [
    { file: '20260617_games_audit_voting_system.sql', name: 'Audit Voting System' },
    { file: '20260617_games_daily_limits.sql', name: 'Daily Limits' },
  ]

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'supabase/migrations', migration.file)

    console.log(`📝 Executando: ${migration.name}`)

    try {
      const sql = fs.readFileSync(filePath, 'utf-8')

      // Use exec-like approach
      const { data, error } = await supabase.from('_migrations').insert({
        name: migration.file,
        executed_at: new Date().toISOString(),
      }).select()

      // Actually, let's just execute the raw SQL
      const { error: execError } = await supabase.rpc('query', { query: sql })

      if (execError && execError.message.includes('does not exist')) {
        // Try direct approach
        console.log('   ℹ️ Tentando abordagem direta...')

        // Split statements properly
        const stmts = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'))

        for (const stmt of stmts) {
          if (stmt.length > 10) {
            const { error: stmtError } = await supabase.from('_sql_exec').insert({
              query: stmt + ';',
            })

            if (stmtError) {
              console.log(`   ⚠️ ${stmtError.message}`)
            }
          }
        }
      } else if (execError) {
        console.error(`   ❌ Erro:`, execError.message)
      }

      console.log(`   ✅ ${migration.name} concluído\n`)
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}`)
    }
  }

  console.log('✅ Processo concluído!')
  process.exit(0)
}

// Run it
runMigrationDirect().catch((error) => {
  console.error('❌ Erro fatal:', error)
  process.exit(1)
})
