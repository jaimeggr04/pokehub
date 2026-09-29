'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Lightbulb, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { PokeballIcon } from '@/components/pokeball'
import { toast } from '@/components/ui/toast'
import { useMediaQuery } from '@/lib/hooks'
import { spriteUrl } from '@/lib/pokemon'

/** Id del saludo: "Volver arriba" y el aviso de equipos nuevos le pasan el foco. */
export const FEED_TOP_ID = 'feed-top'

const TIP_INTERVAL_MS = 6500

// Compañeros posibles: favoritos de siempre de las generaciones 1 a 7, que son
// las que tienen sprite pixelado en PokeAPI. Sus nombres coinciden en español.
const PARTNERS: { id: number; name: string }[] = [
  { id: 1, name: 'Bulbasaur' }, { id: 4, name: 'Charmander' }, { id: 7, name: 'Squirtle' },
  { id: 25, name: 'Pikachu' }, { id: 39, name: 'Jigglypuff' }, { id: 52, name: 'Meowth' },
  { id: 54, name: 'Psyduck' }, { id: 94, name: 'Gengar' }, { id: 129, name: 'Magikarp' },
  { id: 131, name: 'Lapras' }, { id: 132, name: 'Ditto' }, { id: 133, name: 'Eevee' },
  { id: 143, name: 'Snorlax' }, { id: 149, name: 'Dragonite' }, { id: 151, name: 'Mew' },
  { id: 152, name: 'Chikorita' }, { id: 155, name: 'Cyndaquil' }, { id: 158, name: 'Totodile' },
  { id: 175, name: 'Togepi' }, { id: 179, name: 'Mareep' }, { id: 194, name: 'Wooper' },
  { id: 196, name: 'Espeon' }, { id: 197, name: 'Umbreon' }, { id: 252, name: 'Treecko' },
  { id: 255, name: 'Torchic' }, { id: 258, name: 'Mudkip' }, { id: 282, name: 'Gardevoir' },
  { id: 387, name: 'Turtwig' }, { id: 390, name: 'Chimchar' }, { id: 393, name: 'Piplup' },
  { id: 417, name: 'Pachirisu' }, { id: 445, name: 'Garchomp' }, { id: 448, name: 'Lucario' },
  { id: 495, name: 'Snivy' }, { id: 498, name: 'Tepig' }, { id: 501, name: 'Oshawott' },
  { id: 570, name: 'Zorua' }, { id: 650, name: 'Chespin' }, { id: 653, name: 'Fennekin' },
  { id: 656, name: 'Froakie' }, { id: 700, name: 'Sylveon' }, { id: 722, name: 'Rowlet' },
  { id: 725, name: 'Litten' }, { id: 728, name: 'Popplio' }, { id: 778, name: 'Mimikyu' },
]

const STORAGE_KEY = 'pokehub:companion'
// Mucho más generoso que en los juegos: la gracia es que alguna vez salga.
const SHINY_ODDS = 64

type Companion = { id: number; shiny: boolean }

function readCompanion(): Companion | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Companion>
    if (typeof value.id !== 'number' || !PARTNERS.some((p) => p.id === value.id)) return null
    return { id: value.id, shiny: value.shiny === true }
  } catch {
    return null
  }
}

function saveCompanion(companion: Companion) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(companion))
  } catch { /* sin sessionStorage: el compañero dura lo que la página */ }
}

function randomCompanion(exclude?: number): Companion {
  const pool = PARTNERS.filter((p) => p.id !== exclude)
  const partner = pool[Math.floor(Math.random() * pool.length)]
  return { id: partner.id, shiny: Math.random() < 1 / SHINY_ODDS }
}

function partnerName(id: number) {
  return PARTNERS.find((p) => p.id === id)?.name ?? 'Pokémon'
}

/** Saludo compacto sobre el feed: compañero Pokémon, nombre y un consejo que va rotando. */
export function FeedGreeting({ name }: { name: string }) {
  return (
    <header className="flex items-center gap-3 sm:gap-4">
      <CompanionButton />
      <div className="min-w-0 flex-1">
        <h1
          id={FEED_TOP_ID}
          tabIndex={-1}
          className="truncate text-xl font-extrabold leading-tight tracking-tight outline-none sm:text-2xl"
        >
          ¡Hola, <span className="text-gradient-brand">{name}</span>!
        </h1>
        <TipRotator />
      </div>
    </header>
  )
}

/**
 * El compañero se elige en el cliente (en el servidor saldría otro y la
 * hidratación fallaría): hasta entonces se ve su pokéball. Se recuerda durante
 * la sesión y, al pulsarlo, vuelve a la bola y sale otro.
 */
