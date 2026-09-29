import { Suspense } from 'react'
import { Search, Swords, Users } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBox } from '@/components/search-box'
import { getCommunityStats } from '@/components/search/data'
import type { SearchTipo } from '@/lib/search'

const COPY: Record<SearchTipo, { noun: string; description: string }> = {
  entrenadores: {
    noun: 'entrenadores',
    description: 'Por nombre o por usuario. Síguelos y verás sus equipos en tu inicio.',
  },
  equipos: {
    noun: 'equipos',
    description: 'Por nombre del equipo o por los Pokémon que lleva, también en español.',
  },
}

/**
 * Cabecera de /search: título según la pestaña, la comunidad en cifras y el
 * cuadro de búsqueda. Misma geometría que SearchHeroSkeleton (sin las pestañas,
 * que van fuera para poder quedarse pegadas bajo la cabecera en móvil).
 */
export function SearchHero({ term, tipo }: { term: string; tipo: SearchTipo }) {
  const copy = COPY[tipo]

  return (
    <header className="search-hero">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        <Search size={13} strokeWidth={2.75} aria-hidden className="text-brand" />
        Buscar
      </p>
      <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
        Encuentra <span className="text-gradient-brand">{copy.noun}</span>
      </h1>
      <p className="mt-1.5 text-sm text-muted">{copy.description}</p>

      <Suspense fallback={<StatsSkeleton />}>
        <CommunityStats />
      </Suspense>

      {/* Sin término, el campo espera a que se escriba; con él, se deja leer el resultado. */}
      <SearchBox size="lg" tipo={tipo} defaultValue={term} autoFocus={!term} className="mt-5" />
    </header>
  )
}

function StatsSkeleton() {
  return (
    <div aria-hidden className="mt-3 flex gap-2">
      <Skeleton className="h-7 w-36 rounded-full" />
      <Skeleton className="h-7 w-32 rounded-full" />
    </div>
  )
}

async function CommunityStats() {
  const stats = await getCommunityStats()
  // Sin cifras se queda el hueco: mejor que un salto del cuadro de búsqueda.
  if (!stats) return <div aria-hidden className="mt-3 h-7" />

  const chips = [
    // «equipos» a secas: sólo los públicos se pueden buscar, y en 360 px caben las dos cifras en una fila.
    { icon: Swords, value: stats.teams, label: stats.teams === 1 ? 'equipo' : 'equipos' },
    { icon: Users, value: stats.trainers, label: stats.trainers === 1 ? 'entrenador' : 'entrenadores' },
  ]

  return (
    <ul aria-label="La comunidad en cifras" className="mt-3 flex flex-wrap gap-2">
      {chips.map(({ icon: Icon, value, label }) => (
        <li
          key={label}
          className="inline-flex h-7 animate-fade-in items-center gap-1.5 rounded-full bg-surface px-3 text-xs text-muted shadow-card"
        >
          <Icon size={13} aria-hidden className="text-brand" />
          <AnimatedNumber value={value} countUp className="font-bold text-ink" />
          {label}
        </li>
      ))}
    </ul>
  )
}
