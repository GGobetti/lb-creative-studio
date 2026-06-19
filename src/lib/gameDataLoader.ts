import { getSupabaseBrowser } from './supabase'
import type { PhotoMatchQuestion, TagDetectiveQuestion, SortableStl, AuditQuestion } from '@/types/games'
import { STL_CATEGORIES } from '@/types/games'

interface TelegramIndexedStl {
  id: string
  title: string
  photos: string[]
  tags: string[]
  description: string | null
  file_name: string
}

// ─── Photo Match: Load real STLs ─────────────────────────────────────────────

export async function loadPhotoMatchQuestions(limit = 10): Promise<PhotoMatchQuestion[]> {
  const supabase = getSupabaseBrowser()

  // Load extra STLs so we can swap photos to create real mismatches
  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos, description')
    .limit(limit + 5)

  if (error || !data || data.length < 2) {
    console.error('Error loading STLs:', error)
    return []
  }

  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, limit)
  const questions: PhotoMatchQuestion[] = []

  for (let i = 0; i < shuffled.length; i++) {
    const stl = shuffled[i]
    const isMismatch = i % 3 === 0 // ~33% mismatches

    if (isMismatch) {
      // Use photo from a different STL to create a genuine mismatch
      const otherIdx = (i + Math.floor(shuffled.length / 2)) % shuffled.length
      const otherStl = shuffled[otherIdx]
      questions.push({
        id: stl.id,
        title: stl.title,
        description: stl.description || 'Modelo 3D para impressão',
        imageUrl: otherStl.photos?.[0] || '',
        isMatch: false,
      })
    } else {
      questions.push({
        id: stl.id,
        title: stl.title,
        description: stl.description || 'Modelo 3D para impressão',
        imageUrl: stl.photos?.[0] || '',
        isMatch: true,
      })
    }
  }

  return questions
}

// ─── Tag Detective: Load real STLs ──────────────────────────────────────────

export async function loadTagDetectiveQuestions(limit = 8): Promise<TagDetectiveQuestion[]> {
  const supabase = getSupabaseBrowser()

  // Load extra STLs so we can borrow tags from others as decoys
  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos, tags')
    .limit(limit + 10)

  if (error || !data || data.length < 2) {
    console.error('Error loading STLs:', error)
    return []
  }

  // Collect all tags from all STLs to use as cross-STL decoys
  const allTagPool: string[] = data.flatMap((stl: any) => stl.tags || [])

  const subjects = data.slice(0, limit)

  return subjects.map((stl: any) => {
    const realTags: string[] = (stl.tags || []).slice(0, 5)

    // Pick decoy tags from OTHER STLs' real tags (not random strings)
    const foreignTags = allTagPool
      .filter((t) => !realTags.includes(t))
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)

    const allTags = [...realTags, ...foreignTags].sort(() => Math.random() - 0.5)

    return {
      id: stl.id,
      title: stl.title,
      imageUrl: stl.photos?.[0] || '',
      tags: allTags.map((tag: string) => ({
        text: tag,
        isRelevant: realTags.includes(tag),
      })),
    }
  })
}

// ─── Category Sort: Load real STLs (1 per round, multi-category) ────────────

export async function loadCategorySortItems(limit = 10): Promise<SortableStl[]> {
  const supabase = getSupabaseBrowser()

  // Random offset so users see different STLs each session
  const { count: totalCount } = await supabase
    .from('telegram_indexed_stls')
    .select('id', { count: 'exact', head: true })

  const offset = totalCount && totalCount > limit
    ? Math.floor(Math.random() * (totalCount - limit))
    : 0

  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos, description')
    .range(offset, offset + limit - 1)

  if (error || !data) {
    console.error('Error loading STLs:', error)
    return []
  }

  return data.map((stl: any) => ({
    id: stl.id,
    title: stl.title,
    imageUrl: stl.photos?.[0] || '',
    description: stl.description || '',
  }))
}

// ─── Quality Audit: Load real STLs ─────────────────────────────────────────

export async function loadAuditQuestions(limit = 5): Promise<AuditQuestion[]> {
  const supabase = getSupabaseBrowser()

  // Get total count to calculate random offset
  const { count: totalCount, error: countError } = await supabase
    .from('telegram_indexed_stls')
    .select('id', { count: 'exact', head: true })

  if (countError || !totalCount || totalCount <= limit) {
    // If count fails or too few items, just load without offset
    const { data, error } = await supabase
      .from('telegram_indexed_stls')
      .select('id, title, photos, description, tags, file_name')
      .limit(limit)

    if (error || !data) {
      console.error('Error loading STLs:', error)
      return []
    }

    return data.map((stl: any, i: number) => ({
      id: stl.id,
      title: stl.title,
      imageUrl: stl.photos?.[0] || '',
      description: stl.description || 'Descrição não disponível',
      tags: (stl.tags || []).slice(0, 4),
      fileName: stl.file_name || 'model.stl',
      shouldApprove: i % 4 !== 0,
    }))
  }

  // Calculate random offset
  const randomOffset = Math.floor(Math.random() * (totalCount - limit + 1))

  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos, description, tags, file_name')
    .range(randomOffset, randomOffset + limit - 1)

  if (error || !data) {
    console.error('Error loading STLs:', error)
    return []
  }

  return data.map((stl: any, i: number) => ({
    id: stl.id,
    title: stl.title,
    imageUrl: stl.photos?.[0] || '',
    description: stl.description || 'Descrição não disponível',
    tags: (stl.tags || []).slice(0, 4),
    fileName: stl.file_name || 'model.stl',
    shouldApprove: i % 4 !== 0,
  }))
}
