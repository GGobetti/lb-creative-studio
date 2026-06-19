export type GameType = 'photo-match' | 'tag-detective' | 'category-sort' | 'quality-audit'

export interface PhotoMatchQuestion {
  id: string
  imageUrl: string
  title: string
  description: string
  isMatch: boolean
}

export interface TagItem {
  text: string
  isRelevant: boolean
}

export interface TagDetectiveQuestion {
  id: string
  imageUrl: string
  title: string
  tags: TagItem[]
}

export interface SortableStl {
  id: string
  imageUrl: string
  title: string
  correctCategory: string
}

export interface CategorySortRound {
  items: SortableStl[]
  categories: string[]
}

export interface AuditQuestion {
  id: string
  imageUrl: string
  title: string
  description: string
  tags: string[]
  fileName: string
  shouldApprove: boolean
  issues?: string[]
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond'

export interface Badge {
  id: string
  tier: BadgeTier
  name: string
  requiredPoints: number
  unlockedPower: string
}

export const BADGES: Badge[] = [
  { id: 'bronze', tier: 'bronze', name: 'Iniciante', requiredPoints: 10, unlockedPower: 'Acesso a todos os games' },
  { id: 'silver', tier: 'silver', name: 'Curador', requiredPoints: 100, unlockedPower: 'Aprovações valem 2×' },
  { id: 'gold', tier: 'gold', name: 'Especialista', requiredPoints: 500, unlockedPower: 'Streak bonus +5 créditos' },
  { id: 'diamond', tier: 'diamond', name: 'Moderador', requiredPoints: 2000, unlockedPower: 'Aprovação solo de STLs' },
]

export const GAME_CONFIGS = {
  'photo-match':    { credits: 10, sessionSize: 10, dailyLimit: 50, label: 'Photo Match' },
  'tag-detective':  { credits: 5,  sessionSize: 20, dailyLimit: 50, label: 'Tag Detective' },
  'category-sort':  { credits: 25, sessionSize: 5,  dailyLimit: 50, label: 'Category Sort' },
  'quality-audit':  { credits: 15, sessionSize: 5,  dailyLimit: 50, label: 'Quality Audit' },
} as const

export const STL_CATEGORIES = [
  'Figurines',
  'Funcional',
  'Joalheria',
  'Esportes',
  'Decoração',
  'Ferramentas',
  'Educação',
  'Outros',
]
