import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
  description: 'Encontre, imprima e venda. O maior garimpo de STLs do Brasil — busca inteligente, calculadora de custos, CRM e portfólio integrados.',
  keywords: ['STL', 'impressão 3D', 'FDM', 'garimpo STL', 'maker', 'vender impressão 3D', 'busca STL'],
  openGraph: {
    title: 'LB Creative Studio — Garimpo de STLs para Makers 3D',
    description: 'Encontre, imprima e venda. O seu garimpo de STLs preferido é aqui.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-background text-foreground antialiased transition-colors duration-300"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
