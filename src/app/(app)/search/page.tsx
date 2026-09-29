import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Swords, Users } from 'lucide-react'
import { requireProfile } from '@/lib/session'
import { cleanQuery, parseTipo, searchHref, type SearchTipo } from '@/lib/search'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { SearchHero } from '@/components/search/search-hero'
import { SearchTips } from '@/components/search/search-tips'
import { TeamResults, TrainerResults } from '@/components/search/results'
import { PopularPokemonCard, PopularPokemonSection } from '@/components/search/popular-section'
import {
  PopularCardSkeleton,
  PopularRowSkeleton,
  SEARCH_GRID,
  SEARCH_MAIN,
  SEARCH_RAIL,
  TeamListSkeleton,
  TrainerListSkeleton,
} from '@/components/search/skeletons'

type SearchParams = Promise<{ q?: string | string[]; tipo?: string | string[] }>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams
  const term = cleanQuery(params.q)
  const what = parseTipo(params.tipo)
  return { title: term ? `«${term}» en ${what}` : `Buscar ${what}` }
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const term = cleanQuery(params.q)
  const tipo = parseTipo(params.tipo)
  const { userId } = await requireProfile()

  return (
    // Misma rejilla que loading.tsx (constantes de skeletons.tsx).
    <div className={SEARCH_GRID}>
      <div className={SEARCH_MAIN}>
        <SearchHero term={term} tipo={tipo} />

        <SegmentedTabs
          ariaLabel="Qué buscar"
          // Como en la portada: en móvil se quedan flotando bajo la cabecera; en
          // md+ no, porque la pokéball que cuelga de ella caería encima.
          className="sticky top-[calc(var(--header-h)+8px)] z-20 mt-3 max-md:shadow-float md:static"
          items={[
            {
              href: searchHref({ q: term, tipo: 'entrenadores' }),
              active: tipo === 'entrenadores',
              label: <TabLabel icon={<Users size={15} aria-hidden />}>Entrenadores</TabLabel>,
            },
            {
              href: searchHref({ q: term, tipo: 'equipos' }),
              active: tipo === 'equipos',
              label: <TabLabel icon={<Swords size={15} aria-hidden />}>Equipos</TabLabel>,
            },
          ]}
        />

        {/* Sin término, los Pokémon populares son otra forma de empezar: van arriba. */}
        {!term && (
          <Suspense fallback={<PopularRowSkeleton className="mt-6" />}>
            <PopularPokemonSection className="mt-6" />
          </Suspense>
        )}

        {/* La key hace que cada búsqueda nueva enseñe su esqueleto en vez de los resultados viejos. */}
        <div className="mt-6">
          <Suspense key={`${tipo}:${term}`} fallback={<ResultsSkeleton tipo={tipo} searching={Boolean(term)} />}>
            {tipo === 'equipos' ? (
              <TeamResults term={term} userId={userId} />
            ) : (
              <TrainerResults term={term} userId={userId} />
            )}
          </Suspense>
        </div>

        {/* Por debajo de lg no hay columna lateral: su contenido baja aquí. */}
        <div className="mt-8 flex flex-col gap-6 lg:hidden">
          {term && (
            <Suspense fallback={<PopularRowSkeleton />}>
              <PopularPokemonSection />
            </Suspense>
          )}
          <SearchTips />
        </div>
      </div>

      <aside aria-label="Descubrir" className="hidden lg:block">
        <div className={SEARCH_RAIL}>
          <SearchTips />
          <Suspense fallback={<PopularCardSkeleton />}>
            <PopularPokemonCard />
          </Suspense>
        </div>
      </aside>
    </div>
  )
}

function TabLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  )
}

function ResultsSkeleton({ tipo, searching }: { tipo: SearchTipo; searching: boolean }) {
  if (tipo === 'equipos') {
    return <TeamListSkeleton label={searching ? 'Buscando equipos…' : 'Cargando equipos destacados…'} />
  }
  return <TrainerListSkeleton label={searching ? 'Buscando entrenadores…' : 'Cargando sugerencias…'} />
}
