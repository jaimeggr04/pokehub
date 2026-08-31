import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthScreen } from '@/components/auth-screen'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <Suspense>
      <AuthScreen mode="login" startOpen />
    </Suspense>
  )
}
