import { Logo } from '@/components/logo'
import { Pokeball } from '@/components/pokeball'

/**
 * Pantalla completa para estados fuera de lo normal (404, error). Vive fuera
 * del armazón de la app, así que trae su propio logo; al pie, hierba alta con
 * una mata que se agita: algo se esconde ahí.
 */
export function StatusScreen({
  art,
  eyebrow,
  title,
  description,
  actions,
  footnote,
}: {
  art: React.ReactNode
  eyebrow?: string
  title: React.ReactNode
  description: React.ReactNode
  actions: React.ReactNode
  footnote?: React.ReactNode
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <span aria-hidden className="extras-status-glow" />

      <header className="relative z-10 flex items-center px-4 py-4 md:px-7 md:py-5">
        <Logo href="/home" size="md" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-36 pt-4 text-center sm:pb-44">
        <div className="animate-scale-in">{art}</div>
        {eyebrow && (
          <p className="mt-7 animate-fade-up text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
        )}
        <h1 className="mt-2 max-w-xl animate-fade-up text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-md animate-fade-up text-pretty text-[15px] leading-relaxed text-muted [animation-delay:80ms]">
          {description}
        </p>
        <div className="mt-7 flex animate-fade-up flex-wrap justify-center gap-2.5 [animation-delay:160ms]">{actions}</div>
        {footnote && <div className="mt-6 animate-fade-in text-xs text-muted [animation-delay:300ms]">{footnote}</div>}
      </main>

      <TallGrass />
    </div>
  )
}

/** "4 ◓ 4": la pokéball hace de cero y se bambolea como en una captura. */
export function NotFoundArt() {
  return (
    <div role="img" aria-label="Error 404" className="flex items-center gap-1 sm:gap-3">
      <span aria-hidden className="extras-digit">4</span>
      <span aria-hidden className="relative block size-[clamp(4.5rem,19vw,8.25rem)]">
        <Pokeball className="relative z-10 size-full animate-catch drop-shadow-lg" />
        <span className="absolute -bottom-[7%] left-1/2 h-[10%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px] dark:bg-black/45" />
      </span>
      <span aria-hidden className="extras-digit">4</span>
    </div>
  )
}

/** Pokéball ladeada con un "!" de sorpresa, como cuando un entrenador te ve. */
export function ErrorArt() {
  return (
    <div aria-hidden className="relative mx-auto size-32 sm:size-36">
      <Pokeball className="relative z-10 size-full -rotate-12 animate-wiggle drop-shadow-lg" />
      <span className="absolute -right-2 -top-3 z-20 grid size-11 animate-bounce-in place-items-center rounded-2xl bg-bg-elevated text-2xl font-extrabold text-brand shadow-float [animation-delay:250ms]">
        !
      </span>
      <span className="absolute -bottom-[6%] left-1/2 h-[10%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/20 blur-[3px] dark:bg-black/45" />
    </div>
  )
}

// Briznas en zigzag: dos capas desfasadas dan volumen sin dibujar cada hoja.
function blades(width: number, step: number, offset: number, low: number, high: number) {
  let d = `M0 64 `
  for (let x = offset, i = 0; x <= width + step; x += step, i++) {
    const peak = i % 3 === 0 ? high : i % 3 === 1 ? low : (high + low) / 2
    d += `L${x} ${peak} L${x + step / 2} 64 `
  }
  return d + `L${width} 64 Z`
}

const BACK = blades(1200, 22, 0, 22, 6)
const FRONT = blades(1200, 26, 11, 30, 14)

function TallGrass() {
  return (
    <div aria-hidden className="extras-grass pointer-events-none absolute inset-x-0 bottom-0 z-0 h-24 sm:h-32">
      <svg viewBox="0 0 1200 64" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
        <path d={BACK} fill="currentColor" />
      </svg>
      <svg viewBox="0 0 1200 64" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d={FRONT} fill="currentColor" />
      </svg>
      {/* La mata que se mueve, con dos ojitos asomando. */}
      <svg viewBox="0 0 80 64" className="extras-grass-rustle absolute bottom-0 left-[62%] h-20 w-24 sm:h-28 sm:w-32">
        <path d="M4 64 L14 14 L22 64 L30 2 L40 64 L50 8 L58 64 L68 18 L76 64 Z" fill="currentColor" />
        <g fill="#fff">
          <ellipse cx="33" cy="40" rx="4" ry="5" />
          <ellipse cx="47" cy="40" rx="4" ry="5" />
        </g>
        <g fill="#111">
          <circle cx="34" cy="41" r="2" />
          <circle cx="48" cy="41" r="2" />
        </g>
      </svg>
    </div>
  )
}
