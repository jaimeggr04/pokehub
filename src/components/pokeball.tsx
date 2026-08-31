'use client'

import { useId } from 'react'
import clsx from 'clsx'

/**
 * Pokéball vectorial. Todo el color sale de custom properties, así que en tema
 * claro se dibuja una Pokéball roja y en oscuro una Master Ball morada: las
 * marcas rosas y la "M" son `transparent` en claro, por lo que no hace falta
 * duplicar el SVG ni alternar `display`.
 */
export function Pokeball({
  className,
  glossy = true,
  core = true,
}: {
  className?: string
  /** Brillo especular sobre la mitad superior. */
  glossy?: boolean
  /** Botón central. Desactívalo cuando el botón real va aparte. */
  core?: boolean
}) {
  // Los ids de <defs> son globales en el documento: hay que aislarlos por instancia.
  const uid = useId().replace(/:/g, '')
  const top = `top-${uid}`
  const bottom = `bottom-${uid}`
  const gloss = `gloss-${uid}`
  const clip = `clip-${uid}`

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="var(--ball-top-1)" />
          <stop offset="100%" stopColor="var(--ball-top-2)" />
        </linearGradient>
        <linearGradient id={bottom} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="var(--ball-bot-1)" />
          <stop offset="100%" stopColor="var(--ball-bot-2)" />
        </linearGradient>
        <radialGradient id={gloss} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="100" height="50" fill={`url(#${top})`} />
        <rect x="0" y="50" width="100" height="50" fill={`url(#${bottom})`} />

        {/* Marcas de Master Ball: invisibles en tema claro. */}
        <circle cx="31" cy="24" r="6.5" fill="var(--ball-mark)" />
        <circle cx="69" cy="24" r="6.5" fill="var(--ball-mark)" />
        <path
          d="M38 41 L41.5 22 L50 31 L58.5 22 L62 41"
          fill="none"
          stroke="var(--ball-mark-m)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Banda ecuatorial. */}
        <rect x="0" y="43.5" width="100" height="13" fill="var(--band)" />

        {glossy && <ellipse cx="33" cy="27" rx="21" ry="13" fill={`url(#${gloss})`} />}
      </g>

      {/* Contorno. */}
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--band)" strokeWidth="6" />

      {core && (
        <>
          <circle cx="50" cy="50" r="16" fill="var(--band)" />
          <circle cx="50" cy="50" r="11.5" fill="var(--ball-core)" />
          <circle cx="50" cy="50" r="6" fill="var(--ball-core-inner)" />
        </>
      )}
    </svg>
  )
}

/**
 * Sólo el botón central de la Pokéball, para cuando la bola en sí la forman
 * la cabecera y el pie (pantalla de acceso).
 */
export function PokeballCore({ className, pulsing }: { className?: string; pulsing?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const shell = `shell-${uid}`
  const dot = `dot-${uid}`

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={shell} cx="0.36" cy="0.3" r="0.75">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="var(--ball-bot-2)" />
        </radialGradient>
        <radialGradient id={dot} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="var(--ball-core)" />
          <stop offset="100%" stopColor="var(--ball-core-inner)" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="47" fill="var(--band)" />
      <circle cx="50" cy="50" r="40" fill={`url(#${shell})`} />
      <circle cx="50" cy="50" r="25" fill="var(--band)" />
      <circle
        cx="50"
        cy="50"
        r="19"
        fill={`url(#${dot})`}
        className={pulsing ? 'pokeball-core-dot' : undefined}
      />
      {/* Reflejo. */}
      <ellipse cx="36" cy="30" rx="14" ry="9" fill="#fff" opacity="0.55" />
    </svg>
  )
}

/** Icono estático para spinners, estados vacíos y el 404. */
export function PokeballIcon({ className }: { className?: string }) {
  return <Pokeball className={clsx('drop-shadow-sm', className)} />
}
