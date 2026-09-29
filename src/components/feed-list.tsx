'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { FEED_TOP_ID } from '@/components/feed-greeting'
import { PokeballIcon } from '@/components/pokeball'
import { PokeballGlyph, TeamCard, TeamCardSkeleton } from '@/components/team-card'
import { countNewTeams, loadFeedPage } from '@/app/actions/feed'
import type { FeedCursor, FeedTab } from '@/app/(app)/home/feed-query'
import type { TeamWithAuthor } from '@/lib/database.types'

const NEW_TEAMS_POLL_MS = 60_000

function dedupe(teams: TeamWithAuthor[]) {
  const seen = new Set<string>()
  return teams.filter((team) => !seen.has(team.id) && Boolean(seen.add(team.id)))
}

// Mismo orden que la consulta: fecha de creación descendente y el id desempata.
function byNewest(a: TeamWithAuthor, b: TeamWithAuthor) {
  const diff = Date.parse(b.created_at) - Date.parse(a.created_at)
  if (diff !== 0) return diff
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function scrollToFeedTop(smooth: boolean) {
  document.getElementById(FEED_TOP_ID)?.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
}

/**
 * Feed con scroll infinito. La primera página llega renderizada del servidor;
 * las siguientes se piden con la acción loadFeedPage al acercarse al final
 * (IntersectionObserver), con un botón "Cargar más" para teclado o por si el
 * observador no llega a dispararse.
 */
export function FeedList({
  tab,
  initialTeams,
  initialCursor,
}: {
  tab: FeedTab
  initialTeams: TeamWithAuthor[]
  initialCursor: FeedCursor | null
}) {
  const reduceMotion = useReducedMotion()
  const [loaded, setLoaded] = useState<TeamWithAuthor[]>([])
  const [prevInitial, setPrevInitial] = useState(initialTeams)
  const [cursor, setCursor] = useState(initialCursor)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // Posición desde la que cuentan los retrasos de entrada de la última tanda.
  const [revealFrom, setRevealFrom] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)
  const busy = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Al revalidar /home (tras un me gusta o al pedir los equipos nuevos) llega
  // otra primera página. La anterior se conserva: si han entrado equipos
  // nuevos, sus últimos equipos no estarían ni en la nueva ni en el cursor.
  if (prevInitial !== initialTeams) {
    setPrevInitial(initialTeams)
    setLoaded((current) => dedupe([...prevInitial, ...current]))
  }

  // Los datos frescos van primero para que ganen al quitar duplicados.
  const teams = useMemo(() => dedupe([...initialTeams, ...loaded]).sort(byNewest), [initialTeams, loaded])

  const loadMore = useCallback(
    async (moveFocus: boolean) => {
      if (!cursor || busy.current) return
      busy.current = true
      setStatus('loading')
      try {
        const result = await loadFeedPage({ tab, cursor })
        if ('error' in result) throw new Error(result.error)
        setRevealFrom(teams.length)
        setLoaded((current) => dedupe([...current, ...result.teams]))
        setCursor(result.nextCursor)
        setStatus('idle')
        setAnnouncement(
          result.teams.length === 1 ? 'Se ha cargado 1 equipo más.' : `Se han cargado ${result.teams.length} equipos más.`,
        )
        if (moveFocus && result.teams[0]) setFocusId(result.teams[0].id)
      } catch {
        setStatus('error')
      } finally {
        busy.current = false
      }
    },
    [cursor, tab, teams.length],
  )

  // Se recrea tras cada tanda: el observador nuevo informa del estado actual,
  // así que si el centinela sigue a la vista se pide otra página sin esperar.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !cursor || status !== 'idle' || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore(false)
      },
      { rootMargin: '0px 0px 900px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, status, loadMore])

  // Quien carga con el botón sigue leyendo por el primer equipo nuevo.
  useEffect(() => {
    if (!focusId) return
    document.querySelector<HTMLElement>(`[data-team-id="${focusId}"] h2 a`)?.focus()
    setFocusId(null)
  }, [focusId])

  return (
    <>
      <NewTeamsPill key={teams[0]?.created_at ?? 'none'} tab={tab} newest={teams[0]?.created_at ?? null} />

      <div className="flex flex-col gap-4">
        {teams.map((team, position) => (
          <TeamCard key={team.id} team={team} index={position < revealFrom ? 0 : position - revealFrom} />
        ))}
        {status === 'loading' && [0, 1].map((i) => <TeamCardSkeleton key={`skeleton-${i}`} index={i} />)}
      </div>

      <div ref={sentinelRef} className="mt-5">
        {cursor ? (
          status === 'error' ? (
            <div className="card flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
              <p className="flex-1 text-sm">
                <strong className="block font-semibold">No se pudieron cargar más equipos.</strong>
                <span className="text-muted">Comprueba tu conexión e inténtalo otra vez.</span>
              </p>
              <button type="button" onClick={() => void loadMore(true)} className="btn btn-soft btn-sm h-10">
                <RotateCcw size={15} aria-hidden />
                Reintentar
              </button>
            </div>
          ) : (
            status === 'idle' && (
              <div className="flex justify-center">
                <button type="button" onClick={() => void loadMore(true)} className="btn btn-soft">
                  Cargar más equipos
                </button>
              </div>
            )
          )
        ) : (
          <EndOfFeed tab={tab} long={teams.length > 3} onTop={() => scrollToFeedTop(!reduceMotion)} />
        )}
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  )
}