function CompanionButton() {
  const [companion, setCompanion] = useState<Companion | null>(null)

  useEffect(() => {
    const initial = readCompanion() ?? randomCompanion()
    saveCompanion(initial)
    setCompanion(initial)
  }, [])

  function callAnother() {
    const next = randomCompanion(companion?.id)
    saveCompanion(next)
    setCompanion(next)
    if (next.shiny) {
      toast('¡Un compañero variocolor!', {
        tone: 'success',
        description: `Tu ${partnerName(next.id)} brilla con otros colores. ¡Qué suerte!`,
      })
    }
  }

  const current = companion ? `${partnerName(companion.id)}${companion.shiny ? ' variocolor' : ''}` : null

  return (
    <button
      type="button"
      onClick={callAnother}
      aria-label={current ? `Tu compañero es ${current}. Pulsa para llamar a otro` : 'Llamar a un compañero Pokémon'}
      title={current ?? undefined}
      className="pressable relative grid size-14 shrink-0 place-items-center rounded-full bg-surface shadow-card ring-1 ring-line sm:size-16"
    >
      <span className="feed-companion-idle pointer-events-none relative grid size-full place-items-center">
        {companion ? (
          <CompanionSprite key={`${companion.id}-${companion.shiny}`} companion={companion} />
        ) : (
          <PokeballIcon className="size-8" />
        )}
      </span>
      {companion?.shiny && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid size-5 animate-pop place-items-center rounded-full bg-bg-elevated text-warning shadow-card"
        >
          <Sparkles size={12} strokeWidth={2.5} />
        </span>
      )}
    </button>
  )
}

function CompanionSprite({ companion }: { companion: Companion }) {
  const [ready, setReady] = useState(false)

  return (
    <>
      {/* La bola se queda mientras llega el sprite, y se bambolea como en una captura. */}
      {!ready && <PokeballIcon className="size-8 animate-wiggle" />}
      <Image
        src={spriteUrl(companion.id, companion.shiny)}
        alt=""
        width={96}
        height={96}
        unoptimized
        draggable={false}
        onLoad={() => setReady(true)}
        className={clsx(
          'absolute left-1/2 top-1/2 size-24 max-w-none -translate-x-1/2 -translate-y-[58%] [image-rendering:pixelated]',
          ready ? 'feed-companion-sprite' : 'opacity-0',
        )}
      />
    </>
  )
}

type Tip = { id: string; content: React.ReactNode }

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-[1.35rem] min-w-[1.35rem] place-items-center rounded-md border border-b-2 border-line bg-surface-2 px-1 font-sans text-[11px] font-semibold leading-none text-ink">
      {children}
    </kbd>
  )
}

/**
 * Consejos según el dispositivo. El primero es universal y es el que pinta el
 * servidor: al montar, la lista crece con los de escritorio sin que cambie lo
 * que ya se ve.
 */
function useTips(): Tip[] {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  return useMemo(() => {
    const tips: Tip[] = [{ id: 'showdown', content: 'Importa equipos desde Showdown al crear uno nuevo.' }]
    tips.push({
      id: 'stats',
      content: `${finePointer ? 'Pulsa' : 'Toca'} un Pokémon de cualquier equipo para ver sus estadísticas.`,
    })
    tips.push({
      id: 'like',
      content: finePointer
        ? 'Haz doble clic en un equipo para darle me gusta.'
        : 'Toca dos veces un equipo para darle me gusta.',
    })
    if (desktop && finePointer) {
      tips.push({
        id: 'palette',
        content: (
          <>
            Pulsa <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> para buscar lo que quieras.
          </>
        ),
      })
    }
    tips.push(
      { id: 'shiny', content: 'Las chispas ✨ marcan a los Pokémon variocolor.' },
      { id: 'tera', content: 'El rombo de color en un Pokémon indica su teratipo.' },
      { id: 'companion', content: 'Toca a tu compañero para llamar a otro Pokémon.' },
      { id: 'follow', content: 'Sigue a otros entrenadores para ver sus equipos en «Siguiendo».' },
    )
    return tips
  }, [desktop, finePointer])
}

function TipRotator() {
  const tips = useTips()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [offset, setOffset] = useState(0)
  const [paused, setPaused] = useState(false)

  // A partir del segundo consejo, el orden empieza en un punto al azar para
  // que cada visita no repita la misma secuencia.
  useEffect(() => {
    setOffset(Math.floor(Math.random() * 1000))
  }, [])

  useEffect(() => {
    if (reduceMotion || paused) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setStep((s) => s + 1)
    }, TIP_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [reduceMotion, paused])

  const tip = step === 0 ? tips[0] : tips[(step + offset) % tips.length]

  return (
    <div
      className="relative mt-1 h-10 sm:h-5"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.p
          key={tip.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 flex items-start gap-1.5 text-[13px] leading-5 text-muted"
        >
          <Lightbulb size={14} aria-hidden className="mt-[3px] shrink-0 text-warning" />
          <span className="line-clamp-2 sm:line-clamp-1">{tip.content}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
