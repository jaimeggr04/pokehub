'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import clsx from 'clsx'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastOptions = {
  tone?: ToastTone
  description?: string
  /** Milisegundos. `Infinity` lo deja fijo hasta que se cierre a mano. */
  duration?: number
}

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
  description?: string
  duration: number
}

type ToastEvent = { type: 'add'; toast: ToastItem } | { type: 'dismiss'; id?: number }

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 3200

// Bus de eventos a nivel de módulo: toast() se puede llamar desde cualquier
// código de cliente (acciones, handlers, efectos) sin contexto ni props.
let nextId = 0
const listeners = new Set<(event: ToastEvent) => void>()
// Avisos lanzados antes de que el Toaster se monte (p. ej. en el primer efecto de una página).
const queue: ToastEvent[] = []

function emit(event: ToastEvent) {
  if (listeners.size === 0) {
    queue.push(event)
    return
  }
  listeners.forEach((listener) => listener(event))
}

/** Muestra un aviso breve. Devuelve su id por si hay que cerrarlo antes. */
export function toast(message: string, opts: ToastOptions = {}): number {
  if (typeof window === 'undefined') return -1
  const id = ++nextId
  emit({
    type: 'add',
    toast: {
      id,
      message,
      tone: opts.tone ?? 'info',
      description: opts.description,
      duration: opts.duration ?? DEFAULT_DURATION,
    },
  })
  return id
}

/** Cierra un aviso concreto, o todos si no se pasa id. */
export function dismissToast(id?: number) {
  if (typeof window === 'undefined') return
  emit({ type: 'dismiss', id })
}

// En tema claro la marca es roja: un aviso informativo en rojo se leería como
// error, así que ahí va neutro y sólo en oscuro toma el morado de marca.
const TONES = {
  success: { icon: CheckCircle2, chip: 'bg-success-soft text-success', bar: 'bg-success' },
  error: { icon: AlertCircle, chip: 'bg-danger-soft text-danger', bar: 'bg-danger' },
  info: {
    icon: Info,
    chip: 'bg-surface text-ink dark:bg-brand-soft dark:text-brand',
    bar: 'bg-muted dark:bg-brand',
  },
} as const

/** Pila de avisos. Ya está montada en el layout raíz (providers.tsx): no volver a montarla. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    function handle(event: ToastEvent) {
      if (event.type === 'add') {
        // El más reciente arriba; el más antiguo sale cuando ya hay tres.
        setItems((prev) => [event.toast, ...prev].slice(0, MAX_VISIBLE))
      } else {
        setItems((prev) => (event.id === undefined ? [] : prev.filter((t) => t.id !== event.id)))
      }
    }
    listeners.add(handle)
    queue.splice(0).forEach(handle)
    return () => {
      listeners.delete(handle)
    }
  }, [])

  // Con la pestaña en segundo plano nadie los está leyendo: se congelan.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Si el aviso bajo el cursor desaparece, el navegador no emite pointerleave:
  // sin esto los temporizadores del resto quedarían pausados para siempre.
  useEffect(() => {
    if (items.length === 0) {
      setHovered(false)
      setFocused(false)
    }
  }, [items.length])

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const paused = hovered || focused || hidden

  return (
    <section
      aria-label="Notificaciones"
      className="ph-toaster pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-3 md:inset-x-auto md:right-5 md:px-0"
    >
      <ol className="relative flex w-full max-w-[420px] flex-col gap-2 md:w-[360px]">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <ToastCard
              key={item.id}
              item={item}
              paused={paused}
              onDismiss={remove}
              onHoverChange={setHovered}
              onFocusChange={setFocused}
            />
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
}

function ToastCard({
  item,
  paused,
  onDismiss,
  onHoverChange,
  onFocusChange,
}: {
  item: ToastItem
  paused: boolean
  onDismiss: (id: number) => void
  onHoverChange: (hovered: boolean) => void
  onFocusChange: (focused: boolean) => void
}) {
  const { icon: Icon, chip, bar } = TONES[item.tone]
  const timed = Number.isFinite(item.duration)
  const remaining = useRef(item.duration)

  const x = useMotionValue(0)
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0])

  // Temporizador reanudable: al pausar se descuenta lo ya transcurrido.
  useEffect(() => {
    if (paused || !timed) return
    const start = Date.now()
    const timer = setTimeout(() => onDismiss(item.id), Math.max(remaining.current, 0))
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - start
    }
  }, [paused, timed, item.id, onDismiss])

  const isError = item.tone === 'error'

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.9 }}
      className="pointer-events-auto"
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
    >
      <motion.div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        aria-atomic="true"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        style={{ x, opacity }}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info
          if (Math.abs(offset.x) < 90 && Math.abs(velocity.x) < 600) return
          // Termina el gesto en la dirección del dedo y luego lo retira.
          const direction = Math.sign(offset.x || velocity.x) || 1
          animate(x, direction * 480, { duration: 0.22, ease: 'easeOut' }).then(() => onDismiss(item.id))
        }}
        className="relative flex cursor-grab items-start gap-3 overflow-hidden rounded-2xl border border-line bg-bg-elevated py-3 pl-3 pr-2 text-ink shadow-float active:cursor-grabbing"
      >
        <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full', chip)}>
          <Icon size={18} strokeWidth={2.2} aria-hidden />
        </span>

        <div className="min-w-0 flex-1 py-1">
          <p className="text-sm font-semibold leading-snug">{item.message}</p>
          {item.description && <p className="mt-0.5 text-xs leading-snug text-muted">{item.description}</p>}
        </div>

        <button
          type="button"
          onClick={() => {
            onHoverChange(false)
            onDismiss(item.id)
          }}
          aria-label="Cerrar aviso"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <X size={16} aria-hidden />
        </button>

        {timed && (
          // Tiempo restante; se congela a la vez que el temporizador.
          <span
            aria-hidden
            className={clsx('absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-70 motion-reduce:hidden', bar)}
            style={{
              animation: `ph-progress ${item.duration}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        )}
      </motion.div>
    </motion.li>
  )
}
