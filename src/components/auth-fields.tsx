'use client'

import {
  startTransition, useActionState, useEffect, useId, useRef, useState,
} from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, MailCheck } from 'lucide-react'
import clsx from 'clsx'
import type { AuthField, AuthState } from '@/app/(auth)/actions'

/* ---------------------------------------------------------------------------
   Estado y validación de un formulario de acceso
   --------------------------------------------------------------------------- */

export type FieldErrors = Partial<Record<AuthField, string>>

/**
 * Une la Server Action con la validación de cliente. El envío se hace a mano
 * (preventDefault + startTransition) por dos motivos: sólo sale si los campos
 * son válidos, y React no vacía el formulario al volver, así que un error de
 * contraseña no obliga a reescribir también el usuario. `action` se queda en el
 * <form> para que siga funcionando sin JavaScript.
 */
export function useAuthForm(
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>,
  validate: (data: FormData) => FieldErrors,
) {
  const [state, dispatch, pending] = useActionState(action, {})
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  // Campos tocados desde el último envío: su error de servidor ya no aplica.
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set())
  const [attempted, setAttempted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Un error del servidor en un campo concreto se lleva el foco, igual que uno de cliente.
  useEffect(() => {
    const first = state.fieldErrors && Object.keys(state.fieldErrors)[0]
    if (first) focusField(formRef.current, first)
  }, [state])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const form = e.currentTarget
    const data = new FormData(form)
    const errors = validate(data)
    setAttempted(true)
    setClientErrors(errors)
    setEdited(new Set())

    const first = Object.keys(errors)[0]
    if (first) {
      focusField(form, first)
      return
    }
    startTransition(() => dispatch(data))
  }

  // Tras el primer intento se revalida al escribir, para que el error se vaya
  // en cuanto se corrige. Antes no: nadie quiere que le riñan a medio teclear.
  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name
    if (!name) return
    setEdited((prev) => (prev.has(name) ? prev : new Set(prev).add(name)))
    if (attempted) setClientErrors(validate(new FormData(e.currentTarget)))
  }

  function errorFor(field: AuthField): string | undefined {
    return clientErrors[field] ?? (edited.has(field) ? undefined : state.fieldErrors?.[field])
  }

  return {
    state,
    pending,
    errorFor,
    formProps: { ref: formRef, action: dispatch, onSubmit, onChange, noValidate: true },
  }
}

