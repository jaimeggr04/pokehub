import Link from 'next/link'
import clsx from 'clsx'

/**
 * Logotipo de PokeHub reconstruido en vectorial/CSS a partir del PNG original,
 * para que escale bien y se adapte al tema.
 */
export function Logo({
  href = '/home',
  size = 'md',
  className,
  easterEggTrigger = false,
}: {
  href?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Marca el logo como disparador del huevo de pascua (7 toques seguidos). */
  easterEggTrigger?: boolean
}) {
  const scale = {
    sm: 'text-lg px-2.5 py-1 gap-1',
    md: 'text-2xl px-3.5 py-1.5 gap-1.5',
    lg: 'text-4xl px-5 py-2.5 gap-2',
  }[size]

  const inner = (
    <span
      className={clsx(
        'inline-flex items-center rounded-xl bg-white font-extrabold leading-none tracking-tight shadow-card select-none',
        'transition-[translate,box-shadow] duration-300 ease-(--ease-out-expo)',
        href && 'group-hover:-translate-y-px group-hover:shadow-float group-active:translate-y-0',
        scale,
        className,
      )}
    >
      <span className="text-[#111]">Poke</span>
      {/* "Hub" se ladea un poco al pasar por encima: un guiño, no un número de circo. */}
      <span
        className={clsx(
          'rounded-md bg-brand px-1.5 py-1 text-white shadow-[0_2px_0_rgba(0,0,0,.25)]',
          'transition-[rotate,scale] duration-300 ease-(--ease-spring)',
          href && 'group-hover:-rotate-6 group-hover:scale-105',
        )}
      >
        Hub
      </span>
    </span>
  )

  if (!href) return inner
  return (
    <Link
      href={href}
      aria-label="PokeHub — inicio"
      data-easter-egg-trigger={easterEggTrigger ? '' : undefined}
      className="group shrink-0 rounded-xl"
    >
      {inner}
    </Link>
  )
}
