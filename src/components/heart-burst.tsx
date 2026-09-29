'use client'

import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { TYPE_COLORS } from '@/lib/pokemon'

// Confeti con colores de tipo: la marca (roja o morada según el tema) y unos
// cuantos tipos alegres, para que el "me gusta" suene a Pokémon.
const PALETTE = [
  'var(--brand)',
  TYPE_COLORS.electric.bg,
  TYPE_COLORS.water.bg,
  TYPE_COLORS.fairy.bg,
  TYPE_COLORS.grass.bg,
  TYPE_COLORS.fire.bg,
]

const SIZES = {
  sm: { count: 8, distance: 20, dot: 5 },
  lg: { count: 14, distance: 74, dot: 10 },
} as const

type BurstSize = keyof typeof SIZES

/**
 * Explosión de partículas alrededor de un punto. Cada vez que `trigger` cambia
 * (y es mayor que 0) se vuelve a montar y reproduce; al terminar se desmonta.
 * El contenedor debe tener `position: relative`: la ráfaga se centra en él.
 */
export function HeartBurst({
  trigger,
  size = 'sm',
  className,
}: {
  trigger: number
  size?: BurstSize
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  if (trigger <= 0 || reduceMotion) return null
  return <Burst key={trigger} size={size} className={className} />
}

function Burst({ size, className }: { size: BurstSize; className?: string }) {
  const [done, setDone] = useState(false)
  if (done) return null

  const { count, distance, dot } = SIZES[size]

  return (
    <span
      aria-hidden
      data-size={size}
      className={clsx('feed-burst', className)}
      onAnimationEnd={(e) => {
        // El aro es lo último en terminar.
        if (e.animationName === 'feed-burst-ring') setDone(true)
      }}
    >
      <span className="feed-burst-ring" style={{ '--ring': `${Math.round(distance * 1.5)}px` } as React.CSSProperties} />
      {Array.from({ length: count }, (_, i) => {
        // Reparto regular con dos radios alternos: parece aleatorio sin serlo,
        // así que servidor y cliente nunca discrepan.
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.18 : 0)
        const reach = distance * (i % 2 ? 0.7 : 1)
        return (
          <span
            key={i}
            className="feed-burst-dot"
            style={
              {
                '--dx': `${(Math.cos(angle) * reach).toFixed(1)}px`,
                '--dy': `${(Math.sin(angle) * reach).toFixed(1)}px`,
                '--dot': `${i % 3 === 2 ? dot * 0.7 : dot}px`,
                '--c': PALETTE[i % PALETTE.length],
                '--delay': `${(i % 3) * 18}ms`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}

/**
 * Corazón grande que aparece en mitad de una tarjeta al darle me gusta con un
 * doble toque, al estilo de Instagram. Mismo mecanismo de `trigger`.
 */
export function BigHeart({ trigger }: { trigger: number }) {
  const reduceMotion = useReducedMotion()
  if (trigger <= 0 || reduceMotion) return null
  return <BigHeartPop key={trigger} />
}

function BigHeartPop() {
  const [done, setDone] = useState(false)
  if (done) return null

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <span
        className="feed-big-heart-wrap relative grid place-items-center"
        onAnimationEnd={(e) => {
          if (e.animationName === 'feed-big-heart') setDone(true)
        }}
      >
        <span className="feed-big-heart block size-24 sm:size-28" />
        <HeartBurst trigger={1} size="lg" />
      </span>
    </span>
  )
}
