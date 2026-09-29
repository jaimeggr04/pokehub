'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Award, Check, Lock } from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'
import {
  formatMedalProgress,
  getMedal,
  MEDAL_IDS,
  type MedalId,
  type MedalProgress,
} from '@/lib/achievements'

/* ------------------------------------------------------------------
   Arte de las medallas. Formas geométricas propias, cada una con su
   paleta (como las medallas de gimnasio, no siguen el tema). `shape` es
   la silueta: recorta el brillo y se pinta en gris cuando está bloqueada.
   ------------------------------------------------------------------ */

type MedalArtwork = {
  shape: React.ReactNode
  art: (uid: string) => React.ReactNode
  /** Relleno de la barra de progreso (admite degradados). */
  accent: string
}

const OCTAGON = '21.3,6.1 42.7,6.1 57.9,21.3 57.9,42.7 42.7,57.9 21.3,57.9 6.1,42.7 6.1,21.3'
const DIAMOND = 'M32 3.5 60.5 32 32 60.5 3.5 32Z'
const HEART =
  'M32 56C14 44 6 35 6 23.5 6 15 12.5 8.5 20.5 8.5c5 0 9 2.6 11.5 6.6C34.5 11.1 38.5 8.5 43.5 8.5 51.5 8.5 58 15 58 23.5 58 35 50 44 32 56Z'
const STAR = '32,5 39.35,22.89 58.63,24.35 43.89,36.86 48.46,55.65 32,45.5 15.54,55.65 20.11,36.86 5.37,24.35 24.65,22.89'
const DROP = 'M32 4.5C32 4.5 11 27.5 11 40.5a21 21 0 0 0 42 0C53 27.5 32 4.5 32 4.5Z'
const SHIELD = 'M32 4 54 11.5V30c0 14-9 23.5-22 29.5C19 53.5 10 44 10 30V11.5Z'
const PETALS: [number, number, string][] = [
  [49, 32, '#ff6b6b'],
  [44.02, 44.02, '#ffa94d'],
  [32, 49, '#ffd43b'],
  [19.98, 44.02, '#69db7c'],
  [15, 32, '#38d9a9'],
  [19.98, 19.98, '#4dabf7'],
  [32, 15, '#9775fa'],
  [44.02, 19.98, '#f783ac'],
]
const SPARKLE = 'M32 23.5c1.1 5.2 3.3 7.4 8.5 8.5-5.2 1.1-7.4 3.3-8.5 8.5-1.1-5.2-3.3-7.4-8.5-8.5 5.2-1.1 7.4-3.3 8.5-8.5Z'

function gradient(id: string, from: string, to: string) {
  return (
    <linearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  )
}

