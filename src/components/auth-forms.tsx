'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AtSign, Check, CheckCircle2, Loader2, Mail, User, X } from 'lucide-react'
import {
  resendConfirmation, signIn, signInWithProvider, signUp, type AuthState,
} from '@/app/(auth)/actions'
import { createClient } from '@/lib/supabase/client'
import {
  AuthHeading, Divider, EMAIL_RE, EmailSentPanel, FormAlert, PasswordField, PasswordStrength,
  SubmitButton, TextField, useAuthForm, type AlertTone, type FieldErrors,
} from '@/components/auth-fields'

/** Parámetros de la URL que llegan al login (desde el callback, OAuth o Ajustes). */
export type AuthParams = {
  next?: string
  error?: string
  provider?: string
  deleted?: boolean
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
}

function paramNotice({ error, provider, deleted }: AuthParams): { tone: AlertTone; message: string } | null {
  if (deleted) return { tone: 'success', message: 'Tu cuenta se ha eliminado. ¡Hasta pronto, entrenador!' }
  if (!error) return null
  const name = PROVIDER_NAMES[provider ?? ''] ?? 'el proveedor'
  switch (error) {
    case 'provider_disabled':
      return { tone: 'error', message: `El acceso con ${name} no está disponible ahora mismo. Entra con tu usuario o tu email.` }
    case 'oauth':
    case 'google':
      return { tone: 'error', message: `No se ha podido conectar con ${name}. Inténtalo de nuevo.` }
    case 'access_denied':
      return { tone: 'info', message: `Has cancelado el acceso con ${name}.` }
    case 'link_expired':
      return {
        tone: 'error',
        message: 'El enlace ha caducado o ya se había usado. Si era para confirmar tu cuenta, inicia sesión y te ofreceremos reenviarlo.',
      }
    case 'other_browser':
      return {
        tone: 'info',
        message: 'Has abierto el enlace en otro navegador. Si era para confirmar tu cuenta, ya está confirmada: inicia sesión aquí.',
      }
    default:
      return { tone: 'error', message: 'No se ha podido completar el acceso. Inténtalo de nuevo.' }
  }
}

/* --------------------------------- Login --------------------------------- */

