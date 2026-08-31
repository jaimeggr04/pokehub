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
}: {
  href?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
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
        scale,
        className,
      )}
    >
      <span className="text-[#111]">Poke</span>
      <span className="rounded-md bg-brand px-1.5 py-1 text-white shadow-[0_2px_0_rgba(0,0,0,.25)]">
        Hub
      </span>
    </span>
  )

  if (!href) return inner
  return (
    <Link href={href} aria-label="PokeHub — inicio" className="shrink-0">
      {inner}
    </Link>
  )
}