const ARTWORK: Record<MedalId, MedalArtwork> = {
  'primer-equipo': {
    accent: '#7b8794',
    shape: <polygon points={OCTAGON} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#d5dde5', '#6b7785')}</defs>
        <polygon points={OCTAGON} fill={`url(#${u}g)`} stroke="#4a5563" strokeWidth="2.5" strokeLinejoin="round" />
        <polygon
          points="25.1,15.4 38.9,15.4 48.6,25.1 48.6,38.9 38.9,48.6 25.1,48.6 15.4,38.9 15.4,25.1"
          fill="#eef2f6"
          opacity="0.8"
        />
        <path
          d="M21.3 6.1 25.1 15.4M42.7 6.1 38.9 15.4M57.9 21.3 48.6 25.1M57.9 42.7 48.6 38.9M42.7 57.9 38.9 48.6M21.3 57.9 25.1 48.6M6.1 42.7 15.4 38.9M6.1 21.3 15.4 25.1"
          stroke="#4a5563"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
        <polygon points="28.6,24 35.4,24 40,28.6 40,35.4 35.4,40 28.6,40 24,35.4 24,28.6" fill="#8995a3" />
      </>
    ),
  },
  estratega: {
    accent: '#f76707',
    shape: <path d={DIAMOND} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#ffa45c', '#e0412a')}</defs>
        <path d={DIAMOND} fill={`url(#${u}g)`} stroke="#b3301b" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 12.5 51.5 32 32 51.5 12.5 32Z" fill="#ffc078" opacity="0.45" />
        <path
          d="M32 17.5c5 6 9 10.5 9 16.5a9 9 0 0 1-18 0c0-4 2-7 4.5-9.5.4 3 1.8 5 3.9 5.8-.6-4.3-.3-8.3.6-12.8Z"
          fill="#fff4d6"
        />
        <path d="M32 31.5c2.4 2.6 4 4.6 4 7a4 4 0 0 1-8 0c0-2.2 1.6-4.3 4-7Z" fill="#ffc53d" />
      </>
    ),
  },
  popular: {
    accent: '#e64980',
    shape: <path d={HEART} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#ff9cc6', '#d6336c')}</defs>
        <path d={HEART} fill={`url(#${u}g)`} stroke="#a61e4d" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={HEART} fill="#ffdeeb" opacity="0.85" transform="translate(32 31) scale(0.48) translate(-32 -31)" />
        <circle cx="45" cy="20" r="2.2" fill="#fff" opacity="0.8" />
      </>
    ),
  },
  estrella: {
    accent: '#f59f00',
    shape: <polygon points={STAR} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#ffe066', '#f08c00')}</defs>
        <polygon points={STAR} fill={`url(#${u}g)`} stroke="#c26b00" strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points={STAR} fill="#fff3bf" transform="translate(32 33) scale(0.46) translate(-32 -33)" />
      </>
    ),
  },
  sociable: {
    accent: '#1c7ed6',
    shape: <path d={DROP} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#8fd0ff', '#1971c2')}</defs>
        <path d={DROP} fill={`url(#${u}g)`} stroke="#1864ab" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="32" cy="41" r="11.5" fill="none" stroke="#d0ebff" strokeWidth="3" opacity="0.9" />
        <circle cx="32" cy="41" r="4.5" fill="#e7f5ff" />
        <path d="M24 22c-2.5 3.5-4.5 7-5.3 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
  lider: {
    accent: '#2f9e44',
    shape: <path d={SHIELD} />,
    art: (u) => (
      <>
        <defs>{gradient(`${u}g`, '#8ce99a', '#2b8a3e')}</defs>
        <path d={SHIELD} fill={`url(#${u}g)`} stroke="#1f6b30" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={SHIELD} fill="#ebfbee" opacity="0.28" transform="translate(32 31) scale(0.74) translate(-32 -31)" />
        <path
          d="M20.5 40V26.5l6.2 5.2L32 22.5l5.3 9.2 6.2-5.2V40Z"
          fill="#ffe066"
          stroke="#e8a100"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M20.5 40h23" stroke="#e8a100" strokeWidth="1.6" />
        <circle cx="32" cy="34.5" r="2" fill="#f08c00" />
      </>
    ),
  },
  variocolor: {
    accent: 'linear-gradient(90deg, #ff6b6b, #ffd43b, #69db7c, #4dabf7, #9775fa)',
    shape: (
      <>
        {PETALS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="10" />
        ))}
        <circle cx="32" cy="32" r="11" />
      </>
    ),
    art: () => (
      <>
        {PETALS.map(([cx, cy, color]) => (
          <circle key={color} cx={cx} cy={cy} r="10" fill={color} stroke="#000" strokeOpacity="0.14" strokeWidth="1.5" />
        ))}
        <circle cx="32" cy="32" r="11" fill="#fff" stroke="#000" strokeOpacity="0.12" strokeWidth="1.5" />
        <path d={SPARKLE} fill="#fab005" />
      </>
    ),
  },
  veterano: {
    accent: '#f08c00',
    shape: <circle cx="32" cy="32" r="28" />,
    art: () => (
      <>
        <circle cx="32" cy="32" r="28" fill="#f08c00" stroke="#c26b00" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="22.5" fill="#ffd43b" />
        <circle cx="32" cy="32" r="17" fill="#f59f00" />
        <circle cx="32" cy="32" r="11.5" fill="#fff3bf" />
        <circle cx="32" cy="32" r="6" fill="#fab005" />
        <circle cx="32" cy="32" r="2.2" fill="#fff" />
      </>
    ),
  },
}

