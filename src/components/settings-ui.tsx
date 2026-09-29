'use client'

import { useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'

/** Lo que devuelven las Server Actions de perfil y cuenta. */
export type ActionResult = { error?: string; success?: string }

/**
 * Aviso flotante con el resultado de una acción. El mensaje en línea se queda
 * en la tarjeta; el toast es el que se anuncia a los lectores de pantalla.
 * `success` sustituye al texto del servidor por un título más corto.
 */
export function notifyResult(result: ActionResult, success?: { title: string; description?: string }) {
  if (result.error) toast(result.error, { tone: 'error' })
  else if (result.success) {
    toast(success?.title ?? result.success, { tone: 'success', description: success?.description })
  }
}

/* --------------------------------- Estructura --------------------------------- */

export function SettingsSection({
  id,
  index,
  icon,
  title,
  description,
  danger = false,
  children,
}: {
  id: string
  /** Orden de entrada escalonada. */
  index: number
  icon: React.ReactNode
  title: string
  description: string
  danger?: boolean
  children: React.ReactNode
}) {
  const titleId = `${id}-titulo`

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      style={{ '--i': index } as React.CSSProperties}
      className={clsx(
        'settings-section card stagger-item relative scroll-mt-12 p-5 sm:p-6 md:scroll-mt-4',
        danger && 'settings-danger',
      )}
    >
      <header className="mb-5 flex items-start gap-3.5">
        <span
          aria-hidden
          className={clsx(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            danger ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 id={titleId} className="text-lg font-bold leading-tight">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

/** Subapartado dentro de una tarjeta (Email, Contraseña…). */
export function SubSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <div role="group" aria-labelledby={titleId} className={className}>
      <h3 id={titleId} className="text-[15px] font-bold leading-tight">
        {title}
      </h3>
      {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

/**
 * Resultado en línea de la última acción. Sin rol de región viva: el toast ya
 * lo anuncia y así no se lee dos veces. Quien lo usa le pasa como key el
 * número de envío, para que la entrada se repita aunque el texto sea el mismo.
 */
export function InlineFeedback({ state }: { state: ActionResult }) {
  if (!state.error && !state.success) return null
  const isError = Boolean(state.error)
  const Icon = isError ? CircleAlert : CircleCheck

  return (
    <p
      className={clsx(
        'flex animate-scale-in items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium',
        isError ? 'extras-ink-danger bg-danger-soft' : 'extras-ink-success bg-success-soft',
      )}
    >
      <Icon aria-hidden size={17} className="mt-px shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{state.error ?? state.success}</span>
    </p>
  )
}

/* ---------------------------------- Campos ---------------------------------- */

export const INPUT_CLASS =
  'block h-11 w-full min-w-0 rounded-xl border border-line bg-surface-2 px-3.5 text-[15px] text-ink shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-[border-color,background-color] duration-200 placeholder:text-muted/70 hover:border-muted/60 focus:border-brand disabled:opacity-60 aria-[invalid=true]:border-danger sm:text-sm'

/** Contador de caracteres. Se asocia al campo con aria-describedby, sin anunciarse a cada tecla. */
export function CharCounter({ id, length, max }: { id: string; length: number; max: number }) {
  const left = max - length
  return (
    <span
      id={id}
      className={clsx(
        'shrink-0 text-xs font-medium tabular-nums transition-colors',
        left <= 0 ? 'text-danger' : left <= Math.ceil(max * 0.1) ? 'text-warning' : 'text-muted',
      )}
    >
      <span className="sr-only">Llevas </span>
      {length}/{max}
      <span className="sr-only"> caracteres</span>
    </span>
  )
}

// ComponentProps incluye `ref`: en React 19 llega como prop y el spread lo pasa al <input>.
type FieldProps = Omit<React.ComponentProps<'input'>, 'prefix'> & {
  label: string
  hint?: React.ReactNode
  /** Texto de error bajo el campo; también marca aria-invalid. */
  invalid?: string | null
  /** Límite visible de caracteres (usa value, así que el campo debe ser controlado). */
  counter?: number
  /** Adorno a la izquierda, dentro del campo (p. ej. "@"). */
  prefix?: string
}

export function Field({ label, hint, invalid, counter, prefix, className, ...props }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const counterId = `${id}-count`
  const length = typeof props.value === 'string' ? props.value.length : 0
  const describedBy = [hint || invalid ? hintId : null, counter ? counterId : null].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {counter && <CharCounter id={counterId} length={length} max={counter} />}
      </div>
      <div className="relative">
        {prefix && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted sm:text-sm"
          >
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={id}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={clsx(INPUT_CLASS, prefix && 'pl-8')}
        />
      </div>
      {(invalid || hint) && (
        <p
          id={hintId}
          className={clsx('mt-1.5 text-xs leading-relaxed', invalid ? 'extras-ink-danger font-medium' : 'text-muted')}
        >
          {invalid ?? hint}
        </p>
      )}
    </div>
  )
}

/** Igual que Field pero con el ojo para ver la contraseña. */
export function PasswordField({
  label,
  hint,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string }) {
  const id = useId()
  const hintId = `${id}-hint`
  const [visible, setVisible] = useState(false)

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-describedby={hint ? hintId : undefined}
          className={clsx(INPUT_CLASS, 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="btn btn-ghost btn-sm btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          {visible ? <EyeOff aria-hidden size={17} /> : <Eye aria-hidden size={17} />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/* --------------------------------- Botones --------------------------------- */

/** Botón de envío con su propio estado de carga (useFormStatus del <form> que lo contiene). */
export function SubmitButton({
  children,
  icon,
  pendingLabel,
  variant = 'primary',
  disabled,
  className,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  pendingLabel: string
  variant?: 'primary' | 'soft' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={clsx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'soft' && 'btn-soft',
        variant === 'danger' && 'settings-danger-solid',
        className,
      )}
    >
      {pending ? <Loader2 aria-hidden size={17} className="animate-spin" /> : icon}
      {pending ? pendingLabel : children}
    </button>
  )
}
