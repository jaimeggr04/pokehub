import clsx from 'clsx'
import { Pokeball } from '@/components/pokeball'

/** Pokéball bamboleándose como en una captura: el indicador de carga de la app. */
export function PokeballSpinner({
  size = 48,
  label = 'Cargando…',
  className,
}: {
  size?: number
  label?: string
  className?: string
}) {
  return (
    <span role="status" className={clsx('inline-flex flex-col items-center', className)}>
      <span aria-hidden className="relative block" style={{ width: size, height: size }}>
        <Pokeball className="relative z-10 h-full w-full animate-catch drop-shadow-sm" />
        {/* Sombra en el suelo: sin ella el bamboleo parece flotar. */}
        <span className="absolute -bottom-[6%] left-1/2 h-[10%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/20 blur-[2px] dark:bg-black/45" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