/**
 * Aviso de equipos publicados después del más reciente que se ve. Se consulta
 * cada minuto, sólo con la pestaña visible. Al pulsarlo sube al principio y
 * refresca la página; la key del padre (el más reciente) lo reinicia después.
 */
function NewTeamsPill({ tab, newest }: { tab: FeedTab; newest: string | null }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [count, setCount] = useState(0)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!newest) return
    const since = newest
    let cancelled = false
    let lastCheck = Date.now()

    async function check() {
      if (document.visibilityState !== 'visible') return
      lastCheck = Date.now()
      try {
        const result = await countNewTeams({ tab, since })
        if (!cancelled && 'count' in result) setCount(result.count)
      } catch { /* sin conexión: se vuelve a probar en la siguiente vuelta */ }
    }

    const interval = window.setInterval(() => void check(), NEW_TEAMS_POLL_MS)
    // Al volver a la pestaña tras un rato fuera, se comprueba en el momento.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > NEW_TEAMS_POLL_MS / 2) void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tab, newest])

  const label = count === 1 ? '1 equipo nuevo' : `${count > 99 ? '99+' : count} equipos nuevos`

  return (
    <div
      role="status"
      className="pointer-events-none sticky top-[calc(var(--header-h)+60px)] z-20 flex h-0 justify-center md:top-[calc(var(--header-h)+52px)]"
    >
      <AnimatePresence>
        {count > 0 && (
          <motion.button
            key="new-teams"
            type="button"
            onClick={() => {
              scrollToFeedTop(!reduceMotion)
              startTransition(() => router.refresh())
            }}
            initial={{ opacity: 0, y: -14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 30 }}
            className="btn btn-primary btn-sm pointer-events-auto h-10 shadow-float"
          >
            {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowUp size={15} aria-hidden />}
            {label}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function EndOfFeed({ tab, long, onTop }: { tab: FeedTab; long: boolean; onTop: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 pb-4 pt-6 text-center">
      <span aria-hidden className="relative mb-3 block">
        <PokeballIcon className="feed-end-ball size-12" />
        <Sparkles size={18} className="feed-end-stars absolute -right-4 -top-2 text-warning" />
      </span>
      <p className="font-bold">¡Te has hecho con todos!</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        {tab === 'siguiendo'
          ? 'Ya has visto todos los equipos de la gente que sigues.'
          : 'Ya has visto todos los equipos publicados. Vuelve más tarde o comparte el tuyo.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {long && (
          <button type="button" onClick={onTop} className="btn btn-soft btn-sm h-10">
            <ArrowUp size={15} aria-hidden />
            Volver arriba
          </button>
        )}
        <Link href="/team/new" className="btn btn-primary btn-sm h-10">
          Crear equipo
        </Link>
      </div>
    </div>
  )
}

/**
 * Botón de crear para md+ (en móvil ya está "Crear" en la barra inferior).
 *
 * Va pegado (sticky) abajo a la izquierda de la columna del feed: así nunca
 * pisa los avisos, que salen abajo a la derecha de la ventana, y se apoya
 * 52 px sobre el borde, justo encima del pie fijo, igual que ellos. Al bajar
 * se pliega en un círculo para tapar menos, y al subir vuelve a desplegarse.
 */
export function CreateTeamFab() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0
    function onScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        // Umbral para que el rebote del final del scroll no lo haga parpadear.
        if (Math.abs(y - lastY) < 8) return
        setCollapsed(y > lastY && y > 240)
        lastY = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="pointer-events-none sticky bottom-[52px] z-30 mt-6 hidden md:flex">
      <Link
        href="/team/new"
        aria-label="Crear equipo"
        data-collapsed={collapsed}
        className="feed-fab btn btn-primary shine pointer-events-auto h-13 gap-0 px-4 text-[15px] shadow-float"
      >
        <PokeballGlyph className="feed-fab-ball size-5 shrink-0" />
        <span className="feed-fab-label">
          <span className="overflow-hidden">
            <span className="block pl-2 pr-1">Crear equipo</span>
          </span>
        </span>
      </Link>
    </div>
  )
}
