import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'

export const metadata = { title: 'Plan Premium' }

const PLANS = [
  {
    name: 'Entrenador',
    price: 'Gratis',
    highlight: false,
    features: ['Equipos ilimitados', 'Feed y comentarios', 'Chat con otros entrenadores', 'Importar y exportar a Showdown'],
  },
  {
    name: 'Campeón',
    price: '4,99 €/mes',
    highlight: true,
    features: [
      'Todo lo del plan Entrenador',
      'Insignia de campeón en tu perfil',
      'Estadísticas de uso de tus equipos',
      'Equipos privados y borradores',
      'Sin límite de historial de chat',
    ],
  },
]

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-[820px] px-3 sm:px-4">
      <header className="mb-6 text-center">
        <Sparkles className="mx-auto mb-2 text-brand" size={30} />
        <h1 className="text-3xl font-extrabold">PokeHub Premium</h1>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
          PokeHub es un proyecto personal sin ánimo de lucro: los planes de pago aún no están
          activos. Esta página muestra cómo se ofrecerían.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => (
          <section
            key={p.name}
            className={`rounded-card border p-6 shadow-card ${
              p.highlight ? 'border-brand bg-surface ring-2 ring-[var(--brand)]' : 'border-line bg-surface'
            }`}
          >
            <h2 className="text-lg font-extrabold">{p.name}</h2>
            <p className="mb-4 text-2xl font-extrabold text-brand">{p.price}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-xl bg-surface-2 py-2.5 text-sm font-semibold text-muted"
            >
              Próximamente
            </button>
          </section>
        ))}
      </div>

      <Link href="/home" className="mt-6 block text-center text-sm font-semibold text-muted hover:text-brand">
        Volver al inicio
      </Link>
    </div>
  )
}
