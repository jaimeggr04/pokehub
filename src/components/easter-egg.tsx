'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { Pokeball } from '@/components/pokeball'
import { toast } from '@/components/ui/toast'
import { useLockBodyScroll, useMounted } from '@/lib/hooks'
import { getPokemon } from '@/lib/pokeapi'
import { prettify, shinyArtworkUrl } from '@/lib/pokemon'
import { MAX_DEX_ID } from '@/lib/random-team'

/*
 * Huevo de pascua: tocar 7 veces seguidas el logo de la cabecera (o teclear
 * el código Konami) hace aparecer un Pokémon variocolor salvaje. Se puede
 * intentar capturar o huir. Los capturados se cuentan en este navegador.
 */

const TAPS = 7
// Entre toque y toque: más que esto ya no cuenta como "seguidos".
const TAP_GAP_MS = 800
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']
// Lo que dura el bamboleo de la bola (ph-catch) más su caída.
const CATCH_MS = 3300
const STORAGE_KEY = 'pokehub:variocolor'

const SPARKLES = [
  { x: '14%', y: '18%', s: '16px', d: '0s' },
  { x: '78%', y: '12%', s: '12px', d: '.5s' },
  { x: '84%', y: '48%', s: '18px', d: '1.1s' },
  { x: '9%', y: '56%', s: '12px', d: '.8s' },
  { x: '30%', y: '8%', s: '10px', d: '1.4s' },
  { x: '64%', y: '30%', s: '10px', d: '.2s' },
]

const STARS = [
  { dx: '-58px', dy: '-44px' },
  { dx: '0px', dy: '-70px' },
  { dx: '58px', dy: '-44px' },
]

type Phase = 'appear' | 'throwing' | 'caught'
type Encounter = { id: number; name: string | null }

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName)
}

function readCaught(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function rememberCaught(id: number): number {
  const list = [...new Set([id, ...readCaught()])].slice(0, 200)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Sin almacenamiento la captura sigue valiendo; sólo no se cuenta.
  }
  return list.length
}

