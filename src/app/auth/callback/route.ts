import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Vuelta del proveedor OAuth: se canjea el `code` por una sesión y se deja al
 * usuario dentro. El perfil lo crea el trigger `handle_new_user` en Postgres.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/home'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'

  // Detrás de un proxy, `request.nextUrl.origin` es el host interno.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (forwardedHost ? `${forwardedProto ?? 'https'}://${forwardedHost}` : request.nextUrl.origin)

  // El usuario canceló la pantalla de consentimiento de Google.
  const oauthError = searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
