export interface Subscription {
  id: number
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  current_plan_id: number
  status: 'active' | 'past_due' | 'canceled' | 'unpaid'
  period_start: string
  period_end: string
  cancel_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionChange {
  id: number
  user_id: string
  subscription_id: number
  from_plan_id: number
  to_plan_id: number
  change_type: 'upgrade' | 'downgrade'
  effective_date: string
  proration_credit: number | null
  created_at: string
}

export interface SubscriptionChangeRequest {
  fromPlanId: number
  toPlanId: number
}

export interface SubscriptionChangeResponse {
  success: boolean
  subscription: {
    id: number
    planId: number
    status: string
    periodEnd: string
  }
}
