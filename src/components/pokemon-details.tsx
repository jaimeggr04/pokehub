'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowRight, ArrowUp, Backpack, Crown, Mars, Sparkles, Venus, X } from 'lucide-react'
import clsx from 'clsx'
import { CryButton } from '@/components/cry-button'
import { MoveList } from '@/components/move-list'
import { StatRadar, statScaleMax } from '@/components/stat-radar'
import { TeraBadge, TypeBadge } from '@/components/type-badge'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getMoves, getPokemon, getSpeciesInfo,
  type MoveDetail, type PokemonDetail, type SpeciesInfo,
} from '@/lib/pokeapi'
import {
  NATURES, STAT_KEYS, STAT_LABELS, STAT_NAMES_ES, TYPE_COLORS,
  artworkUrl, computeStat, dexNumber, evSpread, itemSpriteUrl, ivSpread, prettify,
  shinyArtworkUrl, spriteUrl, statBarPercent, statColor, type StatKey,
} from '@/lib/pokemon'
import type { BuildRow, Gender } from '@/lib/database.types'

export type StatRecord = Record<StatKey, number>

export function buildIvs(b: BuildRow): StatRecord {
  return { hp: b.hp_ivs, atk: b.atk_ivs, def: b.def_ivs, spa: b.spa_ivs, spd: b.spd_ivs, spe: b.spe_ivs }
}

export function buildEvs(b: BuildRow): StatRecord {
  return { hp: b.hp_evs, atk: b.atk_evs, def: b.def_evs, spa: b.spa_evs, spd: b.spd_evs, spe: b.spe_evs }
}

/** Stats finales del set, o null mientras no hay stats base. */
export function finalStats(b: BuildRow, species: PokemonDetail | null): StatRecord | null {
  if (!species) return null
  const ivs = buildIvs(b)
  const evs = buildEvs(b)
  const out = {} as StatRecord
  for (const k of STAT_KEYS) out[k] = computeStat(k, species.baseStats[k], ivs[k], evs[k], b.level, b.nature)
  return out
}

/** [sube, baja] de la naturaleza, o null si es neutra o no hay. */
export function natureShift(nature: string | null | undefined): [StatKey, StatKey] | null {
  return nature ? (NATURES[nature.toLowerCase()] ?? null) : null
}

/** Colores del tipo principal y secundario para teñir la cabecera. */
export function typeTint(types: string[] | undefined) {
  const first = (TYPE_COLORS[types?.[0] ?? ''] ?? TYPE_COLORS.unknown).bg
  const second = types?.[1] ? (TYPE_COLORS[types[1]] ?? TYPE_COLORS.unknown).bg : first
  return { '--pokemon-tint': first, '--pokemon-tint-2': second } as React.CSSProperties
}

/* ---------- Datos ---------- */

type Loaded<T> = { key: string; value: T | null; failed: boolean }

/**
 * Ficha, movimientos y (opcional) datos de especie de un Pokémon. Cada
 * resultado se guarda con la clave que lo pidió: si cambia el Pokémon, lo
 * anterior deja de mostrarse al instante en vez de parpadear con datos viejos.
 * La caché y la deduplicación viven en lib/pokeapi.
 */
export function usePokemonData(
  pokemonId: number,
  moveNames: (string | null | undefined)[],
  { withSpecies = false }: { withSpecies?: boolean } = {},
) {
  const idKey = String(pokemonId)
  const movesKey = moveNames.filter(Boolean).join('|')
  const [pokemon, setPokemon] = useState<Loaded<PokemonDetail> | null>(null)
  const [moves, setMoves] = useState<Loaded<MoveDetail[]> | null>(null)
  const [info, setInfo] = useState<Loaded<SpeciesInfo> | null>(null)

  useEffect(() => {
    let alive = true
    const key = String(pokemonId)
    getPokemon(pokemonId).then(
      (value) => {
        if (alive) setPokemon({ key, value, failed: false })
      },
      () => {
        if (alive) setPokemon({ key, value: null, failed: true })
      },
    )
    return () => {
      alive = false
    }
  }, [pokemonId])

  useEffect(() => {
    let alive = true
    // getMoves nunca rechaza: los que fallan vuelven como movimiento "unknown".
    getMoves(movesKey ? movesKey.split('|') : []).then((value) => {
      if (alive) setMoves({ key: movesKey, value, failed: false })
    })
    return () => {
      alive = false
    }
  }, [movesKey])

  useEffect(() => {
    if (!withSpecies) return
    let alive = true
    const key = String(pokemonId)
    getSpeciesInfo(pokemonId).then(
      (value) => {
        if (alive) setInfo({ key, value, failed: false })
      },
      () => {
        if (alive) setInfo({ key, value: null, failed: true })
      },
    )
    return () => {
      alive = false
    }
  }, [pokemonId, withSpecies])

  const pokemonReady = pokemon?.key === idKey
  const infoReady = info?.key === idKey
  return {
    species: pokemonReady ? pokemon.value : null,
    speciesFailed: pokemonReady && pokemon.failed,
    moves: moves?.key === movesKey ? moves.value : null,
    info: infoReady ? info.value : null,
    infoLoading: withSpecies && !infoReady,
  }
}

