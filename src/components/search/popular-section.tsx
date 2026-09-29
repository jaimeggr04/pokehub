import clsx from 'clsx'
import { Flame } from 'lucide-react'
import { getPopularPokemon } from '@/components/search/data'
import { PopularPokemonList } from '@/components/search/popular-pokemon'

// En la columna lateral caben tres filas de tres sin que haga falta scroll en
// una pantalla normal; el carrusel móvil enseña los doce.
const RAIL_LIMIT = 9

function sampleLabel(sampled: number) {
  return `los últimos ${sampled} ${sampled === 1 ? 'equipo público' : 'equipos públicos'}`
}

/** Tarjeta de la columna lateral (lg+). Sin datos no ocupa sitio. */
export async function PopularPokemonCard() {
  const snapshot = await getPopularPokemon()
  if (!snapshot || snapshot.pokemon.length === 0) return null

  return (
    <section aria-labelledby="search-popular-rail" className="card p-4">
      <h2 id="search-popular-rail" className="flex items-center gap-2 text-sm font-bold">
        <Flame size={16} aria-hidden className="text-brand" />
        Pokémon populares
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Los más usados en {sampleLabel(snapshot.sampled)}. Pulsa uno para ver sus equipos.
      </p>
      <PopularPokemonList pokemon={snapshot.pokemon.slice(0, RAIL_LIMIT)} variant="grid" className="mt-1" />
    </section>
  )
}

/** Sección de la columna principal por debajo de lg, donde no hay lateral. */
export async function PopularPokemonSection({ className }: { className?: string }) {
  const snapshot = await getPopularPokemon()
  if (!snapshot || snapshot.pokemon.length === 0) return null

  return (
    <section aria-labelledby="search-popular-main" className={clsx('lg:hidden', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2
          id="search-popular-main"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"
        >
          <Flame size={14} aria-hidden className="text-brand" />
          Pokémon populares
        </h2>
        <p className="text-[11px] text-muted">En {sampleLabel(snapshot.sampled)}</p>
      </div>
      <PopularPokemonList pokemon={snapshot.pokemon} variant="row" className="mt-1" />
    </section>
  )
}
