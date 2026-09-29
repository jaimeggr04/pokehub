'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import { Logo } from '@/components/logo'
import { PokeballCore } from '@/components/pokeball'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm, RegisterForm, type AuthParams } from '@/components/auth-forms'

export type AuthMode = 'login' | 'register'

/** closed -> shaking -> opening -> open -> closing -> closed */
type BallState = 'closed' | 'shaking' | 'opening' | 'open' | 'closing'

// Deben coincidir con las duraciones de .pokeball-half y .pokeball-button (globals.css).
const SHAKE_MS = 900
const OPEN_MS = 850
const CLOSE_MS = 600

const MODE_PATH: Record<AuthMode, string> = { login: '/login', register: '/register' }
const MODE_TITLE: Record<AuthMode, string> = {
  login: 'Iniciar sesión · PokeHub',
  register: 'Crear cuenta · PokeHub',
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Portada, login y registro. La pantalla entera es una pokéball: la cabecera es
 * la mitad superior, el pie la inferior y el botón central la abre. Cerrada
 * muestra el eslogan y la bienvenida; abierta, el formulario. /login y
 * /register la sirven ya abierta (`startOpen`).
 */
export function AuthScreen({
  mode: initialMode,
  startOpen,
  params = {},
}: {
  mode: AuthMode
  startOpen: boolean
  params?: AuthParams
}) {
  const [state, setState] = useState<BallState>(startOpen ? 'open' : 'closed')
  const [flashKey, setFlashKey] = useState(0)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const ballRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Adónde llevar el foco cuando acabe la animación: el botón que se pulsó
  // desaparece (o reaparece) y el foco no puede quedarse en el aire.
  const focusAfter = useRef<'heading' | 'ball' | null>(null)

  // Nunca dejar temporizadores vivos si el usuario navega a mitad de animación.
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (state === 'open' && focusAfter.current === 'heading') headingRef.current?.focus()
    if (state === 'closed' && focusAfter.current === 'ball') ballRef.current?.focus()
    if (state === 'open' || state === 'closed') focusAfter.current = null
  }, [state])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }, [])

  const openBall = useCallback(
    (nextMode?: AuthMode) => {
      if (state !== 'closed') return
      if (nextMode) setMode(nextMode)
      focusAfter.current = 'heading'
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
    },
    [state, schedule],
  )

  const closeBall = useCallback(() => {
    if (state !== 'open') return
    focusAfter.current = 'ball'
    if (prefersReducedMotion()) {
      setState('closed')
      return
    }
    setState('closing')
    schedule(() => setState('closed'), CLOSE_MS)
  }, [state, schedule])

  function switchMode(next: AuthMode) {
    if (next === mode) return
    setMode(next)
    // En /login y /register la URL acompaña al formulario: recargar o compartir
    // el enlace abre el mismo. En la portada se queda en "/".
    if (startOpen) {
      const url = next === 'login' && params.next ? `/login?next=${encodeURIComponent(params.next)}` : MODE_PATH[next]
      window.history.replaceState(null, '', url)
      document.title = MODE_TITLE[next]
    }
  }

  // `expanded` gobierna la altura de las mitades; durante `closing` ya vuelven a
  // la posición cerrada, por eso sólo es cierto en opening/open.
  const expanded = state === 'opening' || state === 'open'

  return (
    <BallFrame
      state={state}
      logoHref={startOpen ? '/' : null}
      hero={state !== 'open' && <Hero />}
      welcome={state !== 'open' && <Welcome onOpen={openBall} />}
      ball={
        !startOpen && (
          <>
            {/* Destello al abrirse la ranura */}
            {flashKey > 0 && state === 'opening' && (
              <span
                key={flashKey}
                aria-hidden
                className="pokeball-flash pointer-events-none fixed left-1/2 top-1/2 z-40 h-64 w-64 rounded-full"
              />
            )}
            <span aria-hidden data-state={state} className="auth-ball-halo" />
            <button
              ref={ballRef}
              type="button"
              onClick={() => openBall()}
              data-state={state}
              aria-label="Abrir la pokéball para entrar"
              aria-expanded={expanded}
              // Abierta, la bola no existe para el teclado ni para los lectores.
              inert={expanded}
              className="pokeball-button auth-ball"
            >
              <PokeballCore className="h-full w-full" pulsing={state === 'closed'} />
            </button>
          </>
        )
      }
    >
      {state === 'open' && (
        <>
          {!startOpen && (
            <button type="button" onClick={closeBall} className="auth-close">
              <ChevronUp aria-hidden size={14} strokeWidth={2.6} />
              Cerrar la pokéball
            </button>
          )}
          <ModeSwitch mode={mode} onChange={switchMode} />
          <div key={mode} className="animate-fade-in">
            {mode === 'login' ? (
              <LoginForm params={params} headingRef={headingRef} />
            ) : (
              <RegisterForm headingRef={headingRef} onGoToLogin={() => switchMode('login')} />
            )}
          </div>
        </>
      )}
    </BallFrame>
  )
}

