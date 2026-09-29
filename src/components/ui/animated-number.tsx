'use client'

import { useLayoutEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import clsx from 'clsx'

const compactFormat = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 })
const plainFormat = new Intl.NumberFormat('es', { maximumFractionDigits: 1 })

function format(n: number, compact: boolean) {
  return (compact ? compactFormat : plainFormat).format(n)
}

/**
 * Número que se interpola al cambiar. El servidor pinta ya el valor final (sin
 * desajustes al hidratar) y la animación escribe en el DOM directamente, sin
 * re-renderizar React en cada frame.
 */
export function AnimatedNumber({
  value,
  compact = true,
  countUp = false,
  className,
}: {
  value: number
  /** Notación compacta en español: 1,2 mil · 3,4 M. */
  compact?: boolean
  /** Tras montarse, cuenta desde 0 (cuando el número entra en pantalla). */
  countUp?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Lo que se ve ahora mismo; null hasta el primer efecto.
  const shown = useRef<number | null>(null)
  // Si la cuenta desde 0 ya arrancó. Aparte de `shown` para que el doble
  // efecto de StrictMode no se la salte.
  const started = useRef(false)
  const reduceMotion = useReducedMotion()

  // Layout effect: React ya ha escrito el valor final y hay que sustituirlo por
  // el de partida antes de que el navegador pinte, o se vería un parpadeo.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const integer = Number.isInteger(value)
    const paint = (n: number) => {
      shown.current = n
      node.textContent = format(integer ? Math.round(n) : n, compact)
    }

    if (shown.current === null && (!countUp || reduceMotion)) {
      shown.current = value
      started.current = true
      return
    }
    const from = shown.current ?? 0
    if (reduceMotion || from === value) {
      paint(value)
      started.current = true
      return
    }

    paint(from)
    const initialCount = !started.current
    let controls: { stop: () => void } | undefined
    const run = () => {
      started.current = true
      controls = animate(from, value, {
        duration: initialCount ? 1.2 : 0.6,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: paint,
      })
    }

    // Contar desde cero fuera de pantalla es una animación que nadie ve.
    if (initialCount && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          observer.disconnect()
          run()
        },
        { threshold: 0.35 },
      )
      observer.observe(node)
      return () => {
        observer.disconnect()
        controls?.stop()
      }
    }

    run()
    return () => controls?.stop()
  }, [value, compact, countUp, reduceMotion])

  return (
    <span ref={ref} className={clsx('tabular-nums', className)}>
      {format(value, compact)}
    </span>
  )
}
