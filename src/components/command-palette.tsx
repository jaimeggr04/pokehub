'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  CornerDownLeft, Dices, FileText, History, Home, Link2, Loader2, LogOut, MessageSquare, Moon,
  PlusCircle, Search, Settings, Sparkles, Sun, Swords, User, Users, X, type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { PokeballIcon } from '@/components/pokeball'
import { revealOriginOf, switchTheme, useIsDark } from '@/components/theme-toggle'
import { useUnreadCount } from '@/components/unread'
import { PALETTE_EVENT, isActivePath, trapTabKey } from '@/components/nav-links'
import { createClient } from '@/lib/supabase/client'
import { useLockBodyScroll, useMediaQuery, useMounted } from '@/lib/hooks'
import { signOut } from '@/app/(auth)/actions'
import type { Database } from '@/lib/database.types'

export { openCommandPalette } from '@/components/nav-links'

type Trainer = Database['public']['Functions']['search_profiles']['Returns'][number]

type GroupKey = 'recent' | 'nav' | 'actions' | 'search' | 'trainers'

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'recent', title: 'Recientes' },
  { key: 'nav', title: 'Navegación' },
  { key: 'actions', title: 'Acciones' },
  { key: 'search', title: 'Buscar' },
  { key: 'trainers', title: 'Entrenadores' },
]

type Command = {
  id: string
  group: GroupKey
  label: string
  hint?: string
  /** Sinónimos para el filtro; no se muestran. */
  keywords?: string
  icon?: LucideIcon
  avatar?: { src: string | null; name: string }
  badge?: { text: string; tone: 'brand' | 'muted' }
  tone?: 'danger'
  /** Resaltar en la etiqueta lo que coincide con la búsqueda. */
  highlight?: boolean
  perform: () => void
}

/* ---------- Búsqueda sin tildes ---------- */

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function toTerms(query: string) {
  return fold(query).split(/\s+/).filter(Boolean)
}

function matches(command: Command, terms: string[]) {
  const haystack = fold(`${command.label} ${command.keywords ?? ''}`)
  return terms.every((term) => haystack.includes(term))
}

/** Resalta cada término en `text` aunque difieran en tildes o mayúsculas. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>

  // Cada carácter plegado apunta a su carácter original (plegar puede cambiar longitudes).
  const chars = Array.from(text)
  let folded = ''
  const owner: number[] = []
  chars.forEach((char, i) => {
    const f = fold(char)
    folded += f
    for (let k = 0; k < f.length; k++) owner.push(i)
  })

  const marked: boolean[] = chars.map(() => false)
  for (const term of terms) {
    const at = folded.indexOf(term)
    if (at < 0) continue
    for (let p = at; p < at + term.length; p++) marked[owner[p]] = true
  }

  const parts: { text: string; mark: boolean }[] = []
  chars.forEach((char, i) => {
    const last = parts[parts.length - 1]
    if (last && last.mark === marked[i]) last.text += char
    else parts.push({ text: char, mark: marked[i] })
  })

  return (
    <>
      {parts.map((part, i) =>
        part.mark ? (
          <mark key={i} className="bg-transparent font-bold text-brand">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

/* ---------- Recientes (sólo en este navegador) ---------- */

type Recent = { href: string; label: string; hint: string; avatar: { src: string | null; name: string } | null }

const RECENTS_KEY = 'pokehub-palette-recent'
const MAX_RECENTS = 4

function isRecent(value: unknown): value is Recent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.href !== 'string' || !v.href.startsWith('/') || v.href.startsWith('//')) return false
  if (typeof v.label !== 'string' || typeof v.hint !== 'string') return false
  if (v.avatar === null) return true
  if (!v.avatar || typeof v.avatar !== 'object') return false
  const a = v.avatar as Record<string, unknown>
  return typeof a.name === 'string' && (a.src === null || typeof a.src === 'string')
}

