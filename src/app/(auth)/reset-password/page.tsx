import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { AuthPage } from '@/components/auth-screen'
import { RecoveryExpired, ResetPasswordForm } from '@/components/auth-recovery'
import { RECOVERY_COOKIE } from '@/app/(auth)/recovery'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } }

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const [{ data }, cookieStore] = await Promise.all([supabase.auth.getUser(), cookies()])
  const user = data.user

  // Hace falta la sesión que abrió el enlace, no una cualquiera: con una sesión
  // normal la contraseña se cambia desde Ajustes, que pide la actual.
  const recovering = Boolean(user) && cookieStore.get(RECOVERY_COOKIE)?.value === user?.id

  return (
    <AuthPage>
      {recovering && user ? (
        <ResetPasswordForm email={user.email ?? ''} />
      ) : (
        <RecoveryExpired signedIn={Boolean(user)} />
      )}
    </AuthPage>
  )
}
