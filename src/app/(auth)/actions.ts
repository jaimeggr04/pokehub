'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AuthState {
  error?: string
  notice?: string
  /**
   * Email pendiente de confirmar. Cuando viene relleno, el formulario ofrece
   * reenviar el correo de verificación en lugar de dejar al usuario atascado.
   */
  unconfirmedEmail?: string
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/** Sólo se aceptan rutas internas como destino post-login (evita open redirect). */
function safeNext(raw: unknown) {
  const next = String(raw ?? '/home')
  return next.startsWith('/') && !next.startsWith('//') ? next : '/home'
}

/**
 * Origen público de la app. En producción detrás de un proxy hay que mirar las
 * cabeceras `x-forwarded-*`, porque `host` sería el del contenedor interno.
 */
async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get('identifier') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(formData.get('next'))

  if (!identifier || !password) {
    return { error: 'Introduce tu usuario/email y tu contraseña.' }
  }

  const supabase = await createClient()
  let email = identifier

  // Permite iniciar sesión con el nombre de usuario, como en la versión original.
  // La función SQL sólo devuelve el email si la contraseña ya es correcta, así que
  // no se puede usar para enumerar correos de otras cuentas.
  if (!identifier.includes('@')) {
    const { data: resolved } = await supabase.rpc('email_for_login', {
      uname: identifier,
      pw: password,
    })
    if (!resolved) return { error: 'Usuario o contraseña incorrectos.' }
    email = resolved as unknown as string
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // La contraseña era correcta pero la cuenta está sin verificar: decirle
    // "usuario o contraseña incorrectos" mandaba al usuario a cambiar algo que
    // no estaba mal, cuando lo único que falta es confirmar el correo.
    if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
      return {
        error: 'Tu cuenta existe pero todavía no has confirmado el correo.',
        unconfirmedEmail: email,
      }
    }
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

/**
 * Reenvía el correo de verificación. El proveedor de correo integrado de
 * Supabase va muy limitado (unos pocos envíos por hora), así que el aviso de
 * exceso de cuota se traduce a algo que el usuario pueda entender.
 */
export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return { error: 'No sabemos a qué dirección reenviarlo.' }

  const supabase = await createClient()
  const origin = await siteOrigin()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/home` },
  })

  if (error) {
    if (/rate limit|too many/i.test(error.message)) {
      return {
        error: 'Se ha alcanzado el límite de correos por hora. Prueba dentro de un rato.',
        unconfirmedEmail: email,
      }
    }
    return { error: 'No se pudo reenviar el correo.', unconfirmedEmail: email }
  }

  return { notice: `Correo de confirmación reenviado a ${email}.` }
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get('username') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!USERNAME_RE.test(username)) {
    return { error: 'El usuario debe tener entre 3 y 20 caracteres (letras, números o _).' }
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const supabase = await createClient()

  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) return { error: 'Ese nombre de usuario ya está en uso.' }

  const origin = await siteOrigin()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      // Sin esto, el enlace del correo apunta al "Site URL" del panel de
      // Supabase (por defecto localhost), y en producción lleva a ninguna parte.
      emailRedirectTo: `${origin}/auth/callback?next=/home`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'Ya existe una cuenta con ese email.' }
    }
    if (/rate limit|too many/i.test(error.message)) {
      return { error: 'Se ha alcanzado el límite de correos por hora. Prueba dentro de un rato.' }
    }
    return { error: error.message }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    // Con la confirmación por correo activada esto es lo normal, no un fallo.
    return {
      notice: `Cuenta creada. Te hemos enviado un correo a ${email} para confirmarla.`,
      unconfirmedEmail: email,
    }
  }

  revalidatePath('/', 'layout')
  redirect('/home')
}

type OAuthProvider = 'google' | 'github'

const OAUTH_PROVIDERS = ['google', 'github'] as const

/**
 * Proveedores realmente habilitados en el proyecto de Supabase. GoTrue expone la
 * lista en /auth/v1/settings; se cachea unos minutos para no pagar una petición
 * extra en cada clic.
 */
let enabledCache: { at: number; providers: Set<string> } | null = null
const ENABLED_TTL_MS = 5 * 60_000

async function isProviderEnabled(provider: OAuthProvider) {
  if (!enabledCache || Date.now() - enabledCache.at > ENABLED_TTL_MS) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        cache: 'no-store',
      })
      // Si no se puede comprobar, seguimos adelante y que decida Supabase.
      if (!res.ok) return true
      const settings = (await res.json()) as { external?: Record<string, boolean> }
      enabledCache = {
        at: Date.now(),
        providers: new Set(
          Object.entries(settings.external ?? {})
            .filter(([, on]) => on)
            .map(([name]) => name),
        ),
      }
    } catch {
      return true
    }
  }
  return enabledCache.providers.has(provider)
}

/**
 * Arranca el flujo OAuth (Google o GitHub). Supabase devuelve la URL de
 * consentimiento y el navegador vuelve luego a /auth/callback con el `code` que
 * se canjea allí.
 */
export async function signInWithProvider(formData: FormData) {
  const raw = String(formData.get('provider') ?? '')
  const provider = (OAUTH_PROVIDERS as readonly string[]).includes(raw)
    ? (raw as OAuthProvider)
    : null
  const next = safeNext(formData.get('next'))

  // `redirect()` lanza una excepción de control, así que va fuera de cualquier try.
  if (!provider) redirect('/login?error=callback')

  // Sin esta comprobación, un proveedor apagado en el panel deja al usuario en la
  // página JSON de error de /authorize en vez de devolverlo al login.
  if (!(await isProviderEnabled(provider))) {
    redirect(`/login?error=provider_disabled&provider=${provider}`)
  }

  const supabase = await createClient()
  const origin = await siteOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // Google recuerda la última cuenta usada; forzamos el selector para cambiarla.
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
    },
  })

  if (error || !data?.url) redirect(`/login?error=oauth&provider=${provider}`)
  redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