export function LoginForm({
  params,
  headingRef,
}: {
  params: AuthParams
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  const next = params.next ?? '/home'
  const { state, pending, errorFor, formProps } = useAuthForm(signIn, (data) => {
    const errors: FieldErrors = {}
    if (!String(data.get('identifier') ?? '').trim()) errors.identifier = 'Escribe tu usuario o tu email.'
    if (!String(data.get('password') ?? '')) errors.password = 'Escribe tu contraseña.'
    return errors
  })

  // El aviso de la URL (enlace caducado, OAuth cancelado…) deja paso al del
  // primer intento: dos avisos a la vez no se leen.
  const fromUrl = !state.error && !state.notice ? paramNotice(params) : null

  return (
    <>
      <AuthHeading
        headingRef={headingRef}
        title="¡Hola de nuevo!"
        subtitle="Entra con tu usuario o tu email para seguir con tus equipos."
      />

      {fromUrl && (
        <FormAlert tone={fromUrl.tone} className="mb-5">
          {fromUrl.message}
        </FormAlert>
      )}

      <OAuthButtons next={next} verb="Continuar" />
      <Divider>o con tu cuenta</Divider>

      <form {...formProps} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <TextField
          name="identifier"
          label="Usuario o email"
          icon={AtSign}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ash o ash@ejemplo.com"
          required
          error={errorFor('identifier')}
        />
        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="current-password"
          required
          error={errorFor('password')}
          labelAside={
            <Link href="/forgot-password" className="auth-link text-xs">
              ¿Has olvidado tu contraseña?
            </Link>
          }
        />
        {(state.error || state.notice) && (
          <FormAlert tone={state.error ? 'error' : 'success'}>
            <p>{state.error ?? state.notice}</p>
            {state.unconfirmedEmail && <ResendConfirmation email={state.unconfirmedEmail} inline />}
          </FormAlert>
        )}
        <SubmitButton pending={pending} pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </form>
    </>
  )
}

/* -------------------------------- Registro -------------------------------- */

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'unknown'

/**
 * ¿Está libre el nombre? Consulta `profiles` desde el navegador (la RLS deja
 * leer perfiles sin sesión) con una espera corta y descartando respuestas
 * viejas. `username` es citext, así que "Ash" choca con "ash" igual que en BD.
 */
function useUsernameAvailability(username: string): Availability {
  const valid = USERNAME_RE.test(username)
  const [result, setResult] = useState<{ name: string; taken: boolean | null } | null>(null)

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    const timer = setTimeout(async () => {
      let taken: boolean | null = null
      try {
        const { data, error } = await createClient()
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle()
        if (!error) taken = Boolean(data)
      } catch {
        // Sin red no se sabe; el servidor lo vuelve a comprobar al enviar.
      }
      if (!cancelled) setResult({ name: username, taken })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username, valid])

  if (!valid) return 'idle'
  if (result?.name !== username) return 'checking'
  return result.taken === null ? 'unknown' : result.taken ? 'taken' : 'available'
}

const TAKEN_MESSAGE = 'Ese nombre ya lo tiene otro entrenador. Prueba con otro.'
const USERNAME_RULE = 'De 3 a 20 letras, números o guiones bajos.'
const INVALID_CHAR_RE = /[^A-Za-z0-9_]/

/** Qué le pasa a un nombre de usuario, dicho de forma que se pueda arreglar. */
function usernameProblem(name: string): string | undefined {
  if (/\s/.test(name)) return 'Sin espacios: prueba con guiones bajos (ash_ketchum).'
  if (/[À-ÿñÑ]/.test(name)) return 'Sin tildes ni eñes: sólo letras de la A a la Z, números y _.'
  if (INVALID_CHAR_RE.test(name)) return 'Sólo letras, números y guiones bajos (_).'
  if (name.length < 3) return 'Tiene que tener al menos 3 caracteres.'
  if (name.length > 20) return 'Como mucho 20 caracteres.'
  return undefined
}

export function RegisterForm({
  headingRef,
  onGoToLogin,
}: {
  headingRef?: React.Ref<HTMLHeadingElement>
  onGoToLogin: () => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const availability = useUsernameAvailability(username.trim())
  const strengthId = useId()

  const { state, pending, errorFor, formProps } = useAuthForm(signUp, (data) => {
    const errors: FieldErrors = {}
    const name = String(data.get('username') ?? '').trim()
    const mail = String(data.get('email') ?? '').trim()
    const pw = String(data.get('password') ?? '')
    const problem = name ? usernameProblem(name) : 'Elige un nombre de usuario.'
    if (problem) errors.username = problem
    else if (availability === 'taken') errors.username = TAKEN_MESSAGE
    if (!mail) errors.email = 'Escribe tu email.'
    else if (!EMAIL_RE.test(mail)) errors.email = 'Ese email no parece válido.'
    if (!pw) errors.password = 'Elige una contraseña.'
    else if (pw.length < 8) errors.password = 'Tiene que tener al menos 8 caracteres.'
    return errors
  })

  const sent = Boolean(state.notice && state.unconfirmedEmail)
  const sentHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (sent) sentHeadingRef.current?.focus()
  }, [sent])

  if (sent && state.unconfirmedEmail) {
    return (
      <EmailSentPanel
        title="Revisa tu correo"
        headingRef={sentHeadingRef}
        tips={[
          'Abre el enlace del correo para confirmar la cuenta y entrar.',
          'Si no lo ves en un par de minutos, mira en spam o en promociones.',
        ]}
        actions={
          <>
            <ResendConfirmation email={state.unconfirmedEmail} />
            <button type="button" onClick={onGoToLogin} className="btn btn-ghost w-full">
              Ya la he confirmado, quiero entrar
            </button>
          </>
        }
      >
        Te hemos enviado un enlace a <strong className="break-all text-ink">{state.unconfirmedEmail}</strong> para
        confirmar tu cuenta.
      </EmailSentPanel>
    )
  }

  // Un carácter no válido se avisa al teclearlo; la longitud mínima, sólo al
  // enviar (con dos letras aún se está escribiendo).
  const trimmed = username.trim()
  const liveUsernameError = INVALID_CHAR_RE.test(trimmed)
    ? usernameProblem(trimmed)
    : availability === 'taken'
      ? TAKEN_MESSAGE
      : undefined

  return (
    <>
      <AuthHeading
        headingRef={headingRef}
        title="Únete a PokeHub"
        subtitle="Crea tu cuenta y empieza a compartir tus equipos con la comunidad."
      />

      <OAuthButtons next="/home" verb="Registrarme" />
      <Divider>o con tu email</Divider>

      <form {...formProps} className="flex flex-col gap-4">
        <TextField
          name="username"
          label="Nombre de usuario"
          icon={User}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ash_ketchum"
          maxLength={20}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errorFor('username') ?? liveUsernameError}
          hintLive
          hint={<UsernameHint availability={availability} username={trimmed} />}
          trailing={<AvailabilityIcon availability={availability} />}
        />
        <TextField
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ash@ejemplo.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorFor('email')}
        />
        <div>
          <PasswordField
            name="password"
            label="Contraseña"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errorFor('password')}
            hint={password ? undefined : 'Mínimo 8 caracteres.'}
            describedBy={strengthId}
          />
          <PasswordStrength id={strengthId} password={password} personal={[trimmed, email.split('@')[0] ?? '']} />
        </div>
        {(state.error || state.notice) && (
          <FormAlert tone={state.error ? 'error' : 'success'}>
            <p>{state.error ?? state.notice}</p>
          </FormAlert>
        )}
        <SubmitButton pending={pending} pendingLabel="Creando tu cuenta…">
          Crear cuenta
        </SubmitButton>
        <p className="text-center text-xs text-muted">
          Al registrarte aceptas las{' '}
          <Link href="/legal" className="auth-link">
            condiciones de uso
          </Link>
          .
        </p>
      </form>
    </>
  )
}

