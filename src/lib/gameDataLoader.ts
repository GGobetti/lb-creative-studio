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

  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos, tags')
    .limit(limit)

  if (error || !data) {
    console.error('Error loading STLs:', error)
    return []
  }

  return data.map((stl: any) => {
    const existingTags = (stl.tags || []).slice(0, 4)
    const fakeTag = `#fake-tag-${Math.random().toString(36).slice(2, 9)}`
    const allTags = [...existingTags, fakeTag].sort(() => Math.random() - 0.5)

    return {
      id: stl.id,
      title: stl.title,
      imageUrl: stl.photos?.[0] || '',
      tags: allTags.map((tag: string) => ({
        text: tag,
        isRelevant: existingTags.includes(tag),
      })),
    }
  })
}

// ─── Category Sort: Load real STLs ──────────────────────────────────────────

export async function loadCategorySortItems(limit = 15): Promise<SortableStl[]> {
  const supabase = getSupabaseBrowser()

  const { data, error } = await supabase
    .from('telegram_indexed_stls')
    .select('id, title, photos')
    .limit(limit)

  if (error || !data) {
    console.error('Error loading STLs:', error)
    return []
  }

  return data.map((stl: any) => ({
    id: stl.id,
    title: stl.title,
    imageUrl: stl.photos?.[0] || '',
    correctCategory: STL_CATEGORIES[Math.floor(Math.random() * STL_CATEGORIES.length)],
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
