export interface LeaderboardUser {
  rank: number
  userId: string
  name: string
  xp: number
  badge: string
  streak: number
  gamesPlayed: number
}

export interface LeaderboardResponse {
  period: string
  rankings: LeaderboardUser[]
  userPosition: LeaderboardUser | null
}
