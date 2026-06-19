import type { Metadata } from 'next'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'

export const metadata: Metadata = {
  title: 'LB Creative Studio — Dashboard',
  description: 'Sistema completo de busca, precificação e orçamentos para Impressão 3D.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />

      <main className="flex-1">
        <Hero />
        
        <Features />
        
        {/* Simple CTA */}
        <section className="py-24 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50" />
          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-8">
              Pronto para imprimir seu primeiro projeto?
            </h2>
            <a
              href="/login?mode=signup"
              className="inline-block px-10 py-5 bg-white text-primary rounded-2xl font-black text-xl 
                         shadow-2xl hover:scale-105 transition-transform"
            >
              Começar Agora Gratuitamente
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 px-6 bg-card">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-black text-xs">LB</span>
              </div>
              <span className="font-bold text-foreground text-lg">LB Creative Studio</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Simplificando o design 3D para quem ama criar. Do bit ao átomo, estamos com você.
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
