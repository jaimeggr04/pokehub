'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import clsx from 'clsx'

export type SegmentedTabItem = {
  href: string
  label: React.ReactNode
  active: boolean
  badge?: number
}

/**
 * Pestañas en píldora con enlaces reales (funcionan sin JS y se pueden abrir en
 * otra pestaña). La píldora activa se desliza con un muelle entre opciones.
 */
export function SegmentedTabs({
  items,
  ariaLabel,
  className,
}: {
  items: SegmentedTabItem[]
  ariaLabel: string
  className?: string
}) {
  // Único por instancia: dos grupos de pestañas en la misma vista no deben
  // intercambiarse la píldora.
  const layoutId = `segmented-${useId()}`
  const activeHref = items.find((item) => item.active)?.href

  // La píldora se mueve al pulsar, sin esperar a que el servidor responda. El
  // valor pendiente caduca solo en cuanto cambia la pestaña activa real.
  const [pending, setPending] = useState<{ href: string; from?: string } | null>(null)
  const current = pending && pending.from === activeHref ? pending.href : activeHref

  return (
    <nav aria-label={ariaLabel} className={clsx('flex gap-1 rounded-full bg-surface p-1 shadow-card', className)}>
      {items.map((item) => {
        const selected = item.href === current
        const badge = item.badge && item.badge > 0 ? (item.badge > 99 ? '99+' : String(item.badge)) : null

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              setPending({ href: item.href, from: activeHref })
            }}
            className={clsx(
              'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-center text-sm font-semibold transition-colors duration-200 sm:px-3',
              selected ? 'text-brand-fg' : 'text-muted hover:text-ink',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-brand shadow-card"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 truncate">{item.label}</span>
            {badge && (
              <span
                className={clsx(
                  'relative z-10 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums transition-colors duration-200',
                  selected ? 'bg-brand-fg text-brand' : 'bg-brand text-brand-fg',
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
