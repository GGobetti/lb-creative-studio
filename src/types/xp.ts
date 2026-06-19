// src/types/xp.ts

export interface XpLevel {
  level: number
  name: string
  xp_required: number
  badge_icon: string
  badge_color: string
  credits_reward: number
}

export interface UserBadge {
  level: number
  unlocked_at: string
  credits_awarded: number
  name: string
  badge_icon: string
  badge_color: string
}

export interface XpSummary {
  xp_total: number
  xp_earned_total: number
  current_level: XpLevel
  next_level: XpLevel | null
  current_streak_weeks: number
  best_streak_weeks: number
  badges: UserBadge[]
}

export interface AwardXpResult {
  xp_earned: number
  xp_total: number
  level_up: boolean
  new_level: number | null
  credits_awarded: number
}

export interface RedeemXpResult {
  credits_earned: number
  xp_redeemed: number
  xp_remaining: number
}

export interface XpConfig {
  id: number
  xp_to_credits_rate: number
  min_redeem_xp: number
  max_redeem_per_day: number
}

export interface GameRewardsConfig {
  game_type: string
  actions_per_reward: number
  credits_per_reward: number
  xp_per_action: number
}