/* ---------- Piezas visuales ---------- */

/**
 * Arte oficial con el sprite pixelado debajo: el sprite (ligero y casi
 * siempre en caché por el feed) se ve al instante y el arte funde encima
 * cuando llega. Si el arte no existe (algunas formas), se queda el sprite.
 */
export function PokemonArt({
  pokemonId,
  shiny = false,
  alt,
  className,
}: {
  pokemonId: number
  shiny?: boolean
  alt: string
  className?: string
}) {
  const art = shiny ? shinyArtworkUrl(pokemonId) : artworkUrl(pokemonId)
  const [status, setStatus] = useState<{ src: string; ok: boolean } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const loaded = status?.src === art && status.ok
  const failed = status?.src === art && !status.ok

  // Si la imagen se cargó antes de hidratar, onLoad ya no llega. Sólo se mira el
  // caso bueno: si falló antes de hidratar, el sprite de debajo sigue a la vista.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setStatus({ src: art, ok: true })
  }, [art])

  return (
    <div className={clsx('relative', className)}>
      <Image
        src={spriteUrl(pokemonId, shiny)}
        alt={failed ? alt : ''}
        width={96}
        height={96}
        unoptimized
        draggable={false}
        className={clsx(
          'absolute inset-0 m-auto h-3/4 w-3/4 object-contain [image-rendering:pixelated] transition-opacity duration-300',
          loaded && 'opacity-0',
        )}
      />
      {!failed && (
        <Image
          key={art}
          ref={imgRef}
          src={art}
          alt={alt}
          width={475}
          height={475}
          unoptimized
          draggable={false}
          onLoad={() => setStatus({ src: art, ok: true })}
          onError={() => setStatus({ src: art, ok: false })}
          className={clsx(
            'relative h-full w-full object-contain drop-shadow-[0_10px_14px_rgb(0_0_0/0.22)] transition-[opacity,scale] duration-500 ease-(--ease-out-expo)',
            loaded ? 'opacity-100' : 'scale-90 opacity-0',
          )}
        />
      )}
    </div>
  )
}

export function GenderMark({ gender, size = 18, className }: { gender: Gender; size?: number; className?: string }) {
  if (gender === 'unknown') return null
  const male = gender === 'male'
  const Icon = male ? Mars : Venus
  return (
    <span title={male ? 'Macho' : 'Hembra'} className={clsx('inline-flex shrink-0', male ? 'pokemon-male' : 'pokemon-female', className)}>
      <Icon aria-hidden size={size} strokeWidth={2.6} />
      <span className="sr-only">{male ? 'Macho' : 'Hembra'}</span>
    </span>
  )
}

/** Icono del objeto; si el sprite no existe (objetos muy nuevos), una mochila. */
export function ItemIcon({ item, size = 'md' }: { item: string | null; size?: 'sm' | 'md' }) {
  const src = itemSpriteUrl(item)
  const [broken, setBroken] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Carga inmediata (no lazy), así `complete` sin ancho significa roto de verdad
  // y se detecta aunque el error llegase antes de hidratar.
  useEffect(() => {
    const img = imgRef.current
    if (src && img?.complete && img.naturalWidth === 0) setBroken(src)
  }, [src])

  return (
    <span
      aria-hidden
      className={clsx(
        'pokemon-wash grid shrink-0 place-items-center rounded-lg',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
      )}
    >
      {src && broken !== src ? (
        <Image
          ref={imgRef}
          src={src}
          alt=""
          width={30}
          height={30}
          unoptimized
          loading="eager"
          draggable={false}
          onError={() => setBroken(src)}
          className={clsx('object-contain [image-rendering:pixelated]', size === 'sm' ? 'h-6 w-6' : 'h-[30px] w-[30px]')}
        />
      ) : (
        <Backpack size={size === 'sm' ? 14 : 15} className="text-muted" />
      )}
    </span>
  )
}

