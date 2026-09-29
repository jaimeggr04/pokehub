'use client'

import { CircleDot, Sparkles, Swords, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { Skeleton } from '@/components/ui/skeleton'
import { TYPE_COLORS, prettify } from '@/lib/pokemon'
import type { MoveDetail } from '@/lib/pokeapi'

const CATEGORY: Record<MoveDetail['damageClass'], { label: string; Icon: LucideIcon }> = {
  physical: { label: 'Físico', Icon: Swords },
  special: { label: 'Especial', Icon: Sparkles },
  status: { label: 'Estado', Icon: CircleDot },
}

/**
 * Movimientos como fichas del color de su tipo, con categoría, potencia,
 * precisión y PP. `compact` quita PP y la línea de tipo para caber en rejilla.
 */
export function MoveList({
  names,
  details,
  compact = false,
  className,
}: {
  /** Los nombres del set, para saber cuántos huecos de carga pintar. */
  names: (string | null | undefined)[]
  details: MoveDetail[] | null
  compact?: boolean
  className?: string
}) {
  const count = names.filter(Boolean).length

  if (count === 0) {
    return <p className={clsx('pokemon-wash rounded-xl px-3 py-2.5 text-sm text-muted', className)}>Sin movimientos.</p>
  }

  return (
    <ul className={clsx('grid gap-2', compact && 'sm:grid-cols-2', className)}>
      {details
        ? details.map((m, i) => <MoveChip key={`${m.name}-${i}`} move={m} index={i} compact={compact} />)
        : Array.from({ length: count }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-11 w-full rounded-xl" />
            </li>
          ))}
    </ul>
  )
}

function MoveChip({ move, index, compact }: { move: MoveDetail; index: number; compact: boolean }) {
  const c = TYPE_COLORS[move.type] ?? TYPE_COLORS.unknown
  const { label, Icon } = CATEGORY[move.damageClass] ?? CATEGORY.status
  const knownType = move.type !== 'unknown'

  return (
    <li
      className="pokemon-move stagger-item flex min-h-11 items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-3"
      style={{ '--type-bg': c.bg, '--type-fg': c.fg, '--i': index } as React.CSSProperties}
      title={knownType ? `${prettify(move.name)} · ${prettify(move.type)} · ${label}` : prettify(move.name)}
    >
      <span
        title={label}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/15 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]"
      >
        <Icon aria-hidden size={15} strokeWidth={2.4} />
        <span className="sr-only">Categoría: {label}.</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-tight">{prettify(move.name)}</span>
        {!compact && knownType && (
          <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
            {prettify(move.type)} · {label}
          </span>
        )}
      </span>

      <dl className="flex shrink-0 gap-2.5 text-right leading-none tabular-nums">
        <Meta term="Potencia" abbr="Pot" value={move.power ?? '—'} />
        <Meta term="Precisión" abbr="Prec" value={move.accuracy ? `${move.accuracy}%` : '—'} />
        {!compact && <Meta term="PP" abbr="PP" value={move.pp ?? '—'} />}
      </dl>
    </li>
  )
}

function Meta({ term, abbr, value }: { term: string; abbr: string; value: string | number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <dt className="text-[9px] font-semibold uppercase tracking-wider opacity-75">
        <abbr title={term} className="no-underline">
          {abbr}
        </abbr>
      </dt>
      <dd className="text-xs font-bold">{value}</dd>
    </div>
  )
}
