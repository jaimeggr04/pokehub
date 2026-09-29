import clsx from 'clsx'

/*
 * Los tres pasos de la portada con un dibujo cada uno. Los dibujos son SVG
 * en línea con los colores del tema (fill-*, stroke-*): cambian solos entre
 * Pokéball y Master Ball y no descargan nada.
 */

const STEPS = [
  { title: 'Empieza una partida en Showdown', Art: ShowdownArt },
  { title: 'Pega aquí el enlace', Art: LinkArt },
  { title: 'Juega con los consejos', Art: AdviceArt },
]

export function BattleSteps({ className }: { className?: string }) {
  return (
    <section aria-labelledby="battle-s-steps-title" className={className}>
      <h2 id="battle-s-steps-title" className="sr-only">
        Cómo funciona
      </h2>
      <ol className="battle-s-steps">
        {STEPS.map(({ title, Art }, i) => (
          <li key={title} className="battle-s-step stagger-item" style={{ '--i': i + 1 } as React.CSSProperties}>
            <span aria-hidden className="battle-s-step-num">
              {i + 1}
            </span>
            <Art />
            <p className="text-[12px] font-semibold leading-snug sm:text-sm">
              <span className="sr-only">Paso {i + 1}: </span>
              {title}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 64"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('battle-s-ill', className)}
    >
      {children}
    </svg>
  )
}

/** Mini pokéball: mitad de marca, línea central y botón. */
function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <path d={`M${cx - r} ${cy}a${r} ${r} 0 0 1 ${r * 2} 0z`} className="fill-brand" />
      <path d={`M${cx - r} ${cy}a${r} ${r} 0 0 0 ${r * 2} 0z`} className="fill-surface-2" />
      <circle cx={cx} cy={cy} r={r} strokeWidth="2" className="stroke-ink" />
      <path d={`M${cx - r} ${cy}h${r * 2}`} strokeWidth="2" className="stroke-ink" />
      <circle cx={cx} cy={cy} r={r / 3} strokeWidth="2" className="fill-surface-2 stroke-ink" />
    </g>
  )
}

/** Ventana de navegador con un combate: dos pokéballs frente a frente. */
function ShowdownArt() {
  return (
    <Svg>
      <rect x="6" y="6" width="84" height="52" rx="7" strokeWidth="2" className="fill-surface-2 stroke-line" />
      <path d="M6 16h84" strokeWidth="2" className="stroke-line" />
      <circle cx="13" cy="11" r="1.6" className="fill-brand" />
      <circle cx="19" cy="11" r="1.6" className="fill-muted" />
      <circle cx="25" cy="11" r="1.6" className="fill-muted" />
      <Ball cx={28} cy={38} r={10} />
      <Ball cx={68} cy={38} r={10} />
      <path d="m44 32 4 6-4 6m8-12-4 6 4 6" strokeWidth="2.4" className="stroke-brand" />
    </Svg>
  )
}

/** Móvil con el enlace pegado en el campo. */
function LinkArt() {
  return (
    <Svg>
      <rect x="30" y="3" width="36" height="58" rx="7" strokeWidth="2" className="fill-surface-2 stroke-line" />
      <path d="M43 8h10" strokeWidth="2" className="stroke-line" />
      <rect x="34" y="24" width="28" height="12" rx="6" strokeWidth="2" className="fill-bg stroke-brand" />
      <path d="M41 30h1m3 0h11" strokeWidth="2" className="stroke-muted" />
      <rect x="37" y="42" width="22" height="8" rx="4" className="fill-brand" />
      {/* Cadena del enlace, fuera del móvil. */}
      <g strokeWidth="2.4" className="stroke-brand">
        <path d="M12 38l5-5a5 5 0 0 1 7 7l-2 2" />
        <path d="M22 28l-2 2m-2 2-5 5a5 5 0 0 0 7 7l5-5" />
      </g>
      <path d="M72 18l6-4m-5 12h7m-8 7 6 4" strokeWidth="2.2" className="stroke-muted" />
    </Svg>
  )
}

/** Tarjeta de consejo: bombilla, líneas de texto y un «KO». */
function AdviceArt() {
  return (
    <Svg>
      <rect x="8" y="10" width="62" height="44" rx="7" strokeWidth="2" className="fill-surface-2 stroke-line" />
      <path d="M18 24h28M18 32h38M18 40h22" strokeWidth="2.4" className="stroke-muted" />
      <rect x="44" y="36" width="20" height="11" rx="5.5" className="fill-success" />
      <text x="54" y="44.5" textAnchor="middle" fontSize="8" fontWeight="800" className="fill-bg">
        KO
      </text>
      <circle cx="76" cy="20" r="12" className="fill-brand" />
      <path d="M72 18a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5zm2 8h4" strokeWidth="1.8" className="stroke-brand-fg" />
    </Svg>
  )
}
