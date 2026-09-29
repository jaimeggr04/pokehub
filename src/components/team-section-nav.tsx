'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MessageCircle, PawPrint, Radar, Swords, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

export type TeamSectionItem = { id: string; label: string; count?: number }

// Los iconos se eligen aquí por id: un componente no puede viajar como prop
// desde la página, que es de servidor.
const ICONS: Record<string, LucideIcon> = {
  pokemon: PawPrint,
  analisis: Radar,
  showdown: Swords,
  comentarios: MessageCircle,
}

const PILL_SPRING = { type: 'spring', stiffness: 480, damping: 38 } as const
// Margen bajo la barra donde se considera que "empieza" una sección.
const LINE_GAP = 24

/**
 * Barra de secciones pegada bajo la cabecera. Resalta la sección visible con
 * IntersectionObserver (una línea horizontal justo debajo de la barra: la
 * sección que la cruza es la activa) y en escritorio se parte en dos para
 * dejar sitio a la pokéball de la cabecera, como la navegación principal.
 */
export function TeamSectionNav({ items }: { items: TeamSectionItem[] }) {
  const reduceMotion = useReducedMotion()
  const navRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [stuck, setStuck] = useState(false)
  // Mientras dura un desplazamiento pedido desde la barra, el observador no
  // manda: si no, la píldora pasaría por todas las secciones intermedias.
  const locked = useRef(false)
  const unlock = useRef<() => void>(() => {})
  const pillId = `team-nav-${useId()}`

  const ids = items.map((item) => item.id).join(' ')

  useEffect(() => {
    const nav = navRef.current
    const sections = ids
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (!nav || sections.length === 0 || typeof IntersectionObserver === 'undefined') return

    const first = sections[0]
    const last = sections[sections.length - 1]
    let observer: IntersectionObserver | null = null
    let bottomObserver: IntersectionObserver | null = null
    let frame = 0

    const build = () => {
      observer?.disconnect()
      bottomObserver?.disconnect()
      const line = Math.round(parseFloat(getComputedStyle(nav).top) + nav.offsetHeight + LINE_GAP)
      const below = Math.max(0, window.innerHeight - line - 1)

      observer = new IntersectionObserver(
        (entries) => {
          if (locked.current) return
          for (const entry of entries) {
            if (entry.isIntersecting) setActive(entry.target.id)
            // Por encima de la primera sección (en la cabecera) no hay ninguna activa.
            else if (entry.target === first && entry.boundingClientRect.top > line) setActive(null)
          }
        },
        { rootMargin: `-${line}px 0px -${below}px 0px` },
      )
      sections.forEach((section) => observer?.observe(section))

      // La última sección puede ser demasiado corta para llegar a la línea:
      // si ya se ve entera al final de la página, también cuenta como activa.
      bottomObserver = new IntersectionObserver(
        ([entry]) => {
          if (locked.current || !entry?.isIntersecting || window.scrollY <= 0) return
          const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
          if (atBottom) setActive(last.id)
        },
        { threshold: [0.25, 0.5, 0.75, 1] },
      )
      bottomObserver.observe(last)
    }

    build()
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(build)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      bottomObserver?.disconnect()
    }
  }, [ids])

  // "Pegada": el centinela (justo encima de la barra) ha pasado por debajo de la cabecera.
  useEffect(() => {
    const nav = navRef.current
    const sentinel = sentinelRef.current
    if (!nav || !sentinel || typeof IntersectionObserver === 'undefined') return
    const top = Math.round(parseFloat(getComputedStyle(nav).top))
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top)
      },
      { rootMargin: `-${top}px 0px 0px 0px` },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // En móvil la barra se desliza en horizontal: la activa siempre a la vista.
  useEffect(() => {
    const track = trackRef.current
    if (!track || !active || track.scrollWidth <= track.clientWidth) return
    const link = track.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!link) return
    const left = link.offsetLeft - (track.clientWidth - link.offsetWidth) / 2
    track.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [active, reduceMotion])

  // Difuminado de los bordes con contenido oculto al deslizar.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = () => {
      const overflow = track.scrollWidth > track.clientWidth + 1
      track.toggleAttribute('data-more-start', overflow && track.scrollLeft > 4)
      track.toggleAttribute('data-more-end', overflow && track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
    }
    update()
    track.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(track)
    return () => {
      track.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  useEffect(() => () => unlock.current(), [])

  function lockUntilScrollEnds() {
    unlock.current()
    locked.current = true
    const done = () => {
      locked.current = false
      clearTimeout(timer)
      window.removeEventListener('scrollend', done)
      unlock.current = () => {}
    }
    // Respaldo para navegadores sin `scrollend`.
    const timer = window.setTimeout(done, 1000)
    window.addEventListener('scrollend', done)
    unlock.current = done
  }

  function goTo(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    setActive(id)
    lockUntilScrollEnds()
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    // El foco viaja con el desplazamiento: el siguiente Tab sigue dentro de la sección.
    target.focus({ preventScroll: true })
    // Con el estado de Next intacto: sólo cambia el ancla, no hay navegación.
    window.history.replaceState(window.history.state, '', `#${id}`)
  }

  const half = Math.ceil(items.length / 2)
  const groups = [items.slice(0, half), items.slice(half)]

  const renderItem = (item: TeamSectionItem) => {
    const Icon = ICONS[item.id]
    const selected = active === item.id
    return (
      <li key={item.id} className="flex shrink-0 grow md:grow-0">
        <a
          href={`#${item.id}`}
          data-section={item.id}
          aria-current={selected ? 'true' : undefined}
          onClick={(e) => goTo(e, item.id)}
          className={clsx(
            'relative flex h-10 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors duration-200',
            selected ? 'text-brand-fg' : 'text-muted hover:text-ink',
          )}
        >
          {selected && (
            <motion.span
              layoutId={pillId}
              aria-hidden
              className="absolute inset-0 rounded-full bg-brand shadow-card"
              transition={PILL_SPRING}
            />
          )}
          {Icon && <Icon aria-hidden size={16} className="relative shrink-0 max-[380px]:hidden" />}
          <span className="relative">{item.label}</span>
          {item.count !== undefined && (
            <span
              className={clsx(
                'relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors duration-200',
                selected ? 'bg-brand-fg/20 text-brand-fg' : 'bg-surface-2 text-muted',
              )}
            >
              {item.count}
            </span>
          )}
        </a>
      </li>
    )
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <nav
        ref={navRef}
        aria-label="Secciones del equipo"
        data-stuck={stuck || undefined}
        className="team-nav sticky z-20 -mt-px mb-6 md:mb-8"
      >
        <div className="team-nav-surface max-md:glass max-md:rounded-full max-md:p-1">
          <div
            ref={trackRef}
            className="team-nav-track no-scrollbar relative flex overflow-x-auto overscroll-x-contain md:grid md:grid-cols-[1fr_7rem_1fr] md:items-center md:overflow-visible"
          >
            <ul className="team-nav-group flex grow md:glass md:grow-0 md:justify-self-end md:rounded-full md:p-1">
              {groups[0].map(renderItem)}
            </ul>
            {/* Hueco de la pokéball de la cabecera: una miniatura mientras no está pegada. */}
            <span aria-hidden className="team-nav-hub hidden place-items-center text-muted/60 md:grid">
              <HubBall />
            </span>
            <ul className="team-nav-group flex grow md:glass md:grow-0 md:justify-self-start md:rounded-full md:p-1">
              {groups[1].map(renderItem)}
            </ul>
          </div>
        </div>
      </nav>
    </>
  )
}

function HubBall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6" focusable="false">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h6.5M15 12h6.5" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
