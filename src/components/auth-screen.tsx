'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AtSign, ChevronUp, Eye, EyeOff, Loader2, Mail, User } from 'lucide-react'
import { Logo } from '@/components/logo'
import { PokeballCore } from '@/components/pokeball'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  resendConfirmation, signIn, signInWithProvider, signUp, type AuthState,
} from '@/app/(auth)/actions'

type Mode = 'login' | 'register'

/** closed -> shaking -> opening -> open -> closing -> closed */
type BallState = 'closed' | 'shaking' | 'opening' | 'open' | 'closing'

const SHAKE_MS = 900
const OPEN_MS = 850
const CLOSE_MS = 600

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function AuthScreen({
  mode: initialMode,
  startOpen,
}: {
  mode: Mode
  startOpen: boolean
}) {
  const [state, setState] = useState<BallState>(startOpen ? 'open' : 'closed')
  const [flashKey, setFlashKey] = useState(0)
  const [mode, setMode] = useState<Mode>(initialMode)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => setMode(initialMode), [initialMode])

  // Nunca dejar temporizadores vivos si el usuario navega a mitad de animación.
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }, [])

  const openBall = useCallback(() => {
    if (state !== 'closed') return
    if (prefersReducedMotion()) {
      setState('open')
      return
    }
    setState('shaking')
    schedule(() => {
      setFlashKey((k) => k + 1)
      setState('opening')
      schedule(() => setState('open'), OPEN_MS)
    }, SHAKE_MS)
  }, [state, schedule])

  const closeBall = useCallback(() => {
    if (state !== 'open') return
    if (prefersReducedMotion()) {
      setState('closed')
      return
    }
    setState('closing')
    schedule(() => setState('closed'), CLOSE_MS)
  }, [state, schedule])

  // `expanded` gobierna la altura de las mitades; durante `closing` ya vuelven a
  // la posición cerrada, por eso sólo es cierto en opening/open.
  const expanded = state === 'opening' || state === 'open'
  const contentVisible = state === 'open'

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Mitad superior de la pokéball = cabecera */}
      <div
        data-state={state}
        className={`pokeball-half fixed inset-x-0 top-0 z-30 overflow-hidden border-b-8 border-band bg-brand shadow-card ${
          expanded ? 'h-[92px] md:h-[112px]' : 'h-[calc(50vh-0.25rem)]'
        }`}
      >
        {/* Marcas de Master Ball: sólo se ven en tema oscuro y con la bola cerrada. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-[14%] flex items-end justify-center gap-6 transition-opacity duration-500 ${
            expanded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="h-10 w-10 rounded-full bg-[var(--ball-mark)] md:h-14 md:w-14" />
          <svg viewBox="0 0 40 30" className="h-16 w-20 md:h-24 md:w-28">
            <path
              d="M4 28 L9 4 L20 16 L31 4 L36 28"
              fill="none"
              stroke="var(--ball-mark-m)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="h-10 w-10 rounded-full bg-[var(--ball-mark)] md:h-14 md:w-14" />
        </div>

        <div className="relative mx-auto flex h-full max-w-[1800px] items-center justify-between px-4 md:px-7">
          <div className={`transition-opacity duration-700 ${contentVisible ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0'}`}>
            <Logo href={null} size="md" />
          </div>
          <div className={`transition-opacity duration-700 ${contentVisible ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0'}`}>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mitad inferior = pie */}
      <div
        data-state={state}
        className={`pokeball-half fixed inset-x-0 bottom-0 z-30 border-t-8 border-band bg-bg-elevated ${
          expanded ? 'h-10 border-t-2' : 'h-[calc(50vh-0.25rem)]'
        }`}
      >
        <p
          className={`flex h-full items-center justify-center px-6 text-center text-[11px] text-muted transition-opacity duration-700 ${
            contentVisible ? 'opacity-100 delay-200' : 'opacity-0'
          }`}
        >
          Todo el contenido es © de PokeHub. Pokémon y todos los nombres relacionados son marca
          registrada y © de Nintendo.
        </p>
      </div>

      {/* Destello al abrirse la ranura */}
      {flashKey > 0 && state === 'opening' && (
        <span
          key={flashKey}
          aria-hidden
          className="pokeball-flash pointer-events-none fixed left-1/2 top-1/2 z-40 h-64 w-64 rounded-full"
        />
      )}

      {/* Botón central de la pokéball */}
      <button
        type="button"
        onClick={openBall}
        data-state={state}
        aria-label="Abrir PokeHub"
        aria-expanded={expanded}
        className="pokeball-button fixed z-40 h-28 w-28 rounded-full md:h-32 md:w-32"
        style={{ left: '50%', top: '50vh' }}
      >
        <PokeballCore className="h-full w-full" pulsing={state === 'closed'} />
      </button>

      {/* Contenido */}
      <main
        className={`relative z-20 mx-auto flex min-h-dvh max-w-md items-center px-4 pb-16 pt-[120px] transition-all duration-700 ${
          contentVisible ? 'opacity-100 delay-300' : 'pointer-events-none translate-y-6 opacity-0'
        }`}
      >
        {contentVisible &&
          (mode === 'login' ? (
            <LoginForm onSwitch={() => setMode('register')} onClose={startOpen ? null : closeBall} />
          ) : (
            <RegisterForm onSwitch={() => setMode('login')} onClose={startOpen ? null : closeBall} />
          ))}
      </main>

      {state === 'closed' && (
        <p className="animate-fade-up fixed inset-x-0 bottom-[calc(50vh+5.5rem)] z-40 text-center text-sm font-semibold text-white/90">
          Toca la pokéball para empezar
        </p>
      )}
    </div>
  )
}

