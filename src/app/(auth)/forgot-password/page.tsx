import type { Metadata } from 'next'
import { AuthPage } from '@/components/auth-screen'
import { ForgotPasswordForm } from '@/components/auth-recovery'
import { isRecoveryIssue } from '@/app/(auth)/recovery'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  // El callback manda aquí los enlaces caducados o abiertos en otro navegador.
  const { error } = await searchParams
  const issue = isRecoveryIssue(error) ? error : undefined

  return (
    <AuthPage>
      <ForgotPasswordForm issue={issue} />
    </AuthPage>
  )
}
