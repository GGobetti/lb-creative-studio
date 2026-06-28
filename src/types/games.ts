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
  description: string
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

export interface AuditSuggestion {
  id: string
  auditor_id: string
  suggested_title:       string | null
  suggested_description: string | null
  suggested_tags:        string[]
  suggested_categories:  string[]
  flagged_issues:        string | null
  upvote_count:          number
  has_upvoted:           boolean
  created_at:            string
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
  'Decoração',
  'Esportes',
  'Utilidades',
  'Jogos & Board Games',
  'Desenhos & Anime',
  'Esculturas & Arte',
  'Miniaturas & RPG',
  'Brinquedos',
  'Veículos',
  'Personagens & Figuras',
  'Casa & Cozinha',
  'Natureza & Animais',
  'Ferramentas',
  'Educação',
  'Joalheria & Acessórios',
  'Outros',
  'Multipartes/NO AMS',
  // Categorias Especiais - Franquias & Personagens
  'Sonic',
  'Mario',
  'Pokémon',
  'Dragon Ball',
  'One Piece',
  'Naruto',
  'Marvel',
  'DC Comics',
  'Star Wars',
  'Harry Potter',
  'Lord of the Rings',
  'Disney',
  'Studio Ghibli',
  'Minecraft',
  'Fortnite',
  'League of Legends',
]
