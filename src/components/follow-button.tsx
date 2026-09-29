'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, UserMinus, UserPlus } from 'lucide-react'
import clsx from 'clsx'
import { toggleFollow } from '@/app/actions/social'
import { toast } from '@/components/ui/toast'

// Muelle del cambio de ancho entre "Seguir", "Siguiendo" y "Dejar de seguir".
const MORPH = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const

/**
 * Seguir / dejar de seguir con respuesta inmediata.
 *
 * Como en el "me gusta", manda el estado local y no useOptimistic: las filas de
 * sugerencias no siempre reciben props nuevas al revalidar. Las props frescas
 * se adoptan sólo cuando no hay nada en vuelo, y los clics rápidos se
 * serializan: al terminar una petición se envía lo que el usuario quiera en ese
 * momento, nunca dos a la vez.
 */
export function FollowButton({
  targetId,
  following,
  size = 'sm',
  username,
  onFollowingChange,
  className,
}: {
  targetId: string
  following: boolean
  size?: 'sm' | 'md'
  /** Para la etiqueta accesible: "Seguir a @ash". */
  username?: string
  /** Avisa en cuanto cambia (también al revertir un error), p. ej. para mover el contador de seguidores. */
  onFollowingChange?: (following: boolean) => void
  className?: string
}) {
  const [state, setState] = useState(following)
  const [source, setSource] = useState(following)
  const [busy, setBusy] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Recién seguido con el ratón encima: no se ofrece "Dejar de seguir" hasta
  // que el puntero salga, o el botón cambiaría de golpe bajo el propio clic.
  const [armed, setArmed] = useState(true)
  // Sube en cada nuevo seguimiento: repite el pop del check y la onda.
  const [celebrate, setCelebrate] = useState(0)
  // El pop dura lo que dura: si el check vuelve a montarse después (al quitar
  // el ratón de encima), no debe repetirlo.
  const [popping, setPopping] = useState(false)
  // La etiqueta sólo entra animada tras la primera interacción: en una lista
  // recién cargada, veinte botones haciendo lo mismo sería ruido.
  const [live, setLive] = useState(false)

  if (!busy && source !== following) {
    setSource(following)
    setState(following)
  }

  const confirmed = useRef(state)
  const wanted = useRef<boolean | null>(null)
  const running = useRef(false)
  const notify = useRef(onFollowingChange)

  useEffect(() => {
    notify.current = onFollowingChange
  })

  useEffect(() => {
    if (!busy) confirmed.current = state
  }, [busy, state])

  useEffect(() => {
    if (!popping) return
    const id = setTimeout(() => setPopping(false), 600)
    return () => clearTimeout(id)
  }, [popping, celebrate])

  async function sync() {
    running.current = true
    setBusy(true)
    while (wanted.current !== null && wanted.current !== confirmed.current) {
      const next = wanted.current
      const before = confirmed.current
      let error: string | null = null
      try {
        const result = await toggleFollow(targetId, before)
        if ('error' in result && result.error) error = result.error
      } catch {
        error = 'Comprueba tu conexión e inténtalo de nuevo.'
      }
      if (error !== null) {
        wanted.current = null
        setState(before)
        notify.current?.(before)
        const who = username ? ` a @${username}` : ''
        toast(next ? `No se pudo seguir${who}` : `No se pudo dejar de seguir${who}`, {
          tone: 'error',
          description: error,
        })
        break
      }
      confirmed.current = next
    }
    wanted.current = null
    running.current = false
    setBusy(false)
  }

  function toggle() {
    const next = !state
    setLive(true)
    setState(next)
    notify.current?.(next)
    if (next) {
      setArmed(false)
      setPopping(true)
      setCelebrate((n) => n + 1)
    }
    wanted.current = next
    if (!running.current) void sync()
  }

  const unfollowHint = state && hovered && armed
  const Icon = !state ? UserPlus : unfollowHint ? UserMinus : Check
  const label = !state ? 'Seguir' : unfollowHint ? 'Dejar de seguir' : 'Siguiendo'
  const who = username ? ` a @${username}` : ''

  return (
    <motion.button
      type="button"
      layout="size"
      transition={{ layout: MORPH }}
      onClick={toggle}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        setHovered(true)
        setLive(true)
      }}
      onPointerLeave={() => {
        setHovered(false)
        setArmed(true)
      }}
      aria-pressed={state}
      aria-label={`${state ? 'Siguiendo' : 'Seguir'}${who}`}
      data-state={state ? 'on' : 'off'}
      // Radio en estilo: motion lo corrige durante la animación de tamaño.
      style={{ borderRadius: 9999 }}
      className={clsx(
        'btn profile-follow relative shrink-0 border',
        size === 'sm' ? 'h-10 px-4 text-[13px] sm:h-9' : 'h-11 px-5',
        !state && 'btn-primary border-transparent',
        state && !unfollowHint && 'border-line bg-surface-2 text-ink shadow-card',
        unfollowHint && 'border-danger/35 bg-danger-soft text-danger',
        className,
      )}
    >
      <motion.span
        layout="position"
        className={clsx('relative inline-flex items-center', size === 'sm' ? 'gap-1.5' : 'gap-2')}
      >
        <Icon
          key={Icon === Check ? `check-${celebrate}` : label}
          size={size === 'sm' ? 15 : 17}
          strokeWidth={2.4}
          aria-hidden
          className={clsx('shrink-0', Icon === Check && 'text-success', Icon === Check && popping && 'animate-pop')}
        />
        <span key={label} className={clsx('whitespace-nowrap', live && 'profile-follow-label')}>
          {label}
        </span>
      </motion.span>

      {celebrate > 0 && state && (
        <span key={celebrate} aria-hidden className="profile-follow-burst">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} style={{ '--a': `${i * 60 + 30}deg` } as React.CSSProperties} />
          ))}
        </span>
      )}
    </motion.button>
  )
}
