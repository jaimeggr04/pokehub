import { TYPE_COLORS, prettify } from '@/lib/pokemon'
import clsx from 'clsx'

export function TypeBadge({
  type,
  size = 'md',
  className,
}: {
  type: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.unknown
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        className,
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {prettify(type)}
    </span>
  )
}
