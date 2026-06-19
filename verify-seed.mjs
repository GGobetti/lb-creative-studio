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
  auth: { autoRefreshToken: false, persistSession: false }
})

async function verifySeed() {
  // Check rewards
  const { data: rewards } = await supabase.from('game_rewards_config').select('*')
  
  if (!rewards || rewards.length === 0) {
    console.log('Inserindo configurações de recompensas...')
    const { error } = await supabase.from('game_rewards_config').insert([
      { game_type: 'photo-match', actions_per_reward: 5, credits_per_reward: 10 },
      { game_type: 'tag-detective', actions_per_reward: 8, credits_per_reward: 5 },
      { game_type: 'category-sort', actions_per_reward: 3, credits_per_reward: 25 },
      { game_type: 'quality-audit', actions_per_reward: 10, credits_per_reward: 50 },
    ])
    
    if (error) console.error('Erro ao inserir recompensas:', error)
    else console.log('✅ Recompensas inseridas!')
  } else {
    console.log('✅ Recompensas já existem')
  }

  // Check limits
  const { data: limits } = await supabase.from('game_daily_limits').select('*').limit(1)
  
  if (!limits || limits.length === 0) {
    console.log('Inserindo limites diários...')
    const { error } = await supabase.from('game_daily_limits').insert({
      id: '00000000-0000-0000-0000-000000000000',
      max_actions_per_day: 100,
      max_credits_per_day: 500
    })
    
    if (error) console.error('Erro ao inserir limites:', error)
    else console.log('✅ Limites inseridos!')
  } else {
    console.log('✅ Limites já existem')
  }
}

verifySeed()
