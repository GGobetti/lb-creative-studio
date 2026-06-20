#!/usr/bin/env node

/**
 * Script to update Stripe product benefits via the admin API
 * Usage: STRIPE_ADMIN_TOKEN=xxx node scripts/update-stripe-benefits.js
 *
 * Get your product IDs from: https://dashboard.stripe.com/products
 */

const TOKEN = process.env.STRIPE_ADMIN_TOKEN
const API_URL = process.env.API_URL || 'http://localhost:3000'

if (!TOKEN) {
  console.error('❌ STRIPE_ADMIN_TOKEN env var not set')
  process.exit(1)
}

const benefits = {
  pro: [
    { id: 'credits_100', label: '100+ créditos/mês' },
    { id: 'support_standard', label: 'Suporte padrão' },
    { id: 'updates_free', label: 'Atualizações grátis' },
  ],
  max: [
    { id: 'credits_300', label: '300+ créditos/mês' },
    { id: 'downloads_higher', label: 'Limite maior de downloads' },
    { id: 'export_discount', label: 'Desconto por exportação' },
    { id: 'support_priority', label: 'Suporte prioritário' },
  ],
}

// Replace these with your actual Stripe product IDs
const updates = [
  {
    productId: 'prod_UjqsQk9TXqxkZN', // Pro
    benefits: benefits.pro,
  },
  {
    productId: 'prod_...', // Max - replace with your product ID
    benefits: benefits.max,
  },
]

async function updateBenefits() {
  console.log('📤 Updating Stripe product benefits...\n')

  try {
    const response = await fetch(`${API_URL}/api/admin/sync-stripe-benefits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ updates }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Error:', data.error)
      process.exit(1)
    }

    console.log(`✅ ${data.message}\n`)
    data.results.forEach(result => {
      if (result.status === 'success') {
        console.log(`  ✓ ${result.productId} (${result.benefitsCount} benefits)`)
      } else {
        console.log(`  ✗ ${result.productId}: ${result.error}`)
      }
    })
  } catch (err) {
    console.error('❌ Failed to update:', err.message)
    process.exit(1)
  }
}

updateBenefits()
