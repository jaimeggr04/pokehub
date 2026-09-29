import type { Metadata } from 'next'
import { AuthScreen } from '@/components/auth-screen'

export const metadata: Metadata = { title: 'Iniciar sesión' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

// Los parámetros se leen en el servidor y no con useSearchParams: así el
// formulario sale ya en el HTML en lugar de esperar a hidratar.
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return (
    <AuthScreen
      mode="login"
      startOpen
      params={{
        next: first(params.next),
        error: first(params.error),
        provider: first(params.provider),
        deleted: first(params.deleted) === '1',
      }}
    />
  )
}
