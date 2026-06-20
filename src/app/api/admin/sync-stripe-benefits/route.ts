import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-05-27.dahlia' as any
})

interface BenefitUpdate {
  productId: string
  benefits: Array<{ id: string; label: string }>
}

/**
 * Admin endpoint to update Stripe product benefits
 * POST /api/admin/sync-stripe-benefits
 * Body: { updates: [{ productId: "prod_...", benefits: [...] }] }
 */
export async function POST(req: NextRequest) {
  try {
    // Basic auth check - you should add proper auth
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.STRIPE_ADMIN_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { updates } = await req.json() as { updates: BenefitUpdate[] }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const results = []

    for (const update of updates) {
      try {
        await stripe.products.update(update.productId, {
          metadata: {
            benefits: JSON.stringify(update.benefits),
          },
        })
        results.push({
          productId: update.productId,
          status: 'success',
          benefitsCount: update.benefits.length,
        })
        console.log(`Updated product ${update.productId} with ${update.benefits.length} benefits`)
      } catch (err: any) {
        results.push({
          productId: update.productId,
          status: 'error',
          error: err.message,
        })
        console.error(`Failed to update product ${update.productId}:`, err.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.filter(r => r.status === 'success').length}/${results.length} products`,
      results,
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('sync-stripe-benefits error:', errorMsg)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