/** "+Atk −SpA" con los colores de sube/baja; "Neutra" si no cambia nada. */
export function NatureShift({ nature, className }: { nature: string | null | undefined; className?: string }) {
  if (!nature) return null
  const shift = natureShift(nature)
  if (!shift) return <span className={clsx('text-muted', className)}>Neutra</span>
  const [up, down] = shift
  return (
    <span className={clsx('inline-flex items-center gap-1.5 font-semibold tabular-nums', className)}>
      <span className="inline-flex items-center text-success">
        <ArrowUp aria-hidden size={11} strokeWidth={3} />
        <span className="sr-only">Sube </span>
        {STAT_LABELS[up]}
      </span>
      <span className="inline-flex items-center text-danger">
        <ArrowDown aria-hidden size={11} strokeWidth={3} />
        <span className="sr-only">baja </span>
        {STAT_LABELS[down]}
      </span>
    </span>
  )
}

/** Pokéball de trazo para la marca de agua de la cabecera. */
export function HeroBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={5}>
      <circle cx="50" cy="50" r="44" />
      <path d="M6 50h29M65 50h29" />
      <circle cx="50" cy="50" r="15" />
      <circle cx="50" cy="50" r="6" fill="currentColor" stroke="none" />
    </svg>
  )
}

const SPARKLES = [
  { top: '8%', left: '14%', size: 18 },
  { top: '18%', left: '80%', size: 14 },
  { top: '62%', left: '88%', size: 20 },
  { top: '70%', left: '6%', size: 12 },
]

/** Destellos de variocolor: un brillo al aparecer (y al pasar el ratón por el contenedor). */
export function ShinySparkles() {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
          className="pokemon-sparkle pointer-events-none absolute drop-shadow-[0_0_4px_rgb(255_255_255/0.9)]"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, '--i': i } as React.CSSProperties}
        >
          <path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z" fill="#ffd23f" />
        </svg>
      ))}
    </>
  )
}

export function ShinyChip({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-md bg-warning-soft font-bold uppercase tracking-wide text-warning',
        size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]',
        className,
      )}
    >
      <Sparkles aria-hidden size={size === 'sm' ? 11 : 12} strokeWidth={2.5} />
      Variocolor
    </span>
  )
}

/* ---------- Detalle completo (panel lateral y hoja inferior) ---------- */

