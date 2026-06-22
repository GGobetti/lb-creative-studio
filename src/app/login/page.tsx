import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginPage } from './LoginPage'

export const metadata: Metadata = {
  title: 'Entrar — LB Creative Studio',
  description: 'Acesse sua conta para criar e exportar modelos 3D paramétricos.',
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
