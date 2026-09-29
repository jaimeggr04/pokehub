'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, Shuffle } from 'lucide-react'
import clsx from 'clsx'
import { PokeballIcon } from '@/components/pokeball'
import { PokemonDetails } from '@/components/pokemon-details'
import { useRegisterPokemonPanel, useSelectedPokemon } from '@/components/selected-pokemon'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { artworkUrl, prettify } from '@/lib/pokemon'

/**
 * Columna izquierda de la portada (lg+). Por debajo de lg está oculta y el
 * detalle sale en la hoja inferior que monta SelectedPokemonProvider.
 */
export function PokemonPanel({ className = '' }: { className?: string }) {
  const { build, teamName, clear } = useSelectedPokemon()
  const rootRef = useRef<HTMLDivElement>(null)
  useRegisterPokemonPanel()

  // Cada ficha nueva empieza desde arriba aunque la anterior se hubiera desplazado.
  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0 })
  }, [build?.id])

  // El botón de cerrar desaparece con la ficha: el foco se queda en el panel, no en <body>.
  function close() {
    clear()
    rootRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && build) {
          e.stopPropagation()
          close()
        }
      }}
      className={clsx('pokemon-panel card outline-none', className)}
    >
      <p className="sr-only" aria-live="polite">
        {build ? `Mostrando a ${build.nickname || prettify(build.pokemon_name)}` : ''}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {build ? (
          <motion.div
            key={build.id}
            className="p-4"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985, transition: { duration: 0.14, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <PokemonDetails build={build} teamName={teamName} onClose={close} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <PanelEmpty />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PanelEmpty() {
  return (
    <div className="flex flex-col items-center gap-5 px-5 pb-6 pt-8 text-center">
      <div aria-hidden className="relative flex h-20 w-20 items-start justify-center">
        <PokeballIcon className="h-14 w-14 animate-float" />
        <span className="absolute bottom-0.5 left-1/2 h-2 w-11 -translate-x-1/2 animate-float-shadow rounded-[50%] bg-black/15 blur-[2px] dark:bg-black/40" />
      </div>
      <div>
        <p className="text-base font-bold">Detalle del Pokémon</p>
        <p className="mx-auto mt-1 max-w-[28ch] text-sm text-muted">
          Pulsa un Pokémon de cualquier equipo del feed y aquí verás su ficha: estadísticas, movimientos y hasta su grito.
        </p>
      </div>
      <WhosThatPokemon />
    </div>
  )
}

// Nombres que coinciden en español e inglés, para no tener que traducir nada.
const MYSTERY: [number, string][] = [
  [1, 'Bulbasaur'], [4, 'Charmander'], [6, 'Charizard'], [7, 'Squirtle'], [25, 'Pikachu'],
  [39, 'Jigglypuff'], [54, 'Psyduck'], [94, 'Gengar'], [130, 'Gyarados'], [131, 'Lapras'],
  [133, 'Eevee'], [143, 'Snorlax'], [149, 'Dragonite'], [150, 'Mewtwo'], [151, 'Mew'],
  [196, 'Espeon'], [197, 'Umbreon'], [212, 'Scizor'], [245, 'Suicune'], [248, 'Tyranitar'],
  [257, 'Blaziken'], [282, 'Gardevoir'], [359, 'Absol'], [373, 'Salamence'], [384, 'Rayquaza'],
  [392, 'Infernape'], [445, 'Garchomp'], [448, 'Lucario'], [571, 'Zoroark'], [609, 'Chandelure'],
  [635, 'Hydreigon'], [658, 'Greninja'], [700, 'Sylveon'], [724, 'Decidueye'], [778, 'Mimikyu'],
  [823, 'Corviknight'], [887, 'Dragapult'], [908, 'Meowscarada'], [1000, 'Gholdengo'],
]

function randomIndex(except: number | null) {
  let i = Math.floor(Math.random() * MYSTERY.length)
  if (i === except) i = (i + 1) % MYSTERY.length
  return i
}

/**
 * El clásico del anime para que el hueco vacío invite a quedarse: una silueta
 * y un botón para descubrirla. El azar va en efectos y eventos, nunca en el
 * render, para que servidor y cliente pinten lo mismo.
 */
function WhosThatPokemon() {
  const [pick, setPick] = useState<number | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loaded, setLoaded] = useState<number | null>(null)

  useEffect(() => {
    setPick(randomIndex(null))
  }, [])

  const entry = pick === null ? null : MYSTERY[pick]
  const busy = !entry || loaded !== entry[0]

  function onClick() {
    if (pick === null || busy) return
    if (!revealed) {
      setRevealed(true)
      // Se elige ya el siguiente y se precarga mientras se mira el revelado.
      const upcoming = randomIndex(pick)
      setNext(upcoming)
      new window.Image().src = artworkUrl(MYSTERY[upcoming][0])
      return
    }
    setPick(next ?? randomIndex(pick))
    setNext(null)
    setRevealed(false)
  }

  return (
    <div className="w-full">
      <div className="pokemon-burst relative overflow-hidden rounded-2xl border border-line">
        <div className="relative mx-auto aspect-square w-40">
          {entry && (
            <Image
              key={entry[0]}
              src={artworkUrl(entry[0])}
              alt={revealed ? entry[1] : 'Silueta de un Pokémon misterioso'}
              width={160}
              height={160}
              unoptimized
              draggable={false}
              onLoad={() => setLoaded(entry[0])}
              data-revealed={revealed}
              className={clsx(
                'pokemon-silhouette h-full w-full select-none object-contain p-2',
                loaded === entry[0] ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
          {busy && <PokeballSpinner size={36} label="Buscando un Pokémon…" className="absolute inset-0 m-auto h-fit w-fit" />}
        </div>
        <p aria-live="polite" className="min-h-9 px-3 pb-3 text-sm font-extrabold">
          {revealed && entry ? (
            <span key={entry[0]} className="inline-block animate-pop">
              ¡Es {entry[1]}!
            </span>
          ) : (
            '¿Quién es ese Pokémon?'
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        // aria-disabled y no disabled: un botón deshabilitado pierde el foco del teclado mientras carga.
        aria-disabled={busy}
        className={clsx('btn mt-3 h-10', revealed ? 'btn-soft' : 'btn-primary')}
      >
        {revealed ? <Shuffle aria-hidden size={16} /> : <Eye aria-hidden size={16} />}
        {revealed ? 'Otro Pokémon' : 'Revelar'}
      </button>
    </div>
  )
}