function readRecents(): Recent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function rememberRecent(entry: Recent) {
  try {
    const next = [entry, ...readRecents().filter((r) => r.href !== entry.href)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {}
}

/* ---------- Utilidades de entorno ---------- */

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

// Con el teclado virtual abierto, el alto útil es el del visual viewport.
function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  viewport.addEventListener('resize', onChange)
  return () => viewport.removeEventListener('resize', onChange)
}

function useVisualViewportHeight(): number | null {
  return useSyncExternalStore(subscribeViewport, () => window.visualViewport?.height ?? null, () => null)
}

/* ---------- Paleta ---------- */

/**
 * Paleta de comandos global: Ctrl/⌘ K, «/» fuera de un campo de texto o el
 * evento `pokehub:palette`. Navegación, acciones y entrenadores en vivo.
 */
export function CommandPalette({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const mounted = useMounted()
  const pathname = usePathname()
  const openRef = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)

  // Si la ruta cambia por otra vía (atrás del navegador), la paleta no sigue encima.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  const show = useCallback(() => {
    if (openRef.current) return
    openRef.current = true
    const active = document.activeElement
    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    openRef.current = false
    setOpen(false)
    const target = returnFocus.current
    returnFocus.current = null
    if (target?.isConnected) target.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    // Con otra ventana modal abierta (una hoja, el menú) los atajos no la tapan:
    // dos trampas de foco a la vez se pelearían por el Tab.
    const otherModalOpen = () =>
      document.querySelector('[aria-modal="true"]:not([data-command-palette])') !== null

    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.repeat) return
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (openRef.current) {
          e.preventDefault()
          close()
        } else if (!otherModalOpen()) {
          e.preventDefault()
          show()
        }
        return
      }
      if (
        e.key === '/' &&
        !openRef.current &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditable(e.target) &&
        !otherModalOpen()
      ) {
        e.preventDefault()
        show()
      }
    }

    window.addEventListener(PALETTE_EVENT, show)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener(PALETTE_EVENT, show)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [show, close])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && <PaletteDialog key="command-palette" username={username} onClose={close} />}
    </AnimatePresence>,
    document.body,
  )
}

function PaletteDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const unread = useUnreadCount()
  const dark = useIsDark()
  const wide = useMediaQuery('(min-width: 640px)')
  const viewportHeight = useVisualViewportHeight()
  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (index: number) => `${uid}-option-${index}`

  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const request = useRef(0)
  // Sólo el teclado desplaza la lista hasta la fila activa; el ratón ya está encima.
  const scrollToActive = useRef(false)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [trainers, setTrainers] = useState<{ term: string; results: Trainer[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [recents] = useState(readRecents)

  useLockBodyScroll(true)

  const term = query.trim()
  const terms = useMemo(() => toTerms(term), [term])

  // Entrenadores en vivo, con espera corta y descartando respuestas viejas.
  useEffect(() => {
    const id = ++request.current
    if (term.length < 2) {
      setLoading(false)
      setTrainers(null)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc('search_profiles', { q: term, limit_count: 5 })
      if (id !== request.current) return
      setTrainers({ term, results: error || !data ? [] : data })
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [term])

  // Respaldo del autoFocus: algunos navegadores lo ignoran dentro de un portal recién montado.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true })
  }, [])

  /* ----- Comandos ----- */

  const navigate = (href: string, recent?: Recent) => () => {
    if (recent) rememberRecent(recent)
    router.push(href)
  }

  const here = (href: string): Command['badge'] =>
    isActivePath(pathname, href) ? { text: 'Estás aquí', tone: 'muted' } : undefined

  const navCommands: Command[] = [
    { id: 'nav-home', group: 'nav', label: 'Inicio', hint: 'Los últimos equipos de la comunidad', icon: Home, keywords: 'feed portada home equipos', badge: here('/home'), perform: navigate('/home') },
    { id: 'nav-search', group: 'nav', label: 'Buscar entrenadores', hint: 'Encuentra y sigue a otros entrenadores', icon: Search, keywords: 'usuarios gente perfiles seguir amigos', badge: here('/search'), perform: navigate('/search') },
    { id: 'nav-new', group: 'nav', label: 'Crear equipo', hint: 'Monta un equipo nuevo desde cero', icon: PlusCircle, keywords: 'nuevo builder team constructor montar', badge: here('/team/new'), perform: navigate('/team/new') },
    {
      id: 'nav-messages',
      group: 'nav',
      label: 'Mensajes',
      hint: 'Tus conversaciones privadas',
      icon: MessageSquare,
      keywords: 'chat chats conversaciones privados dm',
      badge: unread > 0 ? { text: `${unread} sin leer`, tone: 'brand' } : here('/messages'),
      perform: navigate('/messages'),
    },
    { id: 'nav-profile', group: 'nav', label: 'Mi perfil', hint: `@${username}`, icon: User, keywords: 'cuenta mis equipos perfil seguidores', badge: here(`/u/${username}`), perform: navigate(`/u/${username}`) },
    { id: 'nav-settings', group: 'nav', label: 'Configuración', hint: 'Perfil, avatar, tema y cuenta', icon: Settings, keywords: 'ajustes preferencias cuenta avatar tema contraseña', badge: here('/settings'), perform: navigate('/settings') },
    { id: 'nav-premium', group: 'nav', label: 'Premium', hint: 'Ventajas del plan Premium', icon: Sparkles, keywords: 'plan suscripcion pro mejorar', badge: here('/premium'), perform: navigate('/premium') },
    { id: 'nav-legal', group: 'nav', label: 'Aviso legal', hint: 'Privacidad, cookies y condiciones', icon: FileText, keywords: 'privacidad cookies terminos condiciones legal', badge: here('/legal'), perform: navigate('/legal') },
  ]

  const actionCommands: Command[] = [
    {
      id: 'action-theme',
      group: 'actions',
      label: dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
      hint: dark ? 'Pokéball: rojo y blanco' : 'Master Ball: morado y noche',
      icon: dark ? Sun : Moon,
      keywords: 'tema modo oscuro claro noche dia apariencia master ball pokeball colores',
      perform: () => {
        // Se espera a que la paleta se haya ido: el revelado no debe capturarla.
        window.setTimeout(() => {
          const toggle = Array.from(document.querySelectorAll('[data-theme-toggle]')).find(
            (el) => el.getClientRects().length > 0,
          )
          switchTheme(
            dark ? 'light' : 'dark',
            toggle ? revealOriginOf(toggle) : { x: window.innerWidth / 2, y: window.innerHeight / 3 },
          )
        }, 180)
      },
    },
    {
      id: 'action-random',
      group: 'actions',
      label: 'Equipo al azar',
      hint: 'Lanza una Poké Ball y a ver qué sale',
      icon: Dices,
      keywords: 'aleatorio sorpresa random suerte descubrir',
      perform: async () => {
        const supabase = createClient()
        const { count, error } = await supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('is_public', true)
        if (error || !count) {
          toast(error ? 'No se pudo buscar un equipo' : 'Todavía no hay equipos públicos', {
            tone: error ? 'error' : 'info',
          })
          return
        }
        const offset = Math.floor(Math.random() * count)
        const { data } = await supabase
          .from('teams')
          .select('id')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .range(offset, offset)
          .maybeSingle()
        if (data) router.push(`/team/${data.id}`)
        else toast('No se pudo abrir un equipo', { tone: 'error' })
      },
    },
    {
      id: 'action-copy',
      group: 'actions',
      label: 'Copiar enlace de mi perfil',
      hint: 'Para compartirlo donde quieras',
      icon: Link2,
      keywords: 'compartir url link perfil',
      perform: async () => {
        const url = `${window.location.origin}/u/${username}`
        try {
          await navigator.clipboard.writeText(url)
          toast('Enlace copiado', { tone: 'success', description: url })
        } catch {
          toast('No se pudo copiar el enlace', { tone: 'error' })
        }
      },
    },
    {
      id: 'action-logout',
      group: 'actions',
      label: 'Cerrar sesión',
      icon: LogOut,
      keywords: 'salir logout desconectar',
      tone: 'danger',
      perform: () => {
        void signOut()
      },
    },
  ]

  const commands: Command[] = []

  if (!term) {
    recents.forEach((recent, i) =>
      commands.push({
        id: `recent-${i}`,
        group: 'recent',
        label: recent.label,
        hint: recent.hint,
        icon: History,
        avatar: recent.avatar ?? undefined,
        perform: navigate(recent.href, recent),
      }),
    )
  }

  commands.push(...navCommands.filter((c) => matches(c, terms)))
  commands.push(...actionCommands.filter((c) => matches(c, terms)))

  if (term.length >= 2) {
    const teamsHref = `/search?q=${encodeURIComponent(term)}&tipo=equipos`
    const trainersHref = `/search?q=${encodeURIComponent(term)}`
    commands.push(
      {
        id: 'search-teams',
        group: 'search',
        label: `Buscar equipos con «${term}»`,
        hint: 'Por nombre del equipo o por Pokémon',
        icon: Swords,
        highlight: false,
        perform: navigate(teamsHref, { href: teamsHref, label: `«${term}»`, hint: 'Búsqueda de equipos', avatar: null }),
      },
      {
        id: 'search-trainers',
        group: 'search',
        label: `Buscar entrenadores «${term}»`,
        hint: 'Por nombre o por usuario',
        icon: Users,
        highlight: false,
        perform: navigate(trainersHref, {
          href: trainersHref,
          label: `«${term}»`,
          hint: 'Búsqueda de entrenadores',
          avatar: null,
        }),
      },
    )

    for (const trainer of trainers?.results ?? []) {
      const href = `/u/${trainer.username}`
      const teams = `${trainer.team_count} ${trainer.team_count === 1 ? 'equipo' : 'equipos'}`
      commands.push({
        id: `trainer-${trainer.id}`,
        group: 'trainers',
        label: trainer.display_name || trainer.username,
        hint: `@${trainer.username} · ${teams}`,
        keywords: trainer.username,
        avatar: { src: trainer.avatar_url, name: trainer.username },
        perform: navigate(href, {
          href,
          label: trainer.display_name || trainer.username,
          hint: `@${trainer.username}`,
          avatar: { src: trainer.avatar_url, name: trainer.username },
        }),
      })
    }
  }

  const active = commands.length > 0 ? Math.min(activeIndex, commands.length - 1) : -1

  const groups = GROUPS.map((group) => ({
    ...group,
    entries: commands.flatMap((command, index) => (command.group === group.key ? [{ command, index }] : [])),
  })).filter((group) => group.entries.length > 0)

  useEffect(() => {
    if (!scrollToActive.current) return
    scrollToActive.current = false
    // Al volver arriba del todo se ve también el título del primer grupo.
    if (active === 0) scrollRef.current?.scrollTo({ top: 0 })
    else document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })

  function move(delta: number) {
    if (commands.length === 0) return
    scrollToActive.current = true
    setActiveIndex((active + delta + commands.length) % commands.length)
  }

  function run(command: Command) {
    onClose()
    command.perform()
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const command = commands[active]
      if (command) run(command)
    }
  }

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    trapTabKey(e, panelRef.current)
  }

  function onQueryChange(value: string) {
    setQuery(value)
    setActiveIndex(0)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const trainersPending = term.length >= 2 && loading && !trainers?.results.length
  const noTrainers = term.length >= 2 && !loading && trainers?.term === term && trainers.results.length === 0

  // En móvil el panel no pasa del teclado virtual: la última fila siempre es alcanzable.
  const panelStyle =
    !wide && viewportHeight ? { maxHeight: `min(85dvh, ${Math.round(viewportHeight - 12)}px)` } : undefined

  return (
    <div className="fixed inset-0 z-[70]">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center sm:px-6 sm:pt-[min(14vh,9rem)]">
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda rápida"
          data-command-palette=""
          onKeyDown={onPanelKeyDown}
          style={panelStyle}
          className="pointer-events-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-b-3xl border-b border-line bg-bg-elevated pt-[env(safe-area-inset-top)] text-ink shadow-float sm:max-h-[min(72dvh,36rem)] sm:max-w-xl sm:rounded-3xl sm:border sm:pt-0 lg:max-w-2xl"
          initial={wide ? { opacity: 0, scale: 0.96, y: -10 } : { opacity: 0, y: -48 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            wide
              ? { opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.14, ease: 'easeIn' } }
              : { opacity: 0, y: -40, transition: { duration: 0.18, ease: 'easeIn' } }
          }
          transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.8 }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-line pl-4 pr-2 sm:gap-3 sm:pl-5 sm:pr-3">
            <Search aria-hidden size={20} className="shrink-0 text-brand" />
            <input
              ref={inputRef}
              // La paleta existe para escribir en ella: el foco entra directo al campo.
              autoFocus
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label="Buscar páginas, acciones o entrenadores"
              placeholder={wide ? 'Busca páginas, acciones o entrenadores…' : 'Buscar en PokeHub…'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:h-16 sm:text-[17px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('')
                  inputRef.current?.focus()
                }}
                aria-label="Borrar búsqueda"
                className="grid h-10 w-10 shrink-0 animate-scale-in place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 shrink-0 rounded-full px-3 text-[15px] font-semibold text-brand transition-colors active:bg-brand-soft sm:hidden"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              className="hidden shrink-0 rounded-md transition-opacity hover:opacity-80 sm:inline-flex"
            >
              <kbd className="shell-kbd">Esc</kbd>
            </button>
          </div>

          {/* layoutScroll: el resaltado que se desliza entre filas descuenta el scroll de la lista. */}
          <motion.div
            ref={scrollRef}
            layoutScroll
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
          >
            <div id={listId} role="listbox" aria-label="Resultados">
              {groups.map((group) => (
                <div key={group.key} role="group" aria-labelledby={`${uid}-${group.key}`} className="pt-1">
                  <div
                    id={`${uid}-${group.key}`}
                    className="flex items-center gap-2 px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted"
                  >
                    {group.title}
                    {group.key === 'trainers' && loading && (
                      <Loader2 aria-hidden size={12} className="animate-spin" />
                    )}
                  </div>
                  {group.entries.map(({ command, index }) => (
                    <PaletteRow
                      key={command.id}
                      id={optionId(index)}
                      command={command}
                      selected={index === active}
                      terms={command.highlight === false ? [] : terms}
                      layoutId={`${uid}-active`}
                      onHover={() => {
                        if (index !== active) setActiveIndex(index)
                      }}
                      onRun={() => run(command)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {trainersPending && (
              <div aria-hidden className="pt-1">
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Entrenadores <Loader2 size={12} className="animate-spin" />
                </div>
                {[0, 1].map((i) => (
                  <div key={i} className="flex min-h-[3.25rem] items-center gap-3 px-3 py-2 sm:min-h-12">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-1/3 rounded-md" />
                      <Skeleton className="h-2.5 w-1/4 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {noTrainers && (
              <p aria-hidden className="px-3 pb-2 pt-4 text-center text-xs text-muted">
                Ningún entrenador se llama así… todavía.
              </p>
            )}

            {commands.length === 0 && (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <PokeballIcon className="h-12 w-12 animate-wiggle" />
                <p className="mt-3 font-bold">Nada por aquí</p>
                <p className="mt-1 max-w-xs text-sm text-muted">
                  Prueba con otra palabra: una página, una acción o el nombre de un entrenador.
                </p>
              </div>
            )}
          </motion.div>

          <p className="sr-only" aria-live="polite">
            {term ? (loading ? 'Buscando…' : `${commands.length} resultados`) : ''}
          </p>

          <div className="hidden shrink-0 items-center justify-between gap-4 border-t border-line bg-ink/[.03] px-4 py-2.5 text-xs text-muted sm:flex">
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <kbd className="shell-kbd">↑</kbd>
                <kbd className="shell-kbd">↓</kbd>
                moverse
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="shell-kbd">↵</kbd>
                abrir
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="shell-kbd">Esc</kbd>
                cerrar
              </span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-ink/70">
              <PokeballIcon className="h-4 w-4" />
              PokeHub
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function PaletteRow({
  id,
  command,
  selected,
  terms,
  layoutId,
  onHover,
  onRun,
}: {
  id: string
  command: Command
  selected: boolean
  terms: string[]
  layoutId: string
  onHover: () => void
  onRun: () => void
}) {
  const Icon = command.icon
  const danger = command.tone === 'danger'

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onPointerMove={onHover}
      // Sin robar el foco al campo: en móvil se cerraría el teclado a mitad de gesto.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={clsx(
        'relative flex min-h-[3.25rem] cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 sm:min-h-12',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {selected && (
        <motion.span
          layoutId={layoutId}
          aria-hidden
          className={clsx('absolute inset-0 rounded-xl', danger ? 'bg-danger-soft' : 'bg-brand-soft')}
          transition={{ type: 'spring', stiffness: 700, damping: 50 }}
        />
      )}

      {command.avatar ? (
        <Avatar src={command.avatar.src} name={command.avatar.name} size={36} />
      ) : (
        Icon && (
          <span
            aria-hidden
            className={clsx(
              'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-150',
              selected
                ? danger
                  ? 'bg-danger text-white'
                  : 'bg-brand text-brand-fg shadow-card'
                : danger
                  ? 'bg-danger-soft'
                  : 'bg-ink/[.06] text-muted',
            )}
          >
            <Icon size={18} />
          </span>
        )
      )}

      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug sm:text-sm">
          <Highlight text={command.label} terms={terms} />
        </span>
        {command.hint && <span className="block truncate text-xs leading-snug text-muted">{command.hint}</span>}
      </span>

      {command.badge && (
        <span
          className={clsx(
            'relative shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
            command.badge.tone === 'brand' ? 'bg-brand text-brand-fg' : 'bg-ink/[.07] text-muted',
          )}
        >
          {command.badge.text}
        </span>
      )}

      <CornerDownLeft
        aria-hidden
        size={16}
        className={clsx(
          'relative hidden shrink-0 text-muted transition-opacity duration-150 sm:block',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