export function PokemonDetails({
  build,
  teamName,
  onClose,
}: {
  build: BuildRow
  teamName: string | null
  onClose?: () => void
}) {
  const { species, speciesFailed, moves, info, infoLoading } = usePokemonData(build.pokemon_id, build.moves, {
    withSpecies: true,
  })
  const reduceMotion = useReducedMotion()
  const [hopScope, animateHop] = useAnimate<HTMLDivElement>()
  const headingId = useId()
  const statsId = useId()
  const movesId = useId()

  const name = build.nickname || prettify(build.pokemon_name)
  const finals = finalStats(build, species)
  const shift = natureShift(build.nature)
  const dex = info?.dexNumber ?? species?.speciesId ?? null
  const hiddenAbility = species?.abilityDetails.find((a) => a.name === build.ability)?.hidden ?? false

  function hop() {
    if (reduceMotion || !hopScope.current) return
    animateHop(hopScope.current, { y: [0, -16, 0, -5, 0], scale: [1, 1.06, 0.98, 1.01, 1] }, { duration: 0.6, ease: 'easeOut' })
  }

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-5" style={typeTint(species?.types)}>
      {/* Cabecera con el arte */}
      <div className="pokemon-hero pokemon-shiny-host rounded-2xl">
        <HeroBall className="pokemon-hero-ball pointer-events-none absolute -right-12 -top-12 h-48 w-48" />

        <div className="relative z-10 flex items-center justify-between gap-2 p-3">
          {dex ? (
            <span className="glass inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold tabular-nums tracking-wide shadow-card">
              {dexNumber(dex)}
            </span>
          ) : infoLoading ? (
            <Skeleton className="h-7 w-16 rounded-full" />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <CryButton src={species?.cry} name={name} onPlay={hop} />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar detalle"
                title="Cerrar"
                className="glass pressable grid h-10 w-10 place-items-center rounded-full text-ink shadow-card"
              >
                <X aria-hidden size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="relative mx-auto -mt-8 mb-2 aspect-square w-[min(14rem,68%)]">
          <span aria-hidden className="pokemon-release pointer-events-none absolute inset-[8%] rounded-full" />
          <motion.div
            className="relative h-full w-full"
            initial={{ scale: 0.4, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 17, delay: 0.05 }}
          >
            <div ref={hopScope} className="h-full w-full">
              <div className="h-full w-full animate-float">
                <PokemonArt pokemonId={build.pokemon_id} shiny={build.shiny} alt={prettify(build.pokemon_name)} className="h-full w-full" />
              </div>
            </div>
          </motion.div>
          <span
            aria-hidden
            className="absolute bottom-[3%] left-1/2 h-3 w-1/2 -translate-x-1/2 animate-float-shadow rounded-[50%] bg-black/20 blur-[3px] dark:bg-black/45"
          />
          {build.shiny && <ShinySparkles />}
        </div>
      </div>

      {/* Nombre, categoría y chapas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="flex items-center gap-2 text-2xl font-extrabold leading-tight tracking-tight">
              <span className="truncate">{name}</span>
              <GenderMark gender={build.gender} />
            </h2>
            <div className="mt-0.5 flex min-h-5 flex-wrap items-center gap-x-1.5 text-sm text-muted">
              {build.nickname && <span className="font-semibold text-ink">{prettify(build.pokemon_name)}</span>}
              {build.nickname && (info?.genus || infoLoading) && <span aria-hidden>·</span>}
              {info?.genus ? <span>{info.genus}</span> : infoLoading && <Skeleton className="h-3.5 w-28 rounded-full" />}
            </div>
            {teamName && <p className="mt-0.5 truncate text-xs text-muted">Del equipo «{teamName}»</p>}
          </div>
          <span className="pokemon-wash inline-flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl px-2 leading-none">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Nivel</span>
            <span className="mt-1 text-lg font-extrabold tabular-nums">{build.level}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {species
            ? species.types.map((t) => <TypeBadge key={t} type={t} />)
            : !speciesFailed && (
                <>
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                </>
              )}
          {build.tera_type && <TeraBadge type={build.tera_type} />}
          {build.shiny && <ShinyChip />}
          {(info?.legendary || info?.mythical) && (
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-soft px-2 text-[11px] font-bold uppercase tracking-wide text-ink">
              <Crown aria-hidden size={12} strokeWidth={2.5} className="text-brand" />
              {info.mythical ? 'Singular' : 'Legendario'}
            </span>
          )}
        </div>

        {(info?.flavor || infoLoading) && (
          <figure className="pokemon-wash relative overflow-hidden rounded-xl py-3 pl-4 pr-3.5">
            <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-(--pokemon-tint)" />
            <figcaption className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Pokédex</figcaption>
            {info?.flavor ? (
              <blockquote className="animate-fade-in text-[13px] leading-relaxed">{info.flavor}</blockquote>
            ) : (
              <div className="space-y-1.5 py-0.5">
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-4/5 rounded-full" />
              </div>
            )}
          </figure>
        )}
      </div>

      {/* Objeto, habilidad y naturaleza */}
      <dl className="grid grid-cols-2 gap-2">
        <div className="pokemon-wash col-span-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <ItemIcon item={build.item} />
          <div className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Objeto</dt>
            <dd className="truncate text-sm font-semibold">{build.item ? prettify(build.item) : 'Sin objeto'}</dd>
          </div>
        </div>
        <div className="pokemon-wash min-w-0 rounded-xl px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Habilidad</dt>
          <dd className="truncate text-sm font-semibold" title={prettify(build.ability)}>
            {prettify(build.ability)}
          </dd>
          {hiddenAbility && (
            <dd className="mt-0.5">
              <span className="inline-block rounded bg-brand-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide">
                Oculta
              </span>
            </dd>
          )}
        </div>
        <div className="pokemon-wash min-w-0 rounded-xl px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Naturaleza</dt>
          <dd className="truncate text-sm font-semibold">{prettify(build.nature)}</dd>
          <dd className="text-[11px]">
            <NatureShift nature={build.nature} />
          </dd>
        </div>
      </dl>

      {/* Estadísticas */}
      <section aria-labelledby={statsId}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 id={statsId} className="text-xs font-bold uppercase tracking-wider text-muted">
            Estadísticas
          </h3>
          {species && (
            <span className="text-xs text-muted">
              Total base{' '}
              <AnimatedNumber value={STAT_KEYS.reduce((a, k) => a + species.baseStats[k], 0)} compact={false} countUp className="font-bold text-ink" />
            </span>
          )}
        </div>

        <div className="pokemon-wash rounded-2xl p-3">
          {speciesFailed ? (
            <p className="py-6 text-center text-sm text-muted">No se pudieron cargar las estadísticas base.</p>
          ) : (
            <>
              <StatRadar values={finals} level={build.level} up={shift?.[0]} down={shift?.[1]} decorative className="mx-auto max-w-[17rem]" />
              <StatTable build={build} species={species} finals={finals} caption={`Estadísticas de ${name} a nivel ${build.level}`} />
            </>
          )}
          <SpreadLines build={build} className="mt-3 border-t border-line/70 pt-2.5" />
        </div>
      </section>

      {/* Movimientos */}
      <section aria-labelledby={movesId}>
        <h3 id={movesId} className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Movimientos
        </h3>
        <MoveList names={build.moves} details={moves} />
      </section>

      <Link href={`/team/${build.team_id}`} className="btn btn-soft w-full">
        Ver equipo completo
        <ArrowRight aria-hidden size={16} />
      </Link>
    </article>
  )
}

/** Tabla de stats: base, IV, EV, total y barra. Accesible como tabla real. */
export function StatTable({
  build,
  species,
  finals,
  caption,
}: {
  build: BuildRow
  species: PokemonDetail | null
  finals: StatRecord | null
  caption: string
}) {
  const ivs = buildIvs(build)
  const evs = buildEvs(build)
  const shift = natureShift(build.nature)
  const max = statScaleMax(build.level, finals)

  return (
    <table className="mt-2 w-full text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-muted">
          <th scope="col" className="pb-1.5 text-left font-semibold">
            <span className="sr-only">Estadística</span>
          </th>
          <th scope="col" className="pb-1.5 text-right font-semibold">Base</th>
          <th scope="col" className="pb-1.5 text-right font-semibold">IV</th>
          <th scope="col" className="pb-1.5 text-right font-semibold">EV</th>
          <th scope="col" className="pb-1.5 pl-2 text-right font-semibold">Total</th>
          <th scope="col" className="w-[32%] pb-1.5">
            <span className="sr-only">Gráfico</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {STAT_KEYS.map((k, i) => {
          const up = shift?.[0] === k
          const down = shift?.[1] === k
          const tone = up ? 'text-success' : down ? 'text-danger' : undefined
          const base = species?.baseStats[k]
          const total = finals?.[k]
          return (
            <tr key={k}>
              <th scope="row" className="py-[5px] text-left font-semibold">
                <span className={clsx('inline-flex items-center gap-0.5', tone)}>
                  <abbr title={STAT_NAMES_ES[k]} className="no-underline">
                    {STAT_LABELS[k]}
                  </abbr>
                  {up && <ArrowUp aria-hidden size={11} strokeWidth={3} />}
                  {down && <ArrowDown aria-hidden size={11} strokeWidth={3} />}
                  {(up || down) && <span className="sr-only">{up ? ' (la naturaleza la sube)' : ' (la naturaleza la baja)'}</span>}
                </span>
              </th>
              <td className="text-right tabular-nums text-muted">{base ?? '—'}</td>
              <td
                className={clsx('text-right tabular-nums', ivs[k] < 31 ? 'font-semibold text-warning' : 'text-muted')}
                title={ivs[k] < 31 ? 'IV no perfecto' : undefined}
              >
                {ivs[k]}
              </td>
              <td className="text-right tabular-nums">
                <span
                  className={clsx(
                    'inline-block min-w-7 rounded-md px-1 text-center',
                    evs[k] > 0 ? 'bg-brand-soft font-bold text-ink' : 'text-muted',
                  )}
                >
                  {evs[k]}
                </span>
              </td>
              <td className={clsx('pl-2 text-right font-extrabold tabular-nums', tone)}>{total ?? '—'}</td>
              <td className="pl-3">
                <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                  {total !== undefined && base !== undefined && (
                    <div
                      className="pokemon-stat-fill h-full rounded-full"
                      style={
                        {
                          width: `${statBarPercent(total, max)}%`,
                          backgroundColor: statColor(base),
                          '--i': i,
                        } as React.CSSProperties
                      }
                    />
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Reparto de EVs (y de IVs si alguno no es 31) en notación de Showdown. */
export function SpreadLines({ build, className }: { build: BuildRow; className?: string }) {
  const evs = evSpread(buildEvs(build))
  const ivs = ivSpread(buildIvs(build))
  return (
    <dl className={clsx('grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1 text-[11px]', className)}>
      <dt className="font-bold uppercase tracking-wider text-muted">EVs</dt>
      <dd className="break-words font-mono text-ink">{evs || 'Sin EVs'}</dd>
      {ivs && (
        <>
          <dt className="font-bold uppercase tracking-wider text-muted">IVs</dt>
          <dd className="break-words font-mono text-ink">{ivs}</dd>
        </>
      )}
    </dl>
  )
}
