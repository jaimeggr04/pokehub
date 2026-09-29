import clsx from 'clsx'

/**
 * Bloque de carga con brillo. Si `className` trae su propio `rounded-*` se
 * respeta; si no, se aplica uno por defecto (sin tailwind-merge, dos clases de
 * radio competirían y ganaría la que Tailwind emita después).
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const hasRadius = /(^|\s)rounded(\s|-|$)/.test(className ?? '')
  return <div aria-hidden className={clsx('skeleton', !hasRadius && 'rounded-xl', className)} style={style} />
}