export function ShinyEasterEgg() {
  const [encounter, setEncounter] = useState<Encounter | null>(null)

  const start = useCallback(() => {
    setEncounter((current) => {
      if (current) return current
      // Math.random en un manejador de eventos, nunca al pintar.
      return { id: 1 + Math.floor(Math.random() * MAX_DEX_ID), name: null }
    })
  }, [])

  // 7 toques seguidos en cualquier elemento marcado como disparador.
  useEffect(() => {
    let taps = 0
    let last = 0
    function onClick(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target.closest('[data-easter-egg-trigger]') : null
      if (!target) return
      const now = performance.now()
      taps = now - last < TAP_GAP_MS ? taps + 1 : 1
      last = now
      if (taps >= TAPS) {
        taps = 0
        // El último toque no navega: la sorpresa es aquí.
        e.preventDefault()
        start()
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [start])

  // Código Konami: ↑ ↑ ↓ ↓ ← → ← → B A.
  useEffect(() => {
    let index = 0
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) {
        index = 0
        return
      }
      const key = e.key.toLowerCase()
      if (key === KONAMI[index]) {
        index += 1
        if (index === KONAMI.length) {
          index = 0
          start()
        }
      } else {
        index = key === KONAMI[0] ? 1 : 0
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [start])

  // El nombre llega de la PokéAPI; mientras tanto la ficha dice "Pokémon".
  const encounterId = encounter?.id
  useEffect(() => {
    if (!encounterId) return
    let alive = true
    getPokemon(encounterId)
      .then((detail) => {
        if (alive) setEncounter((e) => (e && e.id === encounterId ? { ...e, name: prettify(detail.name) } : e))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [encounterId])

  return <EncounterDialog encounter={encounter} onClose={() => setEncounter(null)} />
}

function EncounterDialog({ encounter, onClose }: { encounter: Encounter | null; onClose: () => void }) {
  const mounted = useMounted()
  const titleId = useId()
  const [phase, setPhase] = useState<Phase>('appear')
  const [caughtCount, setCaughtCount] = useState(0)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const open = encounter !== null

  useLockBodyScroll(open)

  // Cada encuentro empieza de cero.
  useEffect(() => {
    if (!open) return
    setPhase('appear')
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer.current)
      previous?.focus({ preventScroll: true })
    }
  }, [open, encounter?.id])

  const name = encounter?.name ?? 'Pokémon'

  const flee = useCallback(() => {
    if (phase === 'appear') toast('Has escapado sin problemas', { description: 'Quizá vuelva a aparecer otro día…' })
    onClose()
  }, [phase, onClose])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        flee()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, flee])

  function throwBall() {
    if (!encounter || phase !== 'appear') return
    setPhase('throwing')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = window.setTimeout(
      () => {
        setCaughtCount(rememberCaught(encounter.id))
        setPhase('caught')
        requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }))
      },
      reduce ? 150 : CATCH_MS,
    )
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {encounter && (
        <div key="encounter" className="fixed inset-0 z-[70] grid place-items-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={phase === 'throwing' ? undefined : flee}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-phase={phase}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-bg-elevated text-ink shadow-float"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="extras-stage h-60">
              <span aria-hidden className="extras-rays" />
              <span aria-hidden className="extras-platform" />
              {SPARKLES.map((s, i) => (
                <Sparkles
                  key={i}
                  aria-hidden
                  className="extras-sparkle"
                  style={{ '--x': s.x, '--y': s.y, '--s': s.s, '--d': s.d } as React.CSSProperties}
                />
              ))}

              <div className="absolute inset-x-0 bottom-[16%] top-4 grid place-items-center">
                {phase === 'appear' || phase === 'throwing' ? (
                  <Image
                    key={encounter.id}
                    src={shinyArtworkUrl(encounter.id)}
                    alt=""
                    width={320}
                    height={320}
                    unoptimized
                    draggable={false}
                    className="extras-art size-44 object-contain"
                  />
                ) : null}
                {phase !== 'appear' && (
                  <span className="absolute bottom-2 grid place-items-center">
                    <Pokeball className="extras-ball size-14 drop-shadow-lg" />
                    {phase === 'caught' &&
                      STARS.map((s, i) => (
                        <Sparkles
                          key={i}
                          aria-hidden
                          className="extras-star"
                          style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: `${i * 70}ms` } as React.CSSProperties}
                        />
                      ))}
                  </span>
                )}
              </div>

              {phase !== 'throwing' && (
                <button
                  type="button"
                  onClick={flee}
                  aria-label="Cerrar"
                  className="glass absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink shadow-card"
                >
                  <X size={17} aria-hidden />
                </button>
              )}
            </div>

            <div className="px-5 pb-5 pt-4 text-center">
              <span className="extras-shiny-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles size={12} aria-hidden /> Variocolor
              </span>

              <h2 id={titleId} className="mt-3 text-lg font-extrabold leading-snug" aria-live="polite">
                {phase === 'caught'
                  ? `¡Ya está! ¡${name} atrapado!`
                  : phase === 'throwing'
                    ? '¡Vamos, Poké Ball!'
                    : `¡Un ${name} variocolor salvaje apareció!`}
              </h2>
              <p className="mx-auto mt-1 max-w-[30ch] text-sm text-muted">
                {phase === 'caught'
                  ? caughtCount > 1
                    ? `Ya llevas ${caughtCount} Pokémon variocolor en tu colección.`
                    : 'Tu primer variocolor. Guárdalo bien: salen 1 de cada 4096.'
                  : phase === 'throwing'
                    ? 'Uno… dos… tres…'
                    : 'Sale 1 de cada 4096 encuentros. ¿Lo intentas?'}
              </p>

              <div className="mt-5 flex gap-2">
                {phase === 'caught' ? (
                  <button ref={primaryRef} type="button" onClick={onClose} className="btn btn-primary flex-1">
                    ¡Genial!
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={flee} disabled={phase === 'throwing'} className="btn btn-soft flex-1">
                      Huir
                    </button>
                    <button
                      ref={primaryRef}
                      type="button"
                      onClick={throwBall}
                      disabled={phase === 'throwing'}
                      className="btn btn-primary flex-[1.4]"
                    >
                      <Pokeball className="size-5" />
                      Lanzar Poké Ball
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