/* --------------------------------- Formularios --------------------------------- */

const initialState: AuthState = {}

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
}

function authErrorMessage(code: string, provider: string | null) {
  const name = PROVIDER_NAMES[provider ?? ''] ?? 'el proveedor'
  switch (code) {
    case 'provider_disabled':
      return `El acceso con ${name} no está habilitado en este proyecto de Supabase.`
    case 'oauth':
    case 'google':
      return `No se ha podido conectar con ${name}. Inténtalo de nuevo.`
    case 'access_denied':
      return `Has cancelado el acceso con ${name}.`
    default:
      return 'No se ha podido completar el acceso. Inténtalo de nuevo.'
  }
}

function Field({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <label className="relative block">
      <input
        {...props}
        className="h-12 w-full rounded-full border-2 border-line bg-surface-2 px-5 pr-12 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-brand"
      />
      <Icon
        size={19}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
      />
    </label>
  )
}

/** Campo de contraseña con el ojo para mostrarla u ocultarla. */
function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="relative block">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="h-12 w-full rounded-full border-2 border-line bg-surface-2 px-5 pr-12 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-brand"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Sin esto el navegador lo trataría como parte del <label> y al pulsarlo
        // devolvería el foco al input, cerrando el teclado en móvil.
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-line/60 hover:text-ink"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </label>
  )
}

function SubmitButton({ children, pending }: { children: React.ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5 disabled:opacity-70"
    >
      {pending && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
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
  const [pending, setPending] = useState(false)
  const Glyph = provider === 'google' ? GoogleGlyph : GitHubGlyph

  return (
    <form action={signInWithProvider} onSubmit={() => setPending(true)}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border-2 border-line bg-surface-2 text-[15px] font-semibold text-ink transition hover:bg-line/50 active:translate-y-0.5 disabled:opacity-70"
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : <Glyph />}
        {label}
      </button>
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
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">o</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

function Card({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: (() => void) | null
  children: React.ReactNode
}) {
  return (
    <div className="animate-fade-up w-full rounded-2xl border border-line bg-surface p-7 shadow-float md:p-9">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mx-auto -mt-2 mb-2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <ChevronUp size={14} /> Cerrar la pokéball
        </button>
      )}
      <h1 className="text-center text-3xl font-extrabold">{title}</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">{subtitle}</p>
      {children}
    </div>
  )
}

function Alert({ state }: { state: AuthState }) {
  if (!state.error && !state.notice) return null
  const isError = Boolean(state.error)
  return (
    <div
      role="alert"
      className={`rounded-xl border px-3 py-2 text-sm ${
        isError
          ? 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      <p>{state.error ?? state.notice}</p>
      {state.unconfirmedEmail && <ResendConfirmation email={state.unconfirmedEmail} />}
    </div>
  )
}

/**
 * Salida para el usuario que se ha registrado y no ha recibido (o ha perdido)
 * el correo de verificación. Sin esto la cuenta queda inutilizable.
 */
function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, initialState)

  if (state.notice) {
    return <p className="mt-1.5 text-xs font-semibold">{state.notice}</p>
  }

  return (
    <form action={action} className="mt-1.5">
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 disabled:opacity-60"
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        Reenviar correo de confirmación
      </button>
      {state.error && <p className="mt-1 text-xs">{state.error}</p>}
    </form>
  )
}

function LoginForm({ onSwitch, onClose }: { onSwitch: () => void; onClose: (() => void) | null }) {
  const [state, action, pending] = useActionState(signIn, initialState)
  const params = useSearchParams()
  const next = params.get('next') ?? '/home'
  const oauthError = params.get('error')

  const merged: AuthState = state.error
    ? state
    : oauthError
      ? { error: authErrorMessage(oauthError, params.get('provider')) }
      : state

  return (
    <Card title="Iniciar sesión" subtitle="Entra con tu usuario o tu email" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <OAuthButton provider="google" next={next} label="Continuar con Google" />
          <OAuthButton provider="github" next={next} label="Continuar con GitHub" />
        </div>
        <Divider />
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field icon={AtSign} name="identifier" placeholder="Usuario o email" autoComplete="username" required />
          <PasswordField name="password" placeholder="Contraseña" autoComplete="current-password" required />
          <Alert state={merged} />
          <SubmitButton pending={pending}>Entrar</SubmitButton>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-brand hover:underline">
          Regístrate
        </button>
      </p>
    </Card>
  )
}

function RegisterForm({ onSwitch, onClose }: { onSwitch: () => void; onClose: (() => void) | null }) {
  const [state, action, pending] = useActionState(signUp, initialState)

  return (
    <Card title="Crear cuenta" subtitle="Únete a la comunidad de entrenadores" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <OAuthButton provider="google" next="/home" label="Registrarme con Google" />
          <OAuthButton provider="github" next="/home" label="Registrarme con GitHub" />
        </div>
        <Divider />
        <form action={action} className="flex flex-col gap-4">
          <Field icon={User} name="username" placeholder="Nombre de usuario" autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" />
          <Field icon={Mail} name="email" type="email" placeholder="Email" autoComplete="email" required />
          <PasswordField name="password" placeholder="Contraseña (mín. 8)" autoComplete="new-password" required minLength={8} />
          <Alert state={state} />
          <SubmitButton pending={pending}>Registrarme</SubmitButton>
        </form>
      </div>

      <p className="mt-5 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="font-semibold text-brand hover:underline">
          Inicia sesión
        </button>
      </p>
      <p className="mt-4 text-center text-xs text-muted">
        Al registrarte aceptas las{' '}
        <Link href="/legal" className="underline">
          condiciones de uso
        </Link>
        .
      </p>
    </Card>
  )
}
