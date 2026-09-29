import clsx from 'clsx'
import { PokeballIcon } from '@/components/pokeball'

/**
 * Estado vacío con una pokéball flotando sobre su sombra. `icon` sustituye a la
 * pokéball (p. ej. un icono de lucide) y hereda el mismo flotado.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <div aria-hidden className="relative mb-5 flex h-20 w-20 items-start justify-center">
        {icon ? (
          <span className="grid h-14 w-14 animate-float place-items-center rounded-2xl bg-brand-soft text-brand">
            {icon}
          </span>
        ) : (
          <PokeballIcon className="h-14 w-14 animate-float" />
        )}
        {/* Misma duración que el flotado: al subir el objeto, la sombra encoge. */}
        <span className="absolute bottom-0.5 left-1/2 h-2 w-11 -translate-x-1/2 animate-float-shadow rounded-[50%] bg-black/15 blur-[2px] dark:bg-black/40" />
      </div>
      <p className="text-lg font-bold leading-snug">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}
