/**
 * scripts/migrate-file-sizes.ts
 * Migração: preencher file_size_bytes dos STLs importados buscando de R2
 *
 * Uso: npx ts-node scripts/migrate-file-sizes.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

// Load .env.local manually
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=')
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    })
  }
}
loadEnv()

const DRY_RUN = process.argv.includes('--dry-run')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const r2AccountId = process.env.R2_ACCOUNT_ID
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const r2Bucket = process.env.R2_BUCKET

if (!supabaseUrl || !supabaseKey || !r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket) {
  throw new Error('Missing required env vars')
}

const supabase = createClient(supabaseUrl, supabaseKey)

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
})

async function getFileSizeFromR2(objectKey: string): Promise<number> {
  try {
    const command = new HeadObjectCommand({
      Bucket: r2Bucket,
      Key: objectKey,
    })
    const response = await r2Client.send(command)
    const size = response.ContentLength || 0
    if (size > 0) {
      console.log(`    R2 size: ${(size / 1024 / 1024).toFixed(2)} MB`)
    }
    return size
  } catch (error: any) {
    console.error(`    ✗ R2 error: ${error.name} - ${error.message}`)
    return 0
  }
}

async function main() {
  console.log('🔍 Iniciando migração de file_size_bytes...\n')

  if (DRY_RUN) {
    console.log('🔒 DRY RUN MODE - nenhuma alteração será feita\n')
  }

  // Buscar todos os STLs com r2_object_key
  const { data: stls, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, r2_object_key, file_size_bytes')
    .not('r2_object_key', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar STLs: ${error.message}`)
  }

  if (!stls || stls.length === 0) {
    console.log('✓ Nenhum STL com r2_object_key encontrado')
    return
  }

  console.log(`Encontrados ${stls.length} STLs com r2_object_key\n`)

  let updated = 0
  let alreadyOk = 0

  for (const stl of stls) {
    console.log(`📦 ${stl.title}`)
    const fileSize = await getFileSizeFromR2(stl.r2_object_key)

    if (fileSize === 0) {
      console.log(`  ⚠️  Arquivo não encontrado em R2 ou tamanho 0`)
      continue
    }

    // Se já tem o tamanho correto, pula
    if (stl.file_size_bytes === fileSize) {
      console.log(`  ✓ Já tem tamanho correto (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
      alreadyOk++
      continue
    }

    console.log(`  📊 Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)

    if (DRY_RUN) {
      console.log(`  [DRY] Atualizaria para ${fileSize} bytes`)
      updated++
    } else {
      const { error: updateError } = await supabase
        .from('telegram_indexed_stls')
        .update({ file_size_bytes: fileSize })
        .eq('id', stl.id)

      if (updateError) {
        console.error(`  ✗ Erro ao atualizar:`, updateError.message)
      } else {
        console.log(`  ✓ Atualizado`)
        updated++
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 Resultado da Migração')
  console.log(`${'='.repeat(60)}`)
  console.log(`✓ Já tinham tamanho: ${alreadyOk}`)
  console.log(`✓ Atualizados: ${updated}`)
  console.log(`\nTotal: ${updated + alreadyOk}/${stls.length}`)

  if (DRY_RUN) {
    console.log('\n💡 Execute sem --dry-run para confirmar as alterações')
  }
}

main().catch((error) => {
  console.error('Erro fatal:', error)
  process.exit(1)
})