function focusField(form: HTMLFormElement | null, name: string) {
  const el = form?.elements.namedItem(name)
  if (el instanceof HTMLElement) el.focus()
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/* ---------------------------------------------------------------------------
   Campos
   --------------------------------------------------------------------------- */

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'>

export function TextField({
  name,
  label,
  icon: Icon,
  error,
  hint,
  hintLive = false,
  labelAside,
  trailing,
  describedBy,
  className,
  ...props
}: InputProps & {
  name: AuthField
  label: string
  icon?: React.ElementType
  error?: string
  /** Texto bajo el campo cuando no hay error (ayuda o estado). */
  hint?: React.ReactNode
  /** Anuncia los cambios de `hint` (comprobaciones en vivo). */
  hintLive?: boolean
  /** Algo a la derecha de la etiqueta, como el enlace de "¿Has olvidado…?". */
  labelAside?: React.ReactNode
  /** Botón o icono dentro del campo, a la derecha. */
  trailing?: React.ReactNode
  /** Ids extra para aria-describedby (medidor de contraseña, avisos…). */
  describedBy?: string
}) {
  const id = useId()
  const messageId = `${id}-msg`
  const hasMessage = Boolean(error || hint)
  const describedByIds = clsx(hasMessage && messageId, describedBy) || undefined

  return (
    <div className={clsx('auth-field', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <label htmlFor={id} className="auth-label">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        {Icon && <Icon aria-hidden size={18} className="auth-input-icon" />}
        <input
          {...props}
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds}
          className={clsx('auth-input', Icon && 'auth-input-has-icon', trailing && 'auth-input-has-trailing')}
        />
        {trailing}
      </div>
      {/* Región siempre presente para que los lectores anuncien lo que cambie dentro. */}
      <div id={hasMessage ? messageId : undefined} aria-live={hintLive ? 'polite' : undefined}>
        {error ? (
          <p key={error} className="auth-field-error">
            <AlertCircle aria-hidden size={15} className="mt-px shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          hint && <div className="auth-field-hint">{hint}</div>
        )}
      </div>
    </div>
  )
}

/**
 * Campo de contraseña con el ojo para verla y aviso de Bloq Mayús, que es la
 * causa más tonta (y más común) de "contraseña incorrecta".
 */
export function PasswordField({
  onKeyUp,
  onKeyDown,
  onBlur,
  hint,
  ...props
}: Omit<React.ComponentProps<typeof TextField>, 'type' | 'trailing' | 'icon'>) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  function checkCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    // getModifierState no existe en algunos eventos sintéticos de autocompletado.
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'))
  }

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onKeyDown={(e) => {
        checkCaps(e)
        onKeyDown?.(e)
      }}
      onKeyUp={(e) => {
        checkCaps(e)
        onKeyUp?.(e)
      }}
      onBlur={(e) => {
        setCapsLock(false)
        onBlur?.(e)
      }}
      hint={
        capsLock ? (
          <span className="flex items-center gap-1.5 text-warning">
            <Info aria-hidden size={14} className="shrink-0" />
            Tienes activado Bloq Mayús.
          </span>
        ) : (
          hint
        )
      }
      hintLive
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Pulsar el ojo no debe robar el foco al campo: en móvil cerraría el teclado.
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Mostrar contraseña"
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="auth-input-trailing"
        >
          {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
        </button>
      }
    />
  )
}

/* ---------------------------------------------------------------------------
   Fortaleza de la contraseña
   --------------------------------------------------------------------------- */

// Lo primero que se prueba en cualquier ataque de diccionario, más lo que
// cualquiera escribiría en una web de Pokémon.
const COMMON = [
  'password', 'contraseña', 'contrasena', 'qwerty', 'asdf', 'abc123', 'iloveyou', 'admin',
  'welcome', 'letmein', 'monkey', 'dragon', 'football', 'futbol', 'teamo', 'hola',
  'pokemon', 'pokehub', 'pikachu', 'charizard', 'mewtwo', 'eevee', 'ashketchum', 'masterball',
]

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']

function hasSequence(pw: string) {
  const lower = pw.toLowerCase()
  return SEQUENCES.some((seq) => {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const run = seq.slice(i, i + 4)
      if (lower.includes(run) || lower.includes([...run].reverse().join(''))) return true
    }
    return false
  })
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tip?: string }

/**
 * Estimación rápida y local: longitud y variedad suman; patrones previsibles
 * (palabras comunes, secuencias, repetir un carácter, contener tu usuario)
 * restan. No pretende ser zxcvbn, sólo orientar sin añadir dependencias.
 */
export function passwordStrength(pw: string, personal: string[] = []): Strength {
  if (!pw) return { score: 0, label: '' }
  if (pw.length < 8) {
    return { score: 1, label: 'Demasiado corta', tip: `Faltan ${8 - pw.length} caracteres para el mínimo de 8.` }
  }

  const lower = pw.toLowerCase()
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length
  if (/^(.)\1+$/.test(pw) || COMMON.some((w) => lower.includes(w) && pw.length < w.length + 4)) {
    return { score: 1, label: 'Muy fácil de adivinar', tip: 'Evita palabras típicas y caracteres repetidos.' }
  }

  let points = 1
  if (pw.length >= 12) points++
  if (pw.length >= 16) points++
  if (variety >= 3) points++
  if (variety === 4) points++
  if (hasSequence(pw)) points--
  const personalHit = personal.some((p) => p.length >= 3 && lower.includes(p.toLowerCase()))
  if (personalHit) points--

  const score = Math.max(1, Math.min(4, points)) as Strength['score']
  const label = ['', 'Débil', 'Aceptable', 'Buena', 'Muy segura'][score]
  const tip = personalHit
    ? 'No uses tu nombre de usuario ni tu email.'
    : score >= 3
      ? undefined
      : pw.length < 12
        ? 'Con 12 caracteres o más será mucho más difícil de adivinar.'
        : 'Mezcla mayúsculas, números y símbolos.'
  return { score, label, tip }
}