/**
 * Marco de las páginas secundarias de acceso (recuperar la contraseña): la
 * misma pokéball, ya abierta y sin botón central.
 */
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <BallFrame state="open" logoHref="/">
      {children}
    </BallFrame>
  )
}

function BallFrame({
  state,
  logoHref,
  hero,
  welcome,
  ball,
  children,
}: {
  state: BallState
  logoHref: string | null
  hero?: React.ReactNode
  welcome?: React.ReactNode
  ball?: React.ReactNode
  children: React.ReactNode
}) {
  const expanded = state === 'opening' || state === 'open'
  const year = new Date().getFullYear()

  return (
    <div className="auth-screen" data-state={state}>
      {/* Mitad superior de la pokéball = cabecera */}
      <header
        data-state={state}
        data-expanded={expanded || undefined}
        className="pokeball-half auth-top shell-on-brand"
      >
        <MasterBallMarks />
        <div className="auth-bar">
          <span className="sm:hidden">
            <Logo href={logoHref} size="sm" />
          </span>
          <span className="hidden sm:block">
            <Logo href={logoHref} size="md" />
          </span>
          <ThemeToggle />
        </div>
        {hero}
      </header>

      {/* Mitad inferior = pie */}
      <div data-state={state} data-expanded={expanded || undefined} className="pokeball-half auth-bottom">
        {welcome}
        <footer className="auth-legal">
          <p className="truncate">
            <span className="font-semibold text-ink">© 2024–{year} PokeHub</span>
            <span className="hidden md:inline">
              {' · '}Pokémon y todos los nombres relacionados son marca registrada y © de Nintendo 1996–{year}.
            </span>
            <span className="md:hidden"> · Pokémon © Nintendo</span>
          </p>
        </footer>
      </div>

      {ball}

      <main className="auth-main">
        {state === 'open' && (
          <>
            <span aria-hidden className="auth-glow" />
            <section className="auth-card">{children}</section>
          </>
        )}
      </main>
    </div>
  )
}

/** Marcas de Master Ball: sólo tienen color en tema oscuro y con la bola cerrada. */
function MasterBallMarks() {
  return (
    <div aria-hidden className="auth-marks">
      <span className="auth-mark-dot" />
      <svg viewBox="0 0 40 30" className="auth-mark-m">
        <path
          d="M4 28 L9 4 L20 16 L31 4 L36 28"
          fill="none"
          stroke="var(--ball-mark-m)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="auth-mark-dot" />
    </div>
  )
}

function Hero() {
  return (
    <div className="auth-hero">
      <p className="auth-eyebrow">La red social de entrenadores Pokémon</p>
      <h1 className="auth-hero-title">
        Comparte tus equipos.{' '}
        <span className="auth-hero-accent">Domina el meta.</span>
      </h1>
    </div>
  )
}

function Welcome({ onOpen }: { onOpen: (mode?: AuthMode) => void }) {
  // Enlaces reales (funcionan sin JS y se pueden abrir aparte); con JS abren la
  // bola aquí mismo en el modo elegido.
  function open(e: React.MouseEvent, mode: AuthMode) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onOpen(mode)
  }

  return (
    <div className="auth-welcome">
      <p className="auth-hint">
        <ChevronUp aria-hidden size={16} strokeWidth={2.6} className="auth-hint-arrow" />
        Toca la pokéball para empezar
      </p>
      <h2 className="auth-welcome-title">¡Bienvenido, entrenador!</h2>
      <p className="auth-welcome-text">
        Monta tu equipo, descubre sus debilidades y compártelo con una comunidad que vive el
        competitivo.
      </p>
      <p className="auth-welcome-links">
        <Link href="/login" onClick={(e) => open(e, 'login')} className="auth-link">
          Iniciar sesión
        </Link>
        <span aria-hidden className="text-line">•</span>
        <Link href="/register" onClick={(e) => open(e, 'register')} className="auth-link">
          Crear cuenta
        </Link>
      </p>
    </div>
  )
}

/** Selector Entrar / Crear cuenta: una píldora que se desliza entre las dos. */
function ModeSwitch({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  const pillId = `auth-mode-${useId()}`
  const options: { value: AuthMode; label: string }[] = [
    { value: 'login', label: 'Iniciar sesión' },
    { value: 'register', label: 'Crear cuenta' },
  ]

  return (
    <div role="group" aria-label="Elige cómo entrar" className="auth-switch">
      {options.map(({ value, label }) => {
        const active = value === mode
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={clsx('auth-switch-option', active && 'is-active')}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                aria-hidden
                className="auth-switch-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
