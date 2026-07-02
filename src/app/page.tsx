import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { STLShowcase } from '@/components/landing/STLShowcase'
import { LandingCtaFooter } from '@/components/landing/LandingCtaFooter'

export const metadata: Metadata = {
  title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
  description: 'Encontre, imprima e venda. O seu garimpo de STLs preferido é aqui.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 relative overflow-hidden">

      {/* Liquid Glass mesh — absolute so backdrop-filter on glass elements blurs it */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden pointer-events-none dark:block hidden">
        <div
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[80%] animate-blob-1 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(120,80,255,0.18) 0%, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[75%] animate-blob-2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(0,160,255,0.14) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-[30%] left-[40%] w-[40%] h-[50%] animate-blob-3 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(255,80,120,0.08) 0%, transparent 65%)' }}
        />
      </div>

      <Navbar />

      <main className="flex-1 relative z-10">
        <Hero />

        <Suspense fallback={null}>
          <STLShowcase />
        </Suspense>

        <Features />

        <LandingCtaFooter />
      </main>
    </div>
  )
}
