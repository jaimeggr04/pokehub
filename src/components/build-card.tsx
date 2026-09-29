'use client'

import { useId } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import { CryButton } from '@/components/cry-button'
import { MoveList } from '@/components/move-list'
import {
  GenderMark, HeroBall, ItemIcon, NatureShift, PokemonArt, ShinyChip, ShinySparkles, SpreadLines,
  buildEvs, finalStats, natureShift, typeTint, usePokemonData, type StatRecord,
} from '@/components/pokemon-details'
import { statScaleMax } from '@/components/stat-radar'
import { TeraBadge, TypeBadge } from '@/components/type-badge'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import {
  STAT_KEYS, STAT_LABELS, STAT_NAMES_ES, dexNumber, prettify, statBarPercent, statColor,
} from '@/lib/pokemon'
import type { PokemonDetail } from '@/lib/pokeapi'
import type { BuildRow } from '@/lib/database.types'

/**
 * Ficha de un Pokémon en la página del equipo. Misma estética que el detalle
 * del feed: cabecera teñida con su tipo, chapas, objeto/habilidad/naturaleza,
 * movimientos y barras de stats con el reparto de EVs en formato Showdown.
 * `index` sólo escalona la entrada; por defecto se usa el hueco del equipo.
 */
export function BuildCard({ build, index }: { build: BuildRow; index?: number }) {
  const { species, speciesFailed, moves } = usePokemonData(build.pokemon_id, build.moves)
  const headingId = useId()
  const name = build.nickname || prettify(build.pokemon_name)
  const finals = finalStats(build, species)
  // Las formas (id >= 10000) necesitan la ficha para saber su nº de especie.
  const dex = species?.speciesId ?? (build.pokemon_id < 10000 ? build.pokemon_id : null)

  return (
    <article
      aria-labelledby={headingId}
      className="card card-hover stagger-item overflow-hidden"
      style={{ ...typeTint(species?.types), '--i': index ?? build.slot } as React.CSSProperties}
    >
      {/* Cabecera teñida */}
      <div className="pokemon-hero pokemon-shiny-host group flex items-center gap-3 border-x-0 border-t-0 p-3 sm:gap-4 sm:p-4">
        <HeroBall className="pokemon-hero-ball pointer-events-none absolute -right-8 -top-10 h-36 w-36" />

        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <PokemonArt
            pokemonId={build.pokemon_id}
            shiny={build.shiny}
            alt={prettify(build.pokemon_name)}
            className="h-full w-full transition-[scale,rotate] duration-500 ease-(--ease-spring) group-hover:-rotate-3 group-hover:scale-110"
          />
          {build.shiny && <ShinySparkles />}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id={headingId} className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
                <span className="truncate">{name}</span>
                <GenderMark gender={build.gender} size={16} />
              </h2>
              <p className="mt-0.5 min-h-4 truncate text-xs font-semibold text-muted">
                {build.nickname && `${prettify(build.pokemon_name)} · `}
                {dex && dexNumber(dex)}
              </p>
            </div>
            <CryButton src={species?.cry} name={name} size="sm" className="-mr-1 -mt-1" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-5 items-center rounded-md bg-surface-2 px-1.5 text-[10px] font-bold uppercase tracking-wide shadow-card">
              Nv. {build.level}
            </span>
            {species
              ? species.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)
              : !speciesFailed && <Skeleton className="h-5 w-14 rounded-md" />}
            {build.tera_type && <TeraBadge type={build.tera_type} size="sm" />}
            {build.shiny && <ShinyChip size="sm" />}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-3 sm:p-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <InfoCell
            label="Objeto"
            value={build.item ? prettify(build.item) : 'Sin objeto'}
            icon={<ItemIcon item={build.item} size="sm" />}
            className="col-span-2 sm:col-span-1"
          />
          <InfoCell label="Habilidad" value={prettify(build.ability)} />
          <InfoCell
            label="Naturaleza"
            value={prettify(build.nature)}
            extra={<NatureShift nature={build.nature} />}
          />
        </dl>

        <MoveList names={build.moves} details={moves} compact />

        <CompactStats build={build} species={species} finals={finals} failed={speciesFailed} name={name} />
      </div>
    </article>
  )
}

function InfoCell({
  label,
  value,
  icon,
  extra,
  className,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  extra?: React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx('pokemon-wash flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2', className)}>
      {icon}
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
        <dd className="truncate text-sm font-semibold" title={value}>
          {value}
        </dd>
        {extra && <dd className="text-[11px]">{extra}</dd>}
      </div>
    </div>
  )
}

/** Barras compactas: en móvil una columna, desde sm dos columnas de tres. */
function CompactStats({
  build,
  species,
  finals,
  failed,
  name,
}: {
  build: BuildRow
  species: PokemonDetail | null
  finals: StatRecord | null
  failed: boolean
  name: string
}) {
  const shift = natureShift(build.nature)
  const evs = buildEvs(build)
  const max = statScaleMax(build.level, finals)
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-xs font-bold uppercase tracking-wider text-muted">
          Estadísticas <span className="sr-only">de {name}</span>
        </h3>
        {species && (
          <span className="text-xs text-muted">
            Total base{' '}
            <AnimatedNumber
              value={STAT_KEYS.reduce((a, k) => a + species.baseStats[k], 0)}
              compact={false}
              countUp
              className="font-bold text-ink"
            />
          </span>
        )}
      </div>

      <div className="pokemon-wash rounded-xl p-3">
        {failed && <p className="mb-2 text-xs text-muted">No se pudieron cargar las estadísticas base.</p>}
        <ul className="grid gap-x-6 gap-y-2 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3">
          {STAT_KEYS.map((k, i) => {
            const up = shift?.[0] === k
            const down = shift?.[1] === k
            const total = finals?.[k]
            const base = species?.baseStats[k]
            return (
              <li key={k} className="grid grid-cols-[3.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 text-xs">
                <span
                  className={clsx(
                    'flex items-center gap-1 font-semibold',
                    up ? 'text-success' : down ? 'text-danger' : 'text-muted',
                  )}
                >
                  <abbr title={STAT_NAMES_ES[k]} className="no-underline">
                    {STAT_LABELS[k]}
                  </abbr>
                  {up && <ArrowUp aria-hidden size={11} strokeWidth={3} />}
                  {down && <ArrowDown aria-hidden size={11} strokeWidth={3} />}
                  {(up || down) && <span className="sr-only">{up ? '(la naturaleza la sube)' : '(la naturaleza la baja)'}</span>}
                  {evs[k] > 0 && (
                    <span title={`${evs[k]} EV`} className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand">
                      <span className="sr-only">({evs[k]} EV)</span>
                    </span>
                  )}
                </span>
                <span aria-hidden className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                  {total !== undefined && base !== undefined && (
                    <span
                      className="pokemon-stat-fill block h-full rounded-full"
                      style={
                        {
                          width: `${statBarPercent(total, max)}%`,
                          backgroundColor: statColor(base),
                          '--i': i,
                        } as React.CSSProperties
                      }
                    />
                  )}
                </span>
                <span className={clsx('text-right font-extrabold tabular-nums', up && 'text-success', down && 'text-danger')}>
                  {total ?? '—'}
                </span>
              </li>
            )
          })}
        </ul>
        <SpreadLines build={build} className="mt-3 border-t border-line/70 pt-2.5" />
      </div>
    </section>
  )
}