function UsernameHint({ availability, username }: { availability: Availability; username: string }) {
  if (availability === 'checking') {
    return <span className="text-muted">Comprobando si está libre…</span>
  }
  if (availability === 'available') {
    return (
      <span className="font-semibold text-success">
        ¡<span className="break-all">@{username}</span> está libre!
      </span>
    )
  }
  return <span>{USERNAME_RULE}</span>
}

function AvailabilityIcon({ availability }: { availability: Availability }) {
  const icon =
    availability === 'checking' ? (
      <Loader2 size={18} className="animate-spin text-muted" />
    ) : availability === 'available' ? (
      <Check size={18} strokeWidth={3} className="animate-pop text-success" />
    ) : availability === 'taken' ? (
      <X size={18} strokeWidth={3} className="animate-pop text-danger" />
    ) : null
  if (!icon) return null
  return (
    <span aria-hidden className="auth-input-trailing pointer-events-none">
      {icon}
    </span>
  )
}

/* ------------------------------ Piezas comunes ------------------------------ */

function OAuthButtons({ next, verb }: { next: string; verb: 'Continuar' | 'Registrarme' }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <OAuthButton provider="google" next={next} label={`${verb} con Google`} />
      <OAuthButton provider="github" next={next} label={`${verb} con GitHub`} />
    </div>
  )
}

function OAuthButton({
  provider,
  next,
  label,
}: {
  provider: 'google' | 'github'
  next: string
  label: string
}) {
  return (
    <form action={signInWithProvider}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="next" value={next} />
      <OAuthSubmit provider={provider} label={label} />
    </form>
  )
}

function OAuthSubmit({ provider, label }: { provider: 'google' | 'github'; label: string }) {
  const { pending } = useFormStatus()
  const Glyph = provider === 'google' ? GoogleGlyph : GitHubGlyph

  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault()
      }}
      className="btn btn-soft btn-lg w-full"
    >
      {pending ? <Loader2 aria-hidden size={18} className="animate-spin" /> : <Glyph />}
      {PROVIDER_NAMES[provider]}
    </button>
  )
}

/**
 * Salida para el usuario que se ha registrado y no ha recibido (o ha perdido)
 * el correo de verificación. Sin esto la cuenta queda inutilizable.
 */
function ResendConfirmation({ email, inline = false }: { email: string; inline?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resendConfirmation, {})

  if (state.notice) {
    return (
      <p role="status" className={inline ? 'mt-1.5 text-xs font-semibold' : 'flex items-center justify-center gap-1.5 text-sm font-semibold text-success'}>
        {!inline && <CheckCircle2 aria-hidden size={16} />}
        {state.notice}
      </p>
    )
  }

  return (
    <form action={action} className={inline ? 'mt-1.5' : undefined}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        aria-disabled={pending || undefined}
        onClick={(e) => {
          if (pending) e.preventDefault()
        }}
        className={
          inline
            ? 'inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2'
            : 'btn btn-primary btn-lg w-full'
        }
      >
        {pending && <Loader2 aria-hidden size={inline ? 12 : 18} className="animate-spin" />}
        Reenviar correo de confirmación
      </button>
      {state.error && (
        <p role="alert" className={inline ? 'mt-1 text-xs' : 'mt-2 text-center text-xs text-danger'}>
          {state.error}
        </p>
      )}
    </form>
  )
}

/** Marca de GitHub; usa `currentColor` para seguir al tema claro/oscuro. */
function GitHubGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/** Logotipo oficial de Google en sus cuatro colores. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.59-5.17 3.59-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}
