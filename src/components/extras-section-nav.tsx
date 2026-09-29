'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import clsx from 'clsx'

export type SectionNavItem = {
  id: string
  label: string
  /** Elemento ya pintado (no el componente): así también lo puede pasar una página de servidor. */
  icon?: React.ReactNode
  /** La zona de peligro se distingue también en el índice. */
  danger?: boolean
}

// Distancia bajo la cabecera a la que se considera que una sección "ha empezado".
const SPY_OFFSET = 120
// Por si el navegador no emite `scrollend` (o no hubo desplazamiento que terminar).
const LOCK_FALLBACK_MS = 1200

/**
 * Sección visible según el scroll: la última cuyo borde superior ha cruzado una
 * línea imaginaria bajo la cabecera. Al pulsar un enlace se fija la elegida
 * hasta que termina el desplazamiento suave; si no, el indicador recorrería
 * todas las secciones intermedias.
 */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '')
  const lock = useRef<{ timer: number; release: () => void } | null>(null)
  const idsKey = ids.join('|')

  useEffect(() => {
    const list = idsKey.split('|')
    let frame = 0

    const measure = () => {
      frame = 0
      if (lock.current) return
      const root = document.documentElement
      const header = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 92
      const line = header + SPY_OFFSET
      // Al final de la página la última sección puede no llegar nunca a la línea.
      if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) {
        setActive(list[list.length - 1])
        return
      }
      let current = list[0]
      for (const id of list) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      lock.current?.release()
    }
  }, [idsKey])

  const select = useCallback((id: string) => {
    lock.current?.release()
    setActive(id)
    const release = () => {
      if (!lock.current) return
      clearTimeout(lock.current.timer)
      window.removeEventListener('scrollend', release)
      lock.current = null
    }
    lock.current = { timer: window.setTimeout(release, LOCK_FALLBACK_MS), release }
    window.addEventListener('scrollend', release)
  }, [])

  return { active, select }
}

/**
 * Maqueta de página con índice: carril lateral pegajoso de md en adelante y,
 * por debajo, chips deslizables que se quedan flotando bajo la cabecera. Los
 * enlaces son anclas normales (#perfil…), así que funcionan sin JS y se pueden
 * compartir; el JS sólo marca la sección visible.
 */
export function SectionLayout({
  items,
  ariaLabel,
  railTitle,
  railFooter,
  numbered = false,
  chips = true,
  children,
  className,
}: {
  items: SectionNavItem[]
  ariaLabel: string
  railTitle?: string
  railFooter?: React.ReactNode
  /** Numera las entradas del carril (índices de documentos). */
  numbered?: boolean
  /** Sin chips, la página pinta su propio índice en móvil. */
  chips?: boolean
  children: React.ReactNode
  className?: string
}) {
  const { active, select } = useActiveSection(items.map((item) => item.id))

  return (
    // Los chips van fuera de la rejilla a propósito: un elemento sticky sólo se
    // pega dentro de su bloque contenedor, y en una fila propia no tendría recorrido.
    <div className={className}>
      {chips && <SectionChips items={items} ariaLabel={ariaLabel} active={active} onSelect={select} />}

      <div className="grid gap-5 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden md:block">
          <SectionRail
            items={items}
            ariaLabel={ariaLabel}
            title={railTitle}
            footer={railFooter}
            numbered={numbered}
            active={active}
            onSelect={select}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

function SectionRail({
  items,
  ariaLabel,
  title,
  footer,
  numbered,
  active,
  onSelect,
}: {
  items: SectionNavItem[]
  ariaLabel: string
  title?: string
  footer?: React.ReactNode
  numbered: boolean
  active: string
  onSelect: (id: string) => void
}) {
  // Único por instancia: el carril y los chips no deben intercambiarse la píldora.
  const pillId = `extras-rail-${useId()}`
  const List = numbered ? 'ol' : 'ul'

  return (
    // layoutScroll: el carril puede tener scroll propio y la píldora tiene que tenerlo en cuenta.
    <motion.nav layoutScroll aria-label={ariaLabel} className="extras-rail card p-2">
      {title && (
        <p className="px-3 pb-2 pt-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</p>
      )}
      <List className="flex flex-col gap-0.5">
        {items.map((item, index) => {
          const selected = item.id === active
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={selected ? 'location' : undefined}
                onClick={() => onSelect(item.id)}
                className={clsx(
                  'group relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors duration-200',
                  item.danger ? 'extras-ink-danger' : selected ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-xl transition-colors duration-200 group-hover:bg-surface-2"
                />
                {selected && (
                  <motion.span
                    layoutId={pillId}
                    aria-hidden
                    className={clsx(
                      'absolute inset-0 rounded-xl',
                      item.danger ? 'bg-danger-soft' : 'bg-brand-soft',
                    )}
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <span
                  aria-hidden
                  className={clsx(
                    'relative grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums transition-colors duration-200',
                    selected
                      ? item.danger ? 'bg-danger text-white dark:text-bg' : 'bg-brand text-brand-fg'
                      : 'bg-surface-2 shadow-card',
                  )}
                >
                  {numbered ? index + 1 : item.icon}
                </span>
                <span className="relative min-w-0 leading-snug">{item.label}</span>
              </a>
            </li>
          )
        })}
      </List>
      {footer && <div className="mt-2 border-t border-line px-3 pb-2 pt-3 text-xs text-muted">{footer}</div>}
    </motion.nav>
  )
}

function SectionChips({
  items,
  ariaLabel,
  active,
  onSelect,
}: {
  items: SectionNavItem[]
  ariaLabel: string
  active: string
  onSelect: (id: string) => void
}) {
  const pillId = `extras-chip-${useId()}`
  const listRef = useRef<HTMLUListElement>(null)

  // El chip activo se desliza hasta el centro de la fila: si no, al bajar por
  // la página quedaría fuera de la vista en pantallas estrechas.
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>(`[data-section="${CSS.escape(active)}"]`)
    if (!list || !chip) return
    const listBox = list.getBoundingClientRect()
    const chipBox = chip.getBoundingClientRect()
    const delta = chipBox.left - listBox.left - (listBox.width - chipBox.width) / 2
    if (Math.abs(delta) < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' })
  }, [active])

  return (
    <nav
      aria-label={ariaLabel}
      className="glass sticky top-[calc(var(--header-h)+8px)] z-20 mb-4 rounded-full border border-line p-1 shadow-float md:hidden"
    >
      {/* layoutScroll: la fila se desliza a la vez que la píldora cambia de chip. */}
      <motion.ul ref={listRef} layoutScroll className="extras-chips no-scrollbar flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const selected = item.id === active
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                data-section={item.id}
                aria-current={selected ? 'location' : undefined}
                onClick={() => onSelect(item.id)}
                className={clsx(
                  'relative flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-200',
                  item.danger ? 'extras-ink-danger' : selected ? 'text-brand-fg' : 'text-muted hover:text-ink',
                )}
              >
                {selected && (
                  <motion.span
                    layoutId={pillId}
                    aria-hidden
                    className={clsx(
                      'absolute inset-0 rounded-full',
                      item.danger ? 'bg-danger-soft ring-1 ring-danger/40' : 'bg-brand shadow-card',
                    )}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                {item.icon && (
                  <span aria-hidden className="relative [&>svg]:size-[15px]">
                    {item.icon}
                  </span>
                )}
                <span className="relative whitespace-nowrap">{item.label}</span>
              </a>
            </li>
          )
        })}
      </motion.ul>
    </nav>
  )
}
