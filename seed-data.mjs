import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')

const env = {}
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=')
    if (key && value) env[key] = value
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
})

async function seedData() {
  console.log('\n💾 Fazendo seed dos dados...\n')

  try {
    // Insert reward configs
    console.log('Inserindo configurações de recompensas...')
    const { error: rewardError, data: rewardData } = await supabase
      .from('game_rewards_config')
      .insert([
        { game_type: 'photo-match', actions_per_reward: 5, credits_per_reward: 10 },
        { game_type: 'tag-detective', actions_per_reward: 8, credits_per_reward: 5 },
        { game_type: 'category-sort', actions_per_reward: 3, credits_per_reward: 25 },
        { game_type: 'quality-audit', actions_per_reward: 10, credits_per_reward: 50 },
      ])
      .select()

    if (rewardError && !rewardError.message.includes('duplicate')) {
      console.log(`⚠️ Erro: ${rewardError.message}`)
    } else if (rewardData) {
      console.log(`✅ ${rewardData.length} configurações inseridas`)
    }

    // Insert daily limits
    console.log('\nInserindo limites diários globais...')
    const { error: limitError, data: limitData } = await supabase
      .from('game_daily_limits')
      .insert({
        id: '00000000-0000-0000-0000-000000000000',
        max_actions_per_day: 100,
        max_credits_per_day: 500
      })
      .select()

    if (limitError && !limitError.message.includes('duplicate')) {
      console.log(`⚠️ Erro: ${limitError.message}`)
    } else if (limitData) {
      console.log(`✅ Limites inseridos`)
    }

    console.log('\n' + '='.repeat(50))
    console.log('\n✅ Seed completo!\n')
    console.log('🎮 Tudo pronto para usar!\n')
    console.log('📋 URLs disponíveis:')
    console.log('   Dashboard: http://localhost:3000/dashboard')
    console.log('   Admin Games: http://localhost:3000/dashboard/admin/games')
    console.log('   Moderação: http://localhost:3000/dashboard/admin/audit-moderation')
    console.log('   Quality Audit: http://localhost:3000/dashboard/games/quality-audit\n')
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

seedData()