export function PasswordStrength({
  id,
  password,
  personal,
}: {
  id: string
  password: string
  personal?: string[]
}) {
  const { score, label, tip } = passwordStrength(password, personal)
  if (score === 0) return <div id={id} hidden />

  return (
    <div id={id} className="auth-strength mt-2 px-1" data-score={score}>
      <div aria-hidden className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="auth-strength-bar" data-on={i <= score || undefined} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {/* Sólo el nivel se anuncia: el consejo cambia a cada tecla y sería ruido. */}
        <span aria-live="polite">
          Seguridad: <span className="auth-strength-label font-semibold">{label}</span>.
        </span>
        {tip && <span> {tip}</span>}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Botones, avisos y tarjeta
   --------------------------------------------------------------------------- */

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean
  pendingLabel: string
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      // aria-disabled y no disabled: un botón deshabilitado suelta el foco y el
      // lector deja de saber dónde está. El doble envío lo frena useAuthForm.
      aria-disabled={pending || undefined}
      className="btn btn-primary btn-lg shine mt-1 w-full"
    >
      {pending && <Loader2 aria-hidden size={18} className="animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  )
}

export type AlertTone = 'error' | 'success' | 'info'

const ALERT_ICON = { error: AlertCircle, success: CheckCircle2, info: Info } as const

export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: AlertTone
  children: React.ReactNode
  className?: string
}) {
  const Icon = ALERT_ICON[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('auth-alert animate-fade-in', className)}
      data-tone={tone}
    >
      <Icon aria-hidden size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Cabecera de tarjeta: icono opcional, título enfocable y subtítulo. */
export function AuthHeading({
  icon: Icon,
  tone = 'brand',
  title,
  subtitle,
  headingRef,
}: {
  icon?: React.ElementType
  tone?: 'brand' | 'success' | 'warning'
  title: string
  subtitle?: React.ReactNode
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  return (
    <div className="mb-6 text-center">
      {Icon && (
        <span className="auth-badge animate-bounce-in" data-tone={tone}>
          <Icon aria-hidden size={26} strokeWidth={2.2} />
        </span>
      )}
      {/* tabIndex -1: recibe el foco al abrir la pokéball o cambiar de paso. */}
      <h1 ref={headingRef} tabIndex={-1} className="auth-title">
        {title}
      </h1>
      {subtitle && <p className="mx-auto mt-1.5 max-w-sm text-pretty text-sm text-muted">{subtitle}</p>}
    </div>
  )
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-line" />
      <span className="text-xs font-semibold text-muted">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  )
}

/**
 * Paso de "revisa tu correo" (registro con confirmación y recuperación). Va en
 * lugar del formulario: con el aviso encima del formulario la gente volvía a
 * pulsar el botón pensando que no había funcionado.
 */
export function EmailSentPanel({
  title,
  headingRef,
  children,
  tips,
  actions,
}: {
  title: string
  headingRef?: React.Ref<HTMLHeadingElement>
  children: React.ReactNode
  tips: string[]
  actions: React.ReactNode
}) {
  return (
    <div className="animate-fade-in">
      <AuthHeading icon={MailCheck} tone="success" title={title} subtitle={children} headingRef={headingRef} />
      <ul className="auth-tips">
        {tips.map((tip) => (
          <li key={tip} className="flex gap-2">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" />
            {tip}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2.5">{actions}</div>
    </div>
  )
}
