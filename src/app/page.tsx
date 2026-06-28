import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { AffiliateCarousel } from '@/components/landing/AffiliateCarousel'
import { fetchAffiliateProducts } from '@/lib/api/affiliate'

export const metadata: Metadata = {
  title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
  description: 'Encontre, imprima e venda. O seu garimpo de STLs preferido é aqui.',
}

export const dynamic = 'force-dynamic'

// Loading fallback for carousel
function CarouselFallback() {
  return (
    <section className="py-16 bg-slate-900 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Loading products...</p>
      </div>
    </section>
  )
}

// Carousel server component
async function CarouselSection() {
  try {
    const products = await fetchAffiliateProducts('mercado_livre')
    return <AffiliateCarousel products={products} />
  } catch (err) {
    console.error('Failed to load carousel:', err)
    return null // Silently fail - carousel is optional
  }
}

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

        <Features />

        {/* New: Affiliate products carousel */}
        <Suspense fallback={<CarouselFallback />}>
          <CarouselSection />
        </Suspense>

        {/* CTA — solid brand color in light, glass in dark */}
        <section className="py-24 relative overflow-hidden
                            bg-primary dark:bg-transparent
                            dark:border-t dark:border-white/10">
          {/* Light mode radial overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50 dark:hidden" />
          {/* Dark mode glass overlay */}
          <div className="absolute inset-0 dark:block hidden"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(120,80,255,0.15) 0%, transparent 70%)' }}
          />
          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-black text-white dark:text-foreground mb-8">
              Pronto para imprimir seu primeiro projeto?
            </h2>
            <a
              href="/login?mode=signup"
              className="inline-block px-10 py-5 rounded-2xl font-black text-xl shadow-2xl
                         hover:scale-105 transition-transform
                         bg-white text-primary
                         dark:bg-white/10 dark:text-foreground dark:border dark:border-white/20 dark:backdrop-blur-xl"
            >
              Começar Agora Gratuitamente
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 px-6 bg-card relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-black text-xs">LB</span>
              </div>
              <span className="font-bold text-foreground text-lg">LB Creative Studio</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Feito por makers, para makers. A plataforma completa para quem leva a impressão 3D a sério.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#catalog" className="hover:text-primary">Catálogo</a></li>
              <li><a href="#features" className="hover:text-primary">Funcionalidades</a></li>
              <li><a href="/login" className="hover:text-primary">Entrar</a></li>
              <li><a href="/login?mode=signup" className="hover:text-primary">Cadastrar</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Comunidade</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Telegram</a></li>
              <li><a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Instagram</a></li>
              <li><a href="/dashboard/hub" className="hover:text-primary">Ajuda & Hub Maker</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-border text-center">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} LB Creative Studio · Desenvolvido para Makers
          </p>
        </div>
      </footer>
    </div>
  )
}
