import { Gem } from 'lucide-react'
import clsx from 'clsx'
import { TYPE_COLORS, prettify } from '@/lib/pokemon'

function typeVars(type: string) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.unknown
  return { '--type-bg': c.bg, '--type-fg': c.fg } as React.CSSProperties
}

// El relieve del texto sólo ayuda sobre fondos oscuros; sobre amarillo o verde claro ensucia.
function lightText(type: string) {
  return (TYPE_COLORS[type] ?? TYPE_COLORS.unknown).fg === '#ffffff'
}

export function TypeBadge({
  type,
  size = 'md',
  className,
}: {
  type: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      className={clsx(
        'pokemon-type-badge inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-semibold uppercase leading-none tracking-wide',
        lightText(type) && 'pokemon-type-badge--light',
        size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2.5 text-[11px]',
        className,
      )}
      style={typeVars(type)}
    >
      {prettify(type)}
    </span>
  )
}

/**
 * Teratipo con aspecto de cristal: degradado del color del tipo, facetas y un
 * destello que lo recorre de vez en cuando. El Astral lleva su arcoíris.
 */
export function TeraBadge({
  type,
  size = 'md',
  className,
}: {
  type: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      data-type={type}
      title={`Teratipo ${prettify(type)}`}
      className={clsx(
        'pokemon-tera inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-bold uppercase leading-none tracking-wide',
        lightText(type) && 'pokemon-type-badge--light',
        size === 'sm' ? 'h-5 px-2.5 text-[10px]' : 'h-6 px-3 text-[11px]',
        className,
      )}
      style={typeVars(type)}
    >
      <Gem aria-hidden size={size === 'sm' ? 11 : 12} strokeWidth={2.5} />
      <span className="sr-only">Teratipo</span>
      <span aria-hidden>Tera</span> {prettify(type)}
    </span>
  )
}
