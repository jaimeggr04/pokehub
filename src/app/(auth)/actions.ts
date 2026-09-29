'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE, RESET_PATH } from '@/app/(auth)/recovery'

export type AuthField = 'identifier' | 'password' | 'username' | 'email' | 'repeat'

export interface AuthState {
  error?: string
  notice?: string
  /**
   * Errores que pertenecen a un campo concreto. El formulario los pinta bajo
   * ese campo (con aria-describedby) en lugar de en el aviso general.
   */
  fieldErrors?: Partial<Record<AuthField, string>>
  /**
   * Email pendiente de confirmar. Cuando viene relleno, el formulario ofrece
   * reenviar el correo de verificación en lugar de dejar al usuario atascado.
   */
  unconfirmedEmail?: string
  /** La acción terminó bien y el cliente se encarga de lo que sigue. */
  done?: boolean
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
// Sólo descarta lo evidente; la validación real la hace Supabase al enviar.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const RATE_LIMIT_RE = /rate limit|too many/i
const RATE_LIMIT_MESSAGE = 'Se ha alcanzado el límite de correos por hora. Prueba dentro de un rato.'

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
    return {
      fieldErrors: {
        ...(!identifier && { identifier: 'Escribe tu usuario o tu email.' }),
        ...(!password && { password: 'Escribe tu contraseña.' }),
      },
    }
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
    if (RATE_LIMIT_RE.test(error.message)) {
      return { error: RATE_LIMIT_MESSAGE, unconfirmedEmail: email }
    }
    return { error: 'No se pudo reenviar el correo.', unconfirmedEmail: email }
  }

  return { notice: `Correo de confirmación reenviado a ${email}.` }
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get('username') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const fieldErrors: AuthState['fieldErrors'] = {}
  if (!USERNAME_RE.test(username)) {
    fieldErrors.username = 'De 3 a 20 letras, números o guiones bajos.'
  }
  if (!EMAIL_RE.test(email)) fieldErrors.email = 'Escribe un email válido.'
  if (password.length < 8) fieldErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const supabase = await createClient()

  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) return { fieldErrors: { username: 'Ese nombre de usuario ya está en uso.' } }

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
      return { fieldErrors: { email: 'Ya existe una cuenta con ese email.' } }
    }
    if (RATE_LIMIT_RE.test(error.message)) {
      return { error: RATE_LIMIT_MESSAGE }
    }
    if (error.code === 'weak_password') {
      return { fieldErrors: { password: 'Elige una contraseña más segura: mezcla letras, números y símbolos.' } }
    }
    if (error.code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(error.message)) {
      return { fieldErrors: { email: 'Ese email no parece válido.' } }
    }
    return { error: 'No se ha podido crear la cuenta. Inténtalo de nuevo.' }
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

/**
 * Pide el correo para restablecer la contraseña. La respuesta es la misma
 * exista o no la cuenta: si cambiara, este formulario serviría para averiguar
 * qué emails están registrados.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: 'Escribe un email válido.' } }

  const supabase = await createClient()
  const origin = await siteOrigin()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${RESET_PATH}`,
  })

  if (error) {
    if (RATE_LIMIT_RE.test(error.message)) return { error: RATE_LIMIT_MESSAGE }
    // Sin conexión con Supabase no se ha enviado nada a nadie, exista o no la
    // cuenta: decirlo no revela nada y evita que alguien espere un correo en vano.
    if (isAuthRetryableFetchError(error)) {
      return { error: 'No hemos podido conectar para enviar el correo. Inténtalo de nuevo.' }
    }
    // El resto (incluido el "espera unos segundos" por pedirlo dos veces seguidas
    // o un fallo al enviar el correo) sólo le pasa a cuentas que existen: se
    // responde igual que si todo hubiera ido bien.
  }

  return {
    notice: 'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva.',
    done: true,
  }
}

/**
 * Guarda la contraseña nueva con la sesión que abrió el enlace del correo. Sólo
 * vale para esa sesión (cookie que pone el callback): con una sesión normal se
 * cambia desde Ajustes, que pide la contraseña actual.
 */
export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '')
  const repeat = String(formData.get('repeat') ?? '')

  if (password.length < 8) {
    return { fieldErrors: { password: 'La contraseña debe tener al menos 8 caracteres.' } }
  }
  if (password !== repeat) {
    return { fieldErrors: { repeat: 'Las dos contraseñas no coinciden.' } }
  }

  const supabase = await createClient()
  const cookieStore = await cookies()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || cookieStore.get(RECOVERY_COOKIE)?.value !== user.id) {
    return { error: 'El enlace ha caducado. Pide otro para cambiar la contraseña.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') {
      return { fieldErrors: { password: 'Es la misma contraseña que ya tenías. Elige otra distinta.' } }
    }
    if (error.code === 'weak_password') {
      return { fieldErrors: { password: 'Elige una contraseña más segura: mezcla letras, números y símbolos.' } }
    }
    return { error: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.' }
  }

  cookieStore.delete(RECOVERY_COOKIE)
  // Si alguien pide una contraseña nueva es a menudo porque la anterior se ha
  // filtrado: cualquier otra sesión abierta con ella deja de valer.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {})

  revalidatePath('/', 'layout')
  return { done: true }
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
