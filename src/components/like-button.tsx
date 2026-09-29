'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import clsx from 'clsx'
import { toggleLike } from '@/app/actions/social'
import { HeartBurst } from '@/components/heart-burst'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { toast } from '@/components/ui/toast'

type LikeState = { liked: boolean; count: number }

/**
 * Estado de "me gusta" de un equipo con actualización optimista.
 *
 * No usa useOptimistic a propósito: las tarjetas que carga el scroll infinito
 * no reciben props nuevas del servidor al revalidar, y useOptimistic volvería
 * al valor de las props en cuanto acabase la acción. Aquí manda el estado
 * local, que adopta las props frescas sólo cuando no hay nada pendiente.
 *
 * Los clics rápidos se serializan: si el usuario cambia de idea mientras una
 * petición está en vuelo, al terminar se envía lo que quiera en ese momento.
 */
export function useLike(teamId: string, liked: boolean, count: number) {
  const [state, setState] = useState<LikeState>({ liked, count })
  const [source, setSource] = useState<LikeState>({ liked, count })
  const [busy, setBusy] = useState(false)
  // Sube en cada nuevo "me gusta": dispara el latido y el confeti.
  const [burst, setBurst] = useState(0)

  // Ajuste de estado durante el render (patrón recomendado por React) cuando
  // el servidor manda valores distintos, p. ej. tras revalidar /home.
  if (!busy && (source.liked !== liked || source.count !== count)) {
    setSource({ liked, count })
    setState({ liked, count })
  }

  // Lo último que el servidor ha confirmado, y lo que el usuario quiere ahora.
  const confirmed = useRef(state)
  const wanted = useRef<boolean | null>(null)
  const running = useRef(false)

  useEffect(() => {
    if (!busy) confirmed.current = state
  }, [busy, state])

  async function sync() {
    running.current = true
    setBusy(true)
    while (wanted.current !== null && wanted.current !== confirmed.current.liked) {
      const next = wanted.current
      const before = confirmed.current
      let failed: boolean
      try {
        const result = await toggleLike(teamId, before.liked)
        failed = Boolean(result.error)
      } catch {
        failed = true
      }
      if (failed) {
        wanted.current = null
        setState(before)
        toast(next ? 'No se pudo dar el me gusta' : 'No se pudo quitar el me gusta', {
          tone: 'error',
          description: 'Comprueba tu conexión e inténtalo de nuevo.',
        })
        break
      }
      confirmed.current = { liked: next, count: Math.max(0, before.count + (next ? 1 : -1)) }
    }
    wanted.current = null
    running.current = false
    setBusy(false)
  }

  function setLiked(next: boolean) {
    if (next === state.liked) return
    setState((s) => ({ liked: next, count: Math.max(0, s.count + (next ? 1 : -1)) }))
    if (next) setBurst((b) => b + 1)
    wanted.current = next
    if (!running.current) void sync()
  }

  return {
    liked: state.liked,
    count: state.count,
    burst,
    toggle: () => setLiked(!state.liked),
    /** Sólo da "me gusta", nunca lo quita (doble toque en la tarjeta). */
    like: () => setLiked(true),
  }
}

/** Corazón que late al activarse, con confeti. Presentacional: el estado lo lleva useLike. */
export function LikeHeart({ liked, burst, size = 18 }: { liked: boolean; burst: number; size?: number }) {
  return (
    <span className="relative grid place-items-center">
      <Heart
        // Cambiar la key vuelve a montar el icono y repite el latido.
        key={burst}
        size={size}
        aria-hidden
        fill={liked ? 'currentColor' : 'none'}
        className={clsx('transition-colors duration-(--dur)', burst > 0 && 'animate-pop')}
      />
      <HeartBurst trigger={burst} />
    </span>
  )
}

export function LikeButton({
  teamId,
  liked,
  count,
}: {
  teamId: string
  liked: boolean
  count: number
}) {
  const like = useLike(teamId, liked, count)

  return (
    <button
      type="button"
      onClick={like.toggle}
      aria-pressed={like.liked}
      aria-label={`Me gusta (${like.count})`}
      title={like.liked ? 'Quitar me gusta' : 'Me gusta'}
      className={clsx(
        'btn gap-2 px-4',
        like.liked ? 'bg-brand-soft text-brand shadow-card' : 'btn-soft',
      )}
    >
      <LikeHeart liked={like.liked} burst={like.burst} size={17} />
      <AnimatedNumber value={like.count} />
    </button>
  )
}
