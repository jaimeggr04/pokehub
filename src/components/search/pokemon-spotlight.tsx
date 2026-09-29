'use client'

import { useEffect, useId, useState } from 'react'
import Image from 'next/image'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { CryButton } from '@/components/cry-button'
import { TypeBadge } from '@/components/type-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getPokemon, getSpeciesInfo, type PokemonDetail, type SpeciesInfo } from '@/lib/pokeapi'
import { TYPE_COLORS, artworkUrl, cryUrl, dexNumber, prettify, shinyArtworkUrl } from '@/lib/pokemon'

const SPARKLES = 6

/**
 * Ficha del Pokémon que protagoniza una búsqueda de equipos: ilustración,
 * tipos, entrada de la Pokédex y su grito. El servidor ya sabe id y nombre;
 * tipos y textos llegan de la PokéAPI (con caché) y aparecen al cargar.
 */
export function PokemonSpotlight({
  pokemonId,
  name,
  teams,
  capped,
}: {
  pokemonId: number
  name: string
  /** Equipos del resultado que lo llevan. */
  teams: number
  /** El resultado está recortado: son "al menos" esos equipos. */
  capped: boolean
}) {
  const titleId = useId()
  const label = prettify(name)
  const [detail, setDetail] = useState<PokemonDetail | null>(null)
  const [species, setSpecies] = useState<SpeciesInfo | null>(null)
  const [failed, setFailed] = useState(false)
  const [shiny, setShiny] = useState(false)
  // La ilustración variocolor no se descarga hasta que alguien la pide.
  const [shinyRequested, setShinyRequested] = useState(false)
  const [sparkleBurst, setSparkleBurst] = useState(0)
  const hop = useAnimationControls()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let alive = true
    getPokemon(pokemonId)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setFailed(true))
    getSpeciesInfo(pokemonId)
      .then((s) => alive && setSpecies(s))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [pokemonId])

  const types = detail?.types ?? []
  const tint = TYPE_COLORS[types[0] ?? '']?.bg
  const tint2 = TYPE_COLORS[types[1] ?? types[0] ?? '']?.bg
  const dex = species?.dexNumber ?? detail?.speciesId ?? (pokemonId < 10000 ? pokemonId : null)
  const loading = !detail && !failed

  function toggleShiny() {
    setShinyRequested(true)
    setShiny((s) => !s)
    if (!shiny) setSparkleBurst((n) => n + 1)
  }

  function onCry() {
    if (reduceMotion) return
    void hop.start({
      y: [0, -16, 0, -6, 0],
      rotate: [0, -4, 3, -1, 0],
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    })
  }

  return (
    <section
      aria-labelledby={titleId}
      style={
        {
          '--search-spot': tint ?? 'var(--muted)',
          '--search-spot-2': tint2 ?? 'var(--muted)',
        } as React.CSSProperties
      }
      className="search-spotlight card animate-scale-in relative isolate overflow-hidden p-4 sm:p-5"
    >
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative size-28 shrink-0 sm:size-36">
          <span aria-hidden className="search-spot-halo" />
          <motion.div animate={hop} className="relative size-full">
            <div className="size-full animate-float">
              <Image
                src={artworkUrl(pokemonId)}
                alt=""
                width={288}
                height={288}
                unoptimized
                draggable={false}
                className={clsx(
                  'search-spot-art absolute inset-0 size-full object-contain transition-opacity duration-(--dur-slow)',
                  shiny && 'opacity-0',
                )}
              />
              {shinyRequested && (
                <Image
                  src={shinyArtworkUrl(pokemonId)}
                  alt=""
                  width={288}
                  height={288}
                  unoptimized
                  draggable={false}
                  className={clsx(
                    'search-spot-art absolute inset-0 size-full object-contain transition-opacity duration-(--dur-slow)',
                    !shiny && 'opacity-0',
                  )}
                />
              )}
            </div>
          </motion.div>
          <span
            aria-hidden
            className="absolute -bottom-1 left-1/2 h-2.5 w-3/5 -translate-x-1/2 animate-float-shadow rounded-[50%] bg-black/15 blur-[3px] dark:bg-black/40"
          />
          {sparkleBurst > 0 && (
            <span key={sparkleBurst} aria-hidden className="search-sparkles">
              {Array.from({ length: SPARKLES }, (_, i) => (
                <span key={i} style={{ '--a': `${(360 / SPARKLES) * i + 15}deg` } as React.CSSProperties} />
              ))}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
            {dex !== null && <span className="shrink-0 tabular-nums">{dexNumber(dex)}</span>}
            {species?.genus ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate animate-fade-in">{species.genus}</span>
              </>
            ) : (
              !failed && <Skeleton className="h-3 w-24 rounded-md" />
            )}
          </p>
          <h3 id={titleId} className="mt-0.5 text-xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
            {label}
          </h3>
          <div className="mt-2 flex min-h-5 flex-wrap gap-1.5">
            {loading ? (
              <>
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-14 rounded-md" />
              </>
            ) : (
              types.map((type) => <TypeBadge key={type} type={type} size="sm" className="animate-scale-in" />)
            )}
          </div>
          {/* En escritorio, junto a la ilustración; en móvil, debajo y a todo el ancho. */}
          {species?.flavor && (
            <div className="hidden sm:block">
              <p className="mt-2.5 line-clamp-2 animate-fade-in text-sm leading-relaxed text-muted">{species.flavor}</p>
            </div>
          )}
        </div>
      </div>

      {species?.flavor && (
        <div className="sm:hidden">
          <p className="mt-3 line-clamp-3 animate-fade-in text-[13px] leading-relaxed text-muted">{species.flavor}</p>
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
        <p className="min-w-0 text-sm leading-snug">
          <span className="font-extrabold tabular-nums">
            {teams}
            {capped && '+'}
          </span>{' '}
          <span className="text-muted">
            {teams === 1 && !capped ? 'equipo público lo lleva' : 'equipos públicos lo llevan'}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleShiny}
            aria-pressed={shiny}
            aria-label={shiny ? `Ver a ${label} con sus colores normales` : `Ver a ${label} variocolor`}
            title={shiny ? 'Colores normales' : 'Variocolor'}
            className={clsx(
              'glass pressable grid size-10 place-items-center rounded-full shadow-card transition-colors',
              shiny ? 'text-warning' : 'text-ink',
            )}
          >
            <Sparkles size={18} aria-hidden />
          </button>
          <CryButton src={cryUrl(pokemonId)} name={label} onPlay={onCry} />
        </div>
      </footer>
    </section>
  )
}
