import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  FORGOT_PATH, RECOVERY_COOKIE, RECOVERY_MAX_AGE_S, RESET_PATH, type RecoveryIssue,
} from '@/app/(auth)/recovery'

const EMAIL_OTP_TYPES: readonly string[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

/**
 * Vuelta de Supabase: OAuth, confirmación de cuenta y recuperación de
 * contraseña. Se canjea el `code` (PKCE) por una sesión y se deja al usuario
 * dentro. El perfil lo crea el trigger `handle_new_user` en Postgres.
 *
 * También acepta `token_hash` + `type`, el formato de las plantillas de correo
 * que apuntan aquí directamente: no depende del verificador PKCE guardado en
 * cookie, así que el enlace funciona aunque se abra en otro navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const rawNext = searchParams.get('next') ?? '/home'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'

  // Detrás de un proxy, `request.nextUrl.origin` es el host interno.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    (forwardedHost ? `${forwardedProto ?? 'https'}://${forwardedHost}` : request.nextUrl.origin)

  const go = (path: string) => NextResponse.redirect(`${origin}${path}`)

  // Un enlace de recuperación que falla acaba en "pide otro", no en el login con
  // un error genérico que no dice qué hacer.
  const isRecovery = next === RESET_PATH || type === 'recovery'
  const recoveryFailed = (issue: RecoveryIssue) => go(`${FORGOT_PATH}?error=${issue}`)

  // Supabase añade `error` y `error_code` cuando el enlace del correo ha caducado
  // o ya se usó, y también cuando el usuario cancela la pantalla de Google.
  const oauthError = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  if (oauthError || errorCode) {
    if (isRecovery) return recoveryFailed('expired')
    if (errorCode === 'otp_expired') return go('/login?error=link_expired')
    return go(`/login?error=${encodeURIComponent(oauthError ?? 'callback')}`)
  }

  const supabase = await createClient()
  let recoveredUserId: string | null = null

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // El verificador PKCE vive en una cookie del navegador que pidió el enlace:
      // abierto en otro, el canje no puede funcionar.
      const otherBrowser = error.code === 'pkce_code_verifier_not_found'
      if (isRecovery) return recoveryFailed(otherBrowser ? 'browser' : 'expired')
      // En la confirmación de cuenta, Supabase ya ha verificado el email antes de
      // redirigir aquí: basta con iniciar sesión en este navegador.
      return go(`/login?error=${otherBrowser ? 'other_browser' : 'callback'}`)
    }
    // auth-js deduce el tipo del verificador PKCE que guardó al pedir el enlace
    // (resetPasswordForEmail le añade "/recovery") y lo devuelve aunque el tipo
    // de la respuesta no lo declare. Fiarse de `next` no bastaría: cualquiera
    // podría añadirlo a mano a un canje de OAuth.
    const { redirectType } = data as { redirectType?: string | null }
    if (redirectType === 'recovery') recoveredUserId = data.user?.id ?? null
  } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })
    if (error) {
      if (isRecovery) return recoveryFailed('expired')
      return go('/login?error=link_expired')
    }
    if (type === 'recovery') recoveredUserId = data.user?.id ?? null
  } else {
    if (isRecovery) return recoveryFailed('expired')
    return go('/login?error=callback')
  }

  if (recoveredUserId) {
    const response = go(RESET_PATH)
    response.cookies.set(RECOVERY_COOKIE, recoveredUserId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin.startsWith('https://'),
      path: '/',
      maxAge: RECOVERY_MAX_AGE_S,
    })
    return response
  }

  return go(next)
}
