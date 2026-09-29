'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

/**
 * Descripción del equipo tal como la escribió su autor (respeta los saltos de
 * línea). Si pasa de unas pocas líneas se pliega con «Leer más»: con 1000
 * caracteres en un móvil, las fichas quedarían a dos pantallas de distancia.
 * El texto entero está siempre en el DOM; el recorte es sólo visual.
 */
export function TeamDescription({ text, className }: { text: string; className?: string }) {
  const reduceMotion = useReducedMotion()
  const id = useId()
  const ref = useRef<HTMLParagraphElement>(null)
  const previousHeight = useRef<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  // Sólo se sabe si el texto se corta después de pintarlo, y cambia con el ancho.
  useEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [expanded, text])

  // Transición de la altura real entre plegado y desplegado.
  useLayoutEffect(() => {
    const el = ref.current
    const from = previousHeight.current
    previousHeight.current = null
    if (!el || from === null || reduceMotion) return
    const to = el.offsetHeight
    if (Math.abs(from - to) < 2) return
    el.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }], {
      duration: 380,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
    })
  }, [expanded, reduceMotion])

  function toggle() {
    previousHeight.current = ref.current?.offsetHeight ?? null
    setExpanded((value) => !value)
  }

  return (
    <div className={clsx('min-w-0', className)}>
      <p
        id={id}
        ref={ref}
        className={clsx(
          'max-w-[75ch] whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-6 md:line-clamp-4',
        )}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={id}
          className="-ml-2 mt-1 inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
        >
          {expanded ? 'Leer menos' : 'Leer más'}
          <ChevronDown
            size={16}
            aria-hidden
            className={clsx('transition-transform duration-(--dur) ease-(--ease-out-expo)', expanded && 'rotate-180')}
          />
        </button>
      )}
    </div>
  )
}
