import Link from 'next/link'
import {
  ArrowDown, ArrowRight, Check, ChevronDown, Crown, HeartHandshake, Lightbulb, Minus, Sparkles, Swords,
} from 'lucide-react'
import clsx from 'clsx'

export const metadata = {
  title: 'Plan Premium',
  description: 'Cómo sería un plan de apoyo a PokeHub. Hoy no está activo: todo es gratis.',
}

type Availability = 'yes' | 'no' | 'idea'

// Sólo funciones que existen hoy en la app, más las ideas del plan Campeón
// marcadas como tales: nada de prometer lo que no está hecho.
const FEATURES: { label: string; free: Availability; champion: Availability }[] = [
  { label: 'Equipos ilimitados en el constructor', free: 'yes', champion: 'yes' },
  { label: 'Análisis de tipos y estadísticas del equipo', free: 'yes', champion: 'yes' },
  { label: 'Importar y exportar a Showdown', free: 'yes', champion: 'yes' },
  { label: 'Feed, «me gusta» y comentarios', free: 'yes', champion: 'yes' },
  { label: 'Mensajes directos', free: 'yes', champion: 'yes' },
  { label: 'Medallas de entrenador', free: 'yes', champion: 'yes' },
  { label: 'Tema claro Pokéball y oscuro Master Ball', free: 'yes', champion: 'yes' },
  { label: 'Insignia de Campeón junto a tu nombre', free: 'no', champion: 'idea' },
  { label: 'Estadísticas de uso de tus equipos', free: 'no', champion: 'idea' },
  { label: 'Equipos privados y borradores', free: 'no', champion: 'idea' },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: '¿Puedo contratar Premium?',
    a: (
      <>
        No. PokeHub es un proyecto personal sin ánimo de lucro y los planes de pago no están activos: no hay
        pasarela de pago y en ningún sitio de la app se piden datos bancarios. Los botones de esta página están
        desactivados a propósito.
      </>
    ),
  },
  {
    q: '¿Me va a costar algo usar PokeHub?',
    a: (
      <>
        No. Todo lo que hoy ves en PokeHub es gratis y sin límites de equipos: crear y analizar equipos,
        compartirlos, comentar, seguir a otros entrenadores y chatear.
      </>
    ),
  },
  {
    q: 'Entonces, ¿para qué sirve esta página?',
    a: (
      <>
        Es una maqueta de cómo podría organizarse un plan de apoyo si el proyecto creciera. Por eso el plan Campeón
        no tiene precio y sus ventajas propias aparecen como ideas, no como funciones terminadas.
      </>
    ),
  },
  {
    q: '¿Cómo puedo apoyar el proyecto?',
    a: (
      <>
        Usándolo: publica tus equipos, comenta los de otros entrenadores e invita a tu grupo de juego. Una comunidad
        activa es lo que de verdad hace crecer PokeHub.
      </>
    ),
  },
  {
    q: '¿Dónde está la información sobre mis datos?',
    a: (
      <>
        En el{' '}
        <Link href="/legal#privacidad" className="font-semibold text-brand underline underline-offset-2">
          aviso legal y de privacidad
        </Link>
        , con la lista exacta de lo que se guarda en tu navegador.
      </>
    ),
  },
]

export default function PremiumPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-3 sm:px-4 md:pt-4">
      <Hero />

      <section id="planes" aria-labelledby="planes-titulo" className="mt-10 scroll-mt-4 sm:mt-12">
        <SectionHeading
          id="planes-titulo"
          eyebrow="Planes"
          title="Elige cómo entrenar"
          description="Uno está disponible hoy para todo el mundo. El otro es sólo una idea."
        />
        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 md:gap-5">
          <FreePlan />
          <ChampionPlan />
        </div>
      </section>

      <section id="comparativa" aria-labelledby="comparativa-titulo" className="mt-12 scroll-mt-4 sm:mt-14">
        <SectionHeading
          id="comparativa-titulo"
          eyebrow="Comparativa"
          title="Qué incluye cada plan"
          description="Todo lo marcado como disponible funciona ya en PokeHub, gratis."
        />
        <ComparisonTable />
      </section>

      <section id="preguntas" aria-labelledby="preguntas-titulo" className="mt-12 scroll-mt-4 sm:mt-14">
        <SectionHeading id="preguntas-titulo" eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-3">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              className="extras-faq card stagger-item group"
              style={{ '--i': i } as React.CSSProperties}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-[15px] font-bold">
                {item.q}
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted shadow-card transition-colors group-open:bg-brand group-open:text-brand-fg"
                >
                  <ChevronDown size={17} className="extras-faq-chevron" />
                </span>
              </summary>
              <div className="extras-faq-body px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">Mientras tanto, todo está a tu alcance.</p>
        <Link href="/team/new" className="btn btn-primary btn-lg">
          <Swords aria-hidden size={18} />
          Crear un equipo
        </Link>
      </div>
    </div>
  )
}

