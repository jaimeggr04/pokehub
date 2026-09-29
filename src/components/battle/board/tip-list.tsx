'use client'

import { useId, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, CircleAlert, Info, Target, TriangleAlert } from 'lucide-react'
import type { Tip, Tone } from '@/lib/battle/advice'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'

/*
 * Consejos como tarjetas escaneables: color e icono dicen el tipo de aviso
 * antes de leer nada, el título cabe en una línea o dos y los números van
 * detrás de un toque (salvo en el primero, que suele ser el que importa).
 */

const TONES: Record<Tone, { icon: typeof Info; label: string }> = {
  danger: { icon: TriangleAlert, label: 'Peligro' },
  good: { icon: Target, label: 'Oportunidad' },
  warning: { icon: CircleAlert, label: 'Atención' },
  info: { icon: Info, label: 'Para saber' },
}

export function TipCard({ tip, defaultOpen = false, index = 0 }: { tip: Tip; defaultOpen?: boolean; index?: number }) {
  const [open, setOpen] = useState(defaultOpen)
  const reduceMotion = useReducedMotion()
  const { icon: Icon, label } = TONES[tip.tone]
  const detailId = useId()
  const species = tip.species?.slice(0, 2) ?? []

  const header = (
    <>
      <span className="battle-tip-icon" aria-hidden>
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{label}: </span>
        <span className="block text-[15px] font-semibold leading-snug">{tip.title}</span>
      </span>
      {species.length > 0 && (
        <span aria-hidden className="-my-1 flex shrink-0 -space-x-3">
          {species.map((s, i) => (
            <ShowdownSprite key={`${s}-${i}`} species={s} size={40} flip={i === 0 && tip.tone === 'danger'} />
          ))}
        </span>
      )}
      {tip.detail && (
        <ChevronDown
          aria-hidden
          size={18}
          className={clsx(
            'shrink-0 text-muted transition-transform duration-(--dur) ease-(--ease-out-expo)',
            open && 'rotate-180',
          )}
        />
      )}
    </>
  )

  return (
    <li className="battle-tip stagger-item" data-tone={tip.tone} style={{ '--i': index } as React.CSSProperties}>
      {tip.detail ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className="battle-tip-button flex min-h-14 w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left"
        >
          {header}
        </button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 py-2.5 pl-4 pr-3">{header}</div>
      )}
      <AnimatePresence initial={false}>
        {open && tip.detail && (
          <motion.div
            key="detail"
            id={detailId}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-3 pl-[3.75rem] pr-4 text-sm leading-relaxed text-muted">{tip.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function TipList({
  tips,
  label,
  openFirst = true,
  className,
}: {
  tips: Tip[]
  label: string
  /** Abre el primero: suele ser el peligro más urgente. */
  openFirst?: boolean
  className?: string
}) {
  return (
    <ul aria-label={label} className={clsx('space-y-2', className)}>
      {tips.map((tip, i) => (
        <TipCard key={tip.id} tip={tip} index={i} defaultOpen={openFirst && i === 0} />
      ))}
    </ul>
  )
}
