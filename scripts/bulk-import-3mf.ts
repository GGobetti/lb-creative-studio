/**
 * scripts/bulk-import-3mf.ts
 * Importação em massa de modelos 3MF do N3D Premium Pack
 *
 * Fluxo:
 * 1. Lê pastas em /Desktop/N3D - PACK PREMIUN/
 * 2. Coleta fotos (01 Images/) e arquivos .3mf (02 Files/)
 * 3. Sobe fotos → Supabase Storage (portfolio/local-upload/pokemon/...)
 * 4. Sobe .3mf → R2 (stl/pokemon/...)
 * 5. Cria registros no banco (1 PAI + N filhos se múltiplos .3mf)
 *
 * Uso: npx ts-node scripts/bulk-import-3mf.ts [--dry-run]
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

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

const PACK_PATH = path.join(process.env.HOME || '/Users/ggobetti', 'Desktop/N3D - PACK PREMIUN')
const DRY_RUN = process.argv.includes('--dry-run')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const r2AccountId = process.env.R2_ACCOUNT_ID
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const r2Bucket = process.env.R2_BUCKET

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE env vars')
}

if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket) {
  throw new Error('Missing R2 env vars')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// R2 client setup
let r2Client: S3Client | undefined
function getR2Client(): S3Client {
  if (r2Client) return r2Client
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId!,
      secretAccessKey: r2SecretAccessKey!,
    },
  })
  return r2Client
}

interface ModelInfo {
  folderName: string
  dexNumber: string
  pokemonName: string
  photos: string[]
  files3mf: string[]
}

interface ImportResult {
  parentId: string
  pokemonName: string
  dexNumber: string
  photosUploaded: number
  filesUploaded: number
  childCount: number
}

// Parse folder name: "#0064 Kadabra" or "0448 Lucario"
function parseModelFolder(folderName: string): { dex: string; name: string } | null {
  const match = folderName.match(/^#?(\d+)\s*[-\s]+(.+)$/)
  if (!match) return null
  return {
    dex: match[1].padStart(4, '0'),
    name: match[2].trim(),
  }
}

// Sanitize filename for storage
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Find all folders with Images + Files
function discoverModels(): ModelInfo[] {
  const items = fs.readdirSync(PACK_PATH)
  const models: ModelInfo[] = []

  for (const item of items) {
    const fullPath = path.join(PACK_PATH, item)
    if (!fs.statSync(fullPath).isDirectory()) continue

    const parsed = parseModelFolder(item)
    if (!parsed) continue

    // Check for Images folder
    const imagesDir = fs
      .readdirSync(fullPath)
      .find((d) => /^01/.test(d))
    if (!imagesDir) continue

    const imagesFull = path.join(fullPath, imagesDir)
    const photos = fs
      .readdirSync(imagesFull)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .sort()

    // Find all .3mf files recursively in Files folder
    const filesFolders = fs
      .readdirSync(fullPath)
      .filter((d) => /^02/.test(d))

    const files3mf: string[] = []
    for (const filesFolder of filesFolders) {
      const filesFull = path.join(fullPath, filesFolder)
      function find3mf(dir: string) {
        for (const entry of fs.readdirSync(dir)) {
          const entryPath = path.join(dir, entry)
          const stat = fs.statSync(entryPath)
          if (stat.isDirectory()) {
            find3mf(entryPath)
          } else if (entry.endsWith('.3mf')) {
            files3mf.push(entryPath)
          }
        }
      }
      find3mf(filesFull)
    }

    if (files3mf.length > 0) {
      models.push({
        folderName: item,
        dexNumber: parsed.dex,
        pokemonName: parsed.name,
        photos: photos.map((p) => path.join(imagesFull, p)),
        files3mf: files3mf.sort(),
      })
    }
  }

  return models.sort((a, b) => parseInt(a.dexNumber) - parseInt(b.dexNumber))
}

async function uploadPhotosToSupabase(
  photos: string[],
  dex: string,
  name: string
): Promise<string[]> {
  const sanitized = sanitizeName(name)
  const uploadedUrls: string[] = []

  for (let i = 0; i < photos.length; i++) {
    const photoPath = photos[i]
    const photoName = path.basename(photoPath)
    const storagePath = `portfolio/local-upload/pokemon/${dex}-${sanitized}/${i + 1}-${photoName}`

    if (DRY_RUN) {
      console.log(`  [DRY] Upload photo: ${storagePath}`)
      uploadedUrls.push(`https://placeholder/${storagePath}`)
      continue
    }

    const fileBuffer = fs.readFileSync(photoPath)
    const { data, error } = await supabase.storage
      .from('portfolio')
      .upload(storagePath, fileBuffer, { upsert: true })

    if (error) {
      console.error(`  ✗ Failed to upload photo ${photoName}:`, error.message)
      continue
    }

    const { data: publicUrl } = supabase.storage
      .from('portfolio')
      .getPublicUrl(storagePath)

    uploadedUrls.push(publicUrl.publicUrl)
    console.log(`  ✓ Photo uploaded: ${photoName}`)
  }

  return uploadedUrls
}

async function upload3mfToR2(
  filePath: string,
  dex: string,
  name: string
): Promise<string> {
  const fileName = path.basename(filePath)
  const sanitized = sanitizeName(name)

  // Extract variant info from filename (e.g., "AMS Profile", "SPLIT Profile", "LED")
  let variant = 'default'
  if (fileName.includes('AMS')) variant = 'ams'
  if (fileName.includes('SPLIT')) variant = 'split'
  if (fileName.includes('LED') || fileName.includes('Mod')) variant = 'led'

  const objectKey = `stl/pokemon/${dex}-${sanitized}-${variant}.3mf`

  if (DRY_RUN) {
    console.log(`  [DRY] Upload .3mf: ${objectKey}`)
    return objectKey
  }

  try {
    const fileBuffer = fs.readFileSync(filePath)
    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: objectKey,
      Body: fileBuffer,
    })
    await getR2Client().send(command)
    console.log(`  ✓ .3mf uploaded: ${fileName}`)
    return objectKey
  } catch (error) {
    console.error(`  ✗ Failed to upload .3mf ${fileName}:`, error)
    throw error
  }
}

async function createModelInDatabase(
  dex: string,
  name: string,
  photoUrls: string[],
  r2Keys: string[]
): Promise<string> {
  const parentData = {
    title: name,
    description: `Pokémon #${dex} - 3D Model`,
    thumbnail_url: photoUrls[0] || null,
    photos: photoUrls,
    telegram_group_id: '-1004497395268',
    telegram_group_name: 'LB Creative Studio CENTRAL',
    telegram_message_id: 0,
    file_name: `${dex}-${sanitizeName(name)}.3mf`,
    file_size_bytes: 0,
    tags: ['pokemon', sanitizeName(name).toLowerCase(), `#${dex}`],
    r2_object_key: r2Keys.length === 1 ? r2Keys[0] : null,
  }

  if (DRY_RUN) {
    console.log(`  [DRY] Create parent: ${name} (${r2Keys.length} variants)`)
    return 'dry-run-parent-id'
  }

  const { data: parent, error: parentError } = await supabase
    .from('telegram_indexed_stls')
    .insert([parentData])
    .select('id')
    .single()

  if (parentError) {
    throw new Error(`Failed to create parent record: ${parentError.message}`)
  }

  console.log(`  ✓ Parent created: ${parent.id}`)

  // If multiple .3mf files, create child records
  if (r2Keys.length > 1) {
    const children = r2Keys.map((key, idx) => ({
      title: `${name} - Variant ${idx + 1}`,
      description: `Variant ${idx + 1} of Pokémon #${dex}`,
      telegram_group_id: '-1004497395268',
      telegram_group_name: 'LB Creative Studio CENTRAL',
      telegram_message_id: 0,
      file_name: path.basename(key),
      file_size_bytes: 0,
      tags: ['pokemon', sanitizeName(name).toLowerCase(), `#${dex}`, `variant-${idx + 1}`],
      parent_id: parent.id,
      r2_object_key: key,
      photos: [],
    }))

    const { error: childError } = await supabase
      .from('telegram_indexed_stls')
      .insert(children)

    if (childError) {
      throw new Error(`Failed to create child records: ${childError.message}`)
    }

    console.log(`  ✓ Created ${children.length} child records`)
  }

  return parent.id
}

async function importModel(model: ModelInfo): Promise<ImportResult> {
  console.log(`\n📦 Importing: ${model.pokemonName} (#${model.dexNumber})`)
  console.log(`   Photos: ${model.photos.length} | .3mf files: ${model.files3mf.length}`)

  try {
    // Upload photos
    const photoUrls = await uploadPhotosToSupabase(model.photos, model.dexNumber, model.pokemonName)

    // Upload .3mf files
    const r2Keys = await Promise.all(
      model.files3mf.map((file) => upload3mfToR2(file, model.dexNumber, model.pokemonName))
    )

    // Create records in database
    const parentId = await createModelInDatabase(
      model.dexNumber,
      model.pokemonName,
      photoUrls,
      r2Keys
    )

    return {
      parentId,
      pokemonName: model.pokemonName,
      dexNumber: model.dexNumber,
      photosUploaded: photoUrls.length,
      filesUploaded: r2Keys.length,
      childCount: r2Keys.length > 1 ? r2Keys.length : 0,
    }
  } catch (error) {
    console.error(`  ✗ Import failed:`, error)
    throw error
  }
}

async function main() {
  console.log('🔍 Discovering models...\n')
  const models = discoverModels()

  console.log(`Found ${models.length} models:`)
  models.forEach((m) => {
    console.log(
      `  #${m.dexNumber} ${m.pokemonName} - ${m.photos.length} photos, ${m.files3mf.length} .3mf files`
    )
  })

  if (DRY_RUN) {
    console.log('\n🔒 DRY RUN MODE - no changes will be made\n')
  } else {
    console.log('\n⚠️  LIVE MODE - changes will be committed\n')
  }

  const results: ImportResult[] = []
  for (const model of models) {
    try {
      const result = await importModel(model)
      results.push(result)
    } catch (error) {
      console.error(`Failed to import ${model.pokemonName}: ${error}`)
      if (!DRY_RUN) break // Stop on error in live mode
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary')
  console.log('='.repeat(60))
  results.forEach((r) => {
    console.log(
      `✓ #${r.dexNumber} ${r.pokemonName}: ${r.photosUploaded} photos, ${r.filesUploaded} files${
        r.childCount > 0 ? `, ${r.childCount} variants` : ''
      }`
    )
  })
  console.log(`\nTotal: ${results.length}/${models.length} models imported successfully`)

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to commit changes')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
