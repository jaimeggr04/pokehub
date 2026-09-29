import Image from 'next/image'
import Link from 'next/link'
import clsx from 'clsx'
import { prettify, spriteUrl } from '@/lib/pokemon'
import { searchHref } from '@/lib/search'
import type { PopularPokemon } from '@/components/search/data'

const MEDALS = ['oro', 'plata', 'bronce']

/**
 * Pokémon más usados como fichas que lanzan la búsqueda de equipos con ellos.
 * `row`: carrusel horizontal en móvil que pasa a rejilla de 6 en tablet.
 * `grid`: rejilla de 3 para la columna lateral.
 */
export function PopularPokemonList({
  pokemon,
  variant,
  className,
}: {
  pokemon: PopularPokemon[]
  variant: 'row' | 'grid'
  className?: string
}) {
  const max = Math.max(1, ...pokemon.map((p) => p.teams))

  return (
    <ol
      className={clsx(
        variant === 'row'
          ? 'no-scrollbar -mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-3 pt-2 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0 sm:pb-0'
          : 'grid grid-cols-3 gap-2 pt-2',
        className,
      )}
    >
      {pokemon.map((p, i) => {
        const label = prettify(p.name)
        const medal = MEDALS[i]
        const teams = `${p.teams} ${p.teams === 1 ? 'equipo' : 'equipos'}`
        return (
          <li key={p.name} className={clsx(variant === 'row' && 'w-[5.75rem] shrink-0 snap-start sm:w-auto')}>
            <Link
              href={searchHref({ q: label, tipo: 'equipos' })}
              aria-label={`${label}${medal ? `, puesto ${i + 1}` : ''}: en ${teams}. Buscar equipos con ${label}`}
              title={`Equipos con ${label}`}
              style={{ '--i': i, '--share': p.teams / max } as React.CSSProperties}
              className="search-poke stagger-item card-hover pressable relative flex h-full flex-col items-center rounded-2xl bg-surface-2 px-1.5 pb-2.5 pt-1.5 text-center shadow-card"
            >
              {medal && (
                <span aria-hidden data-medal={medal} className="search-medal">
                  {i + 1}
                </span>
              )}
              <span className="search-poke-stage relative block aspect-square w-full">
                <Image
                  src={spriteUrl(p.id)}
                  alt=""
                  width={96}
                  height={96}
                  unoptimized
                  draggable={false}
                  className="search-poke-sprite pointer-events-none absolute inset-0 size-full object-contain"
                />
              </span>
              <span className="w-full truncate text-xs font-bold leading-tight">{label}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-muted tabular-nums">{teams}</span>
              <span aria-hidden className="mt-2 block h-1 w-4/5 overflow-hidden rounded-full bg-line/70">
                <span className="search-poke-meter block h-full rounded-full bg-brand" />
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