/* ---------------------------------- Piezas ---------------------------------- */

function Hero() {
  return (
    <header className="extras-premium-hero extras-on-brand relative isolate animate-fade-up overflow-hidden rounded-[1.75rem] px-6 py-10 text-white shadow-float sm:px-10 sm:py-14 lg:px-14">
      <HeroArt />

      <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/30 backdrop-blur">
        <HeartHandshake aria-hidden size={15} className="shrink-0" />
        Proyecto personal sin ánimo de lucro
      </p>

      <h1 className="mt-4 max-w-xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
        PokeHub <span className="extras-premium-word">Premium</span>
      </h1>
      <p className="mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-white/90 sm:text-base">
        Así sería un plan para apoyar PokeHub. Hoy no está activo: todo lo que ves en la app es gratis y aquí no se
        cobra nada.
      </p>

      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <a href="#planes" className="btn btn-lg bg-white text-[#1b1320] shadow-card hover:bg-white/90">
          Ver los planes
          <ArrowDown aria-hidden size={18} />
        </a>
        <a href="#preguntas" className="btn btn-lg bg-white/10 text-white ring-1 ring-white/40 hover:bg-white/20">
          Preguntas frecuentes
        </a>
      </div>
    </header>
  )
}

/** Pokéballs en trazo y destellos: decoración de la cabecera. */
function HeroArt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="extras-premium-ball absolute -right-16 -top-10 size-72 text-white/20 sm:-right-10 sm:size-96"
      >
        <circle cx="50" cy="50" r="46" />
        <path d="M4 50h31M65 50h31" />
        <circle cx="50" cy="50" r="15" />
        <circle cx="50" cy="50" r="7" />
      </svg>
      <Sparkles className="extras-premium-spark absolute right-[30%] top-10 size-6 text-white/70" />
      <Sparkles className="extras-premium-spark absolute bottom-10 right-[12%] size-8 text-white/60 [animation-delay:1.1s]" />
      <Sparkles className="extras-premium-spark absolute right-[44%] bottom-6 hidden size-4 text-white/60 [animation-delay:.6s] sm:block" />
    </div>
  )
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 id={id} className="mt-1.5 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mx-auto mt-2 max-w-lg text-pretty text-sm text-muted">{description}</p>}
    </div>
  )
}

function PlanFeature({ children, idea = false }: { children: React.ReactNode; idea?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={clsx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
          idea ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
        )}
      >
        {idea ? <Lightbulb size={12} strokeWidth={2.6} /> : <Check size={12} strokeWidth={3.2} />}
      </span>
      <span className="min-w-0">
        {children}
        {idea && <span className="sr-only"> (idea, aún sin desarrollar)</span>}
      </span>
    </li>
  )
}

function FreePlan() {
  return (
    <article aria-labelledby="plan-entrenador" className="card stagger-item flex h-full flex-col p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="plan-entrenador" className="text-lg font-extrabold">
            Entrenador
          </h3>
          <p className="mt-0.5 text-sm text-muted">Todo PokeHub, para todo el mundo.</p>
        </div>
        <span className="extras-ink-success inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Activo
        </span>
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight">Gratis</span>
        <span className="text-sm text-muted">sin límite de tiempo</span>
      </p>

      <ul className="mt-6 flex flex-col gap-2.5 text-sm">
        <PlanFeature>Equipos ilimitados, con análisis de tipos</PlanFeature>
        <PlanFeature>Importar y exportar a Showdown</PlanFeature>
        <PlanFeature>Feed, «me gusta», comentarios y seguidores</PlanFeature>
        <PlanFeature>Mensajes directos con otros entrenadores</PlanFeature>
        <PlanFeature>Medallas y tema oscuro Master Ball</PlanFeature>
      </ul>

      <div className="mt-auto pt-7">
        <Link href="/team/new" className="btn btn-soft w-full">
          Seguir entrenando
          <ArrowRight aria-hidden size={17} />
        </Link>
      </div>
    </article>
  )
}