/** Medalla en SVG. Bloqueada: sólo la silueta en el color actual (gris). */
export function MedalArt({ id, unlocked, className }: { id: MedalId; unlocked: boolean; className?: string }) {
  // Los ids de <defs> son globales en el documento: uno por instancia.
  const uid = `medal-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const { shape, art } = ARTWORK[id]

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {unlocked ? (
        <>
          <defs>
            <clipPath id={`${uid}c`}>{shape}</clipPath>
          </defs>
          {art(uid)}
          <g clipPath={`url(#${uid}c)`}>
            <ellipse cx="23" cy="16" rx="18" ry="9" fill="#fff" opacity="0.28" transform="rotate(-24 23 16)" />
            <path className="profile-medal-sheen" d="M-26 -6h14l-22 76h-14Z" fill="#fff" opacity="0.6" />
          </g>
        </>
      ) : (
        <g fill="currentColor">{shape}</g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------
   Medallero
   ------------------------------------------------------------------ */

type OpenState = { id: MedalId; pinned: boolean }
type Placement = { x: number; y: number; arrow: number; side: 'top' | 'bottom'; width: number }

const POPOVER_WIDTH = 240
// Alto aproximado del globo, sólo para decidir si cabe encima.
const POPOVER_ESTIMATE = 170
const HOVER_OPEN_MS = 140
const HOVER_CLOSE_MS = 110

export function TrainerBadges({
  medals,
  isMe,
  trainerId,
  username,
  className,
}: {
  medals: MedalProgress[]
  isMe: boolean
  trainerId: string
  username: string
  className?: string
}) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const listRef = useRef<HTMLUListElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggers = useRef(new Map<MedalId, HTMLButtonElement>())
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [open, setOpen] = useState<OpenState | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [inView, setInView] = useState(false)
  const [fresh, setFresh] = useState<ReadonlySet<MedalId>>(() => new Set())

  const unlockedCount = medals.filter((m) => m.unlocked).length
  const unlockedKey = medals
    .filter((m) => m.unlocked)
    .map((m) => m.id)
    .join(',')

  // Las medallas conseguidas hacen su pop la primera vez que se ven.
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        setInView(true)
      },
      { threshold: 0.35 },
    )
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  // En tu propia ficha, las medallas que no estaban la última vez se celebran.
  // Es una comodidad de este navegador: la primera visita sólo toma nota.
  useEffect(() => {
    if (!isMe) return
    const key = `pokehub:medallas:${trainerId}`
    const unlocked = unlockedKey ? (unlockedKey.split(',') as MedalId[]) : []
    let seen: unknown = null
    try {
      const raw = window.localStorage.getItem(key)
      seen = raw ? JSON.parse(raw) : null
    } catch {
      seen = null
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(unlocked))
    } catch {
      // Sin almacenamiento no hay celebración, pero nada se rompe.
    }
    if (!Array.isArray(seen)) return
    const known = new Set(seen.filter((id): id is string => typeof id === 'string'))
    const brandNew = unlocked.filter((id) => !known.has(id))
    if (brandNew.length === 0) return

    setFresh(new Set(brandNew))
    const names = brandNew.map((id) => getMedal(id).name)
    toast(brandNew.length === 1 ? '¡Nueva medalla!' : `¡${brandNew.length} medallas nuevas!`, {
      tone: 'success',
      description:
        names.length === 1 ? `Has conseguido la medalla ${names[0]}.` : `Has conseguido: ${names.join(', ')}.`,
      duration: 5000,
    })
  }, [isMe, trainerId, unlockedKey])

  useEffect(
    () => () => {
      clearTimeout(openTimer.current)
      clearTimeout(closeTimer.current)
    },
    [],
  )

  // Abierto: se cierra tocando fuera, con Esc o si cambia el tamaño de la ventana.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!(e.target instanceof Node) || !wrapRef.current?.contains(e.target)) setOpen(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const trigger = open ? triggers.current.get(open.id) : undefined
      setOpen(null)
      if (open?.pinned && trigger && document.activeElement !== trigger) trigger.focus({ preventScroll: true })
    }
    function onResize() {
      setOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function place(id: MedalId): Placement | null {
    const wrap = wrapRef.current
    const trigger = triggers.current.get(id)
    if (!wrap || !trigger) return null
    const box = wrap.getBoundingClientRect()
    const target = trigger.getBoundingClientRect()
    const width = Math.min(POPOVER_WIDTH, box.width)
    const center = target.left + target.width / 2 - box.left
    const x = Math.min(Math.max(center - width / 2, 0), box.width - width)
    // Encima si cabe entre la cabecera fija y la medalla; si no, debajo.
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 92
    const side = target.top - header - 16 >= POPOVER_ESTIMATE ? 'top' : 'bottom'
    const y = side === 'top' ? box.bottom - target.top + 10 : target.bottom - box.top + 10
    return { x, y, arrow: center - x, side, width }
  }

  function show(id: MedalId, pinned: boolean) {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    const next = place(id)
    if (!next) return
    setPlacement(next)
    setOpen({ id, pinned })
  }

  function hide(id: MedalId) {
    setOpen((current) => (current?.id === id ? null : current))
  }

  const current = open ? medals.find((m) => m.id === open.id) : undefined
  const next = medals
    .filter((m) => !m.unlocked)
    .sort((a, b) => b.current / b.goal - a.current / a.goal)[0]

  return (
    <section
      aria-labelledby={titleId}
      className={clsx('profile-medals-card card @container relative p-4 sm:p-5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Award size={17} aria-hidden />
          Medallas
        </h2>
        <p className="text-sm font-bold tabular-nums">
          <span className="text-ink">{unlockedCount}</span>
          <span className="text-muted">/{medals.length}</span>
          <span className="sr-only"> conseguidas</span>
        </p>
      </div>

      <div aria-hidden className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className="profile-medals-bar h-full rounded-full bg-(image:--brand-gradient)"
          style={{ width: `${(unlockedCount / medals.length) * 100}%` }}
        />
      </div>

      {isMe && (
        <p className="mt-2.5 text-xs text-muted">
          {next ? (
            <>
              Tu próxima medalla: <strong className="font-semibold text-ink">{getMedal(next.id).name}</strong>
              <span className="tabular-nums"> · {formatMedalProgress(getMedal(next.id), next.current)}</span>
            </>
          ) : (
            '¡Medallero completo! Eres un entrenador de leyenda.'
          )}
        </p>
      )}

      <div ref={wrapRef} className="relative mt-4">
        <ul
          ref={listRef}
          aria-label={`Medallas de @${username}`}
          data-inview={inView || undefined}
          className="profile-medals grid grid-cols-4 gap-x-1 gap-y-3 @xl:grid-cols-8"
        >
          {medals.map((medal, index) => {
            const def = getMedal(medal.id)
            const descId = `${baseId}-${medal.id}`
            const isFresh = fresh.has(medal.id)
            return (
              <li key={medal.id}>
                <button
                  ref={(node) => {
                    if (node) triggers.current.set(medal.id, node)
                    else triggers.current.delete(medal.id)
                  }}
                  type="button"
                  aria-describedby={descId}
                  data-unlocked={medal.unlocked || undefined}
                  data-fresh={isFresh || undefined}
                  data-open={open?.id === medal.id || undefined}
                  style={{ '--i': index } as React.CSSProperties}
                  onClick={() => {
                    if (open?.id === medal.id && open.pinned) setOpen(null)
                    else show(medal.id, true)
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'mouse' || open?.pinned) return
                    clearTimeout(closeTimer.current)
                    if (open) show(medal.id, false)
                    else openTimer.current = setTimeout(() => show(medal.id, false), HOVER_OPEN_MS)
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType !== 'mouse') return
                    clearTimeout(openTimer.current)
                    if (open && !open.pinned) closeTimer.current = setTimeout(() => hide(medal.id), HOVER_CLOSE_MS)
                  }}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(':focus-visible')) show(medal.id, false)
                  }}
                  onBlur={() => hide(medal.id)}
                  className="profile-medal flex w-full flex-col items-center gap-1.5 rounded-2xl px-0.5 pb-1.5 pt-2 text-center"
                >
                  <span className="relative grid size-14 place-items-center">
                    {!medal.unlocked && medal.current > 0 && (
                      <ProgressRing value={medal.current / medal.goal} />
                    )}
                    <MedalArt
                      id={medal.id}
                      unlocked={medal.unlocked}
                      className={clsx('profile-medal-art size-12', !medal.unlocked && 'text-ink/[0.13]')}
                    />
                    {!medal.unlocked && (
                      <span className="absolute -bottom-0.5 right-0 grid size-5 place-items-center rounded-full bg-bg-elevated text-muted shadow-card">
                        <Lock size={10} strokeWidth={2.6} aria-hidden />
                      </span>
                    )}
                    {isFresh && (
                      <span aria-hidden className="profile-medal-new">
                        ¡Nueva!
                      </span>
                    )}
                  </span>
                  <span
                    className={clsx(
                      'line-clamp-2 text-[11px] font-semibold leading-tight',
                      medal.unlocked ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {def.name}
                    <span className="sr-only">{medal.unlocked ? ' (conseguida)' : ' (bloqueada)'}</span>
                  </span>
                </button>
                <span id={descId} className="sr-only">
                  {def.hint} Progreso: {formatMedalProgress(def, medal.current)}.
                </span>
              </li>
            )
          })}
        </ul>

        <AnimatePresence>
          {open && current && placement && (
            <MedalPopover key="medal-popover" medal={current} placement={placement} />
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

/** Anillo de progreso alrededor de una medalla bloqueada. */
function ProgressRing({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="absolute inset-0 size-full -rotate-90">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink/10" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        pathLength={100}
        strokeDasharray={`${pct} 100`}
        strokeLinecap="round"
        strokeWidth="2.5"
        className="profile-medal-ring stroke-brand"
      />
    </svg>
  )
}

/**
 * Detalle de la medalla. Es sólo visual (aria-hidden): el nombre, el estado y
 * cómo conseguirla ya van en la etiqueta y la descripción del botón.
 */
function MedalPopover({ medal, placement }: { medal: MedalProgress; placement: Placement }) {
  const def = getMedal(medal.id)
  const pct = Math.round((medal.current / medal.goal) * 100)
  const above = placement.side === 'top'

  return (
    <motion.div
      aria-hidden
      data-side={placement.side}
      initial={{ opacity: 0, scale: 0.9, y: above ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 560, damping: 34 }}
      style={{
        width: placement.width,
        left: 0,
        translate: `${placement.x}px 0`,
        transformOrigin: `${placement.arrow}px ${above ? '100%' : '0%'}`,
        ...(above ? { bottom: placement.y } : { top: placement.y }),
      }}
      className="profile-medal-popover pointer-events-none absolute z-30 rounded-2xl border border-line bg-bg-elevated p-3.5 text-left text-ink shadow-float"
    >
      <span
        className="profile-medal-popover-arrow"
        style={{ left: Math.min(Math.max(placement.arrow, 16), placement.width - 16) }}
      />
      <div className="flex items-center gap-3">
        <MedalArt id={medal.id} unlocked={medal.unlocked} className={clsx('size-11 shrink-0', !medal.unlocked && 'text-ink/15')} />
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight">{def.name}</p>
          <p
            className={clsx(
              'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              medal.unlocked ? 'bg-success-soft text-success' : 'bg-ink/[0.07] text-muted',
            )}
          >
            {medal.unlocked ? <Check size={11} strokeWidth={3} /> : <Lock size={10} strokeWidth={2.6} />}
            {medal.unlocked ? 'Conseguida' : 'Bloqueada'}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted">{def.hint}</p>
      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span className="text-muted">Progreso</span>
          <span className="tabular-nums">{formatMedalProgress(def, medal.current)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div
            className="profile-medal-popover-bar h-full rounded-full"
            style={{ width: `${pct}%`, background: ARTWORK[medal.id].accent }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/** Orden canónico, por si alguien necesita pintar las medallas sin progreso. */
export const MEDAL_ORDER = MEDAL_IDS
