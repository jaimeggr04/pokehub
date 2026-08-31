import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthScreen } from '@/components/auth-screen'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthScreen mode="register" startOpen />
    </Suspense>
  )
}