function ChampionPlan() {
  return (
    <article
      aria-labelledby="plan-campeon"
      style={{ '--i': 1 } as React.CSSProperties}
      className="extras-plan-featured stagger-item relative flex h-full flex-col rounded-card p-6 shadow-float sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="plan-campeon" className="flex items-center gap-2 text-lg font-extrabold">
            <Crown aria-hidden size={19} className="text-warning" />
            Campeón
          </h3>
          <p className="mt-0.5 text-sm text-muted">Para quien quiera apoyar el proyecto.</p>
        </div>
        <span className="extras-ink-brand inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold">
          <Sparkles aria-hidden size={13} />
          Próximamente
        </span>
      </div>

      <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-4xl font-extrabold tracking-tight">Sin precio</span>
        <span className="text-sm text-muted">no está a la venta</span>
      </p>

      <ul className="mt-6 flex flex-col gap-2.5 text-sm">
        <PlanFeature>Todo lo del plan Entrenador</PlanFeature>
        <PlanFeature idea>Insignia de Campeón junto a tu nombre</PlanFeature>
        <PlanFeature idea>Estadísticas de uso de tus equipos</PlanFeature>
        <PlanFeature idea>Equipos privados y borradores</PlanFeature>
      </ul>

      <div className="mt-auto pt-7">
        <button type="button" disabled className="btn btn-primary w-full">
          Próximamente
        </button>
        <p className="mt-2.5 text-center text-xs text-muted">Los planes de pago no están activos. No se cobra nada.</p>
      </div>
    </article>
  )
}

function Mark({ value, plan }: { value: Availability; plan: string }) {
  if (value === 'yes') {
    return (
      <span className="inline-grid size-7 place-items-center rounded-full bg-success-soft text-success">
        <Check aria-hidden size={15} strokeWidth={3} />
        <span className="sr-only">Incluido en {plan}</span>
      </span>
    )
  }
  if (value === 'idea') {
    return (
      <span className="extras-ink-warning inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-[11px] font-bold">
        <Lightbulb aria-hidden size={12} strokeWidth={2.6} />
        Idea
        <span className="sr-only"> para {plan}, aún sin desarrollar</span>
      </span>
    )
  }
  return (
    <span className="inline-grid size-7 place-items-center text-muted/70">
      <Minus aria-hidden size={16} />
      <span className="sr-only">No incluido en {plan}</span>
    </span>
  )
}

function ComparisonTable() {
  return (
    <div className="card mx-auto mt-6 max-w-3xl overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Comparativa de los planes Entrenador y Campeón</caption>
        <thead>
          <tr className="bg-surface-2 text-left">
            <th scope="col" className="px-4 py-3 text-xs font-semibold text-muted sm:px-6 sm:text-sm">
              Función
            </th>
            <th scope="col" className="w-[5.5rem] px-2 py-3 text-center text-xs font-bold sm:w-36 sm:text-sm">
              Entrenador
            </th>
            <th scope="col" className="w-[5.5rem] px-2 py-3 text-center text-xs font-bold sm:w-36 sm:text-sm">
              <span className="inline-flex items-center gap-1">
                <Crown aria-hidden size={14} className="hidden text-warning sm:block" />
                Campeón
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feature) => (
            <tr key={feature.label} className="border-t border-line transition-colors hover:bg-surface-2/60">
              <th scope="row" className="px-4 py-3 text-left font-medium leading-snug sm:px-6">
                {feature.label}
              </th>
              <td className="px-2 py-3 text-center">
                <Mark value={feature.free} plan="Entrenador" />
              </td>
              <td className="px-2 py-3 text-center">
                <Mark value={feature.champion} plan="Campeón" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-surface-2 px-4 py-3 text-xs text-muted sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <Check aria-hidden size={13} strokeWidth={3} className="text-success" /> Disponible hoy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb aria-hidden size={13} className="text-warning" /> Idea: pensada, pero sin desarrollar
        </span>
      </p>
    </div>
  )
}
