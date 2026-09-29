'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { History, Loader2, Search, Swords, Trash2, Users, X } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Highlight } from '@/components/search/highlight'
import {
  clearRecentSearches,
  rememberSearch,
  useRecentSearches,
  type RecentSearch,
} from '@/components/search/recent-searches'
import { createClient } from '@/lib/supabase/client'
import { listPokemon } from '@/lib/pokeapi'
import { prettify, spriteUrl } from '@/lib/pokemon'
import {
  MAX_QUERY_LENGTH,
  MIN_SUGGEST_CHARS,
  cleanQuery,
  pokemonSlug,
  rankPokemonMatches,
  searchHref,
  type SearchTipo,
} from '@/lib/search'
import type { Database } from '@/lib/database.types'

type Trainer = Database['public']['Functions']['search_profiles']['Returns'][number]
type Pokemon = { id: number; name: string }

const TRAINER_SUGGESTIONS = 5
const POKEMON_SUGGESTIONS = 4
const DEBOUNCE_MS = 200

const TIPO_LABEL: Record<SearchTipo, string> = { entrenadores: 'Entrenadores', equipos: 'Equipos' }
const TIPO_HINT: Record<SearchTipo, string> = {
  entrenadores: 'Por nombre o por usuario',
  equipos: 'Por nombre del equipo o por Pokémon',
}

type Option =
  | { kind: 'search'; key: string; tipo: SearchTipo; primary: boolean }
  | { kind: 'pokemon'; key: string; pokemon: Pokemon }
  | { kind: 'trainer'; key: string; trainer: Trainer }
  | { kind: 'recent'; key: string; recent: RecentSearch }
  | { kind: 'clear'; key: string }

type GroupKey = 'recent' | 'search' | 'pokemon' | 'trainer'

const GROUP_OF: Record<Option['kind'], GroupKey> = {
  recent: 'recent',
  clear: 'recent',
  search: 'search',
  pokemon: 'pokemon',
  trainer: 'trainer',
}

const GROUP_TITLE: Record<GroupKey, string> = {
  recent: 'Búsquedas recientes',
  search: 'Buscar',
  pokemon: 'Pokémon',
  trainer: 'Entrenadores',
}

const otherTipo = (tipo: SearchTipo): SearchTipo => (tipo === 'equipos' ? 'entrenadores' : 'equipos')

// Lista de la PokéAPI compartida por todos los cuadros y entre montajes: son
// unos 1300 nombres que sólo se piden la primera vez que se enfoca un cuadro.
let pokedexRequest: Promise<Pokemon[]> | null = null

function loadPokedex(): Promise<Pokemon[]> {
  pokedexRequest ??= listPokemon().catch((error: unknown) => {
    // Sin red no se guarda el fallo: el próximo foco lo vuelve a intentar.
    pokedexRequest = null
    throw error
  })
  return pokedexRequest
}

/**
 * Cuadro de búsqueda con sugerencias en vivo: entrenadores (RPC
 * search_profiles), Pokémon (PokéAPI) y búsquedas recientes. Es un combobox
 * ARIA: el foco se queda en el campo y las flechas mueven la fila activa.
 *
 * Sin props es el de la columna derecha de la portada; la página /search lo
 * usa en grande, con el término de la URL y el modo de su pestaña.
 */
export function SearchBox({
  autoFocus = false,
  defaultValue = '',
  tipo,
  size = 'md',
  className,
}: {
  /** Enfoca el campo al montar, sólo con ratón o trackpad: en móvil abriría el teclado encima de todo. */
  autoFocus?: boolean
  /** Texto inicial. Si cambia (otra búsqueda en la URL), el campo lo adopta. */
  defaultValue?: string
  /** Modo al pulsar Intro. Sin él se deduce: equipos si lo escrito es un Pokémon; si no, entrenadores. */
  tipo?: SearchTipo
  size?: 'md' | 'lg'
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const optionId = (index: number) => `${uid}-option-${index}`

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const request = useRef(0)
  const trainerCache = useRef(new Map<string, Trainer[]>())
  // Sólo el teclado desplaza la lista hasta la fila activa; el ratón ya está encima.
  const scrollToActive = useRef(false)
  // El autoenfoque no abre el desplegable: taparía la página nada más llegar.
  const silentFocus = useRef(false)

  const [query, setQuery] = useState(defaultValue)
  const [syncedDefault, setSyncedDefault] = useState(defaultValue)
  if (defaultValue !== syncedDefault) {
    setSyncedDefault(defaultValue)
    setQuery(defaultValue)
  }

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pokedex, setPokedex] = useState<Pokemon[] | null>(null)
  const [trainers, setTrainers] = useState<{ term: string; results: Trainer[] } | null>(null)
  const [loadingTrainers, setLoadingTrainers] = useState(false)
  const [navigating, startNavigation] = useTransition()
  const recents = useRecentSearches()

  const term = cleanQuery(query)
  const suggest = term.length >= MIN_SUGGEST_CHARS

  // Entrenadores en vivo: espera corta, respuestas viejas descartadas y caché
  // por término para que borrar una letra no repita la petición.
  useEffect(() => {
    const id = ++request.current
    if (!open || !suggest) {
      setLoadingTrainers(false)
      return
    }
    const cached = trainerCache.current.get(term.toLowerCase())
    if (cached) {
      setTrainers({ term, results: cached })
      setLoadingTrainers(false)
      return
    }
    setLoadingTrainers(true)
    const timer = window.setTimeout(async () => {
      let results: Trainer[] | null = null
      try {
        const { data, error } = await createClient().rpc('search_profiles', {
          q: term,
          limit_count: TRAINER_SUGGESTIONS,
        })
        if (!error) results = data ?? []
      } catch {
        // Sin red: se queda sin entrenadores sugeridos, Intro sigue funcionando.
      }
      if (id !== request.current) return
      if (results) trainerCache.current.set(term.toLowerCase(), results)
      setTrainers({ term, results: results ?? [] })
      setLoadingTrainers(false)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [open, suggest, term])

  useEffect(() => {
    if (!autoFocus || !window.matchMedia('(pointer: fine)').matches) return
    silentFocus.current = true
    inputRef.current?.focus({ preventScroll: true })
    silentFocus.current = false
  }, [autoFocus])

  const pokemon = useMemo(
    () => (pokedex && suggest ? rankPokemonMatches(pokedex, term, POKEMON_SUGGESTIONS) : []),
    [pokedex, suggest, term],
  )

  // «garchomp» + Intro en la portada busca equipos con Garchomp, no entrenadores
  // que se llamen así. La primera fila del desplegable deja claro qué hará.
  const exactPokemon = suggest && pokemon[0]?.name === pokemonSlug(term)
  const primary: SearchTipo = tipo ?? (exactPokemon ? 'equipos' : 'entrenadores')

  const options: Option[] = []
  if (!term) {
    for (const recent of recents) options.push({ kind: 'recent', key: `recent-${recent.tipo}-${recent.q}`, recent })
    if (recents.length > 0) options.push({ kind: 'clear', key: 'clear' })
  } else {
    options.push({ kind: 'search', key: `search-${primary}`, tipo: primary, primary: true })
    options.push({ kind: 'search', key: `search-${otherTipo(primary)}`, tipo: otherTipo(primary), primary: false })
    for (const entry of pokemon) options.push({ kind: 'pokemon', key: `pokemon-${entry.id}`, pokemon: entry })
    if (suggest) {
      for (const trainer of trainers?.results ?? []) {
        options.push({ kind: 'trainer', key: `trainer-${trainer.id}`, trainer })
      }
    }
  }

  const visible = open && options.length > 0
  const active = activeIndex < options.length ? activeIndex : -1

  const groups: { key: GroupKey; entries: { option: Option; index: number }[] }[] = []
  options.forEach((option, index) => {
    const key = GROUP_OF[option.kind]
    const last = groups[groups.length - 1]
    if (last?.key === key) last.entries.push({ option, index })
    else groups.push({ key, entries: [{ option, index }] })
  })

  const trainersPending = suggest && loadingTrainers && !trainers?.results.length
  const noTrainers = suggest && !loadingTrainers && trainers?.term === term && trainers.results.length === 0
  const busy = navigating || (visible && suggest && loadingTrainers)

  useEffect(() => {
    if (!scrollToActive.current) return
    scrollToActive.current = false
    // Al volver arriba del todo se ve también el título del primer grupo.
    if (active <= 0) scrollRef.current?.scrollTo({ top: 0 })
    else document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })

  function ensurePokedex() {
    if (pokedex) return
    loadPokedex()
      .then(setPokedex)
      .catch(() => {
        // Sin la lista no hay Pokémon sugeridos; lo demás sigue igual.
      })
  }

  function openPopup() {
    ensurePokedex()
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function navigate(href: string, nextQuery?: string) {
    if (nextQuery !== undefined) setQuery(nextQuery)
    close()
    // En táctil se suelta el foco para que baje el teclado y se vean los resultados.
    if (window.matchMedia('(pointer: coarse)').matches) inputRef.current?.blur()
    startNavigation(() => router.push(href))
  }

  function search(q: string, mode: SearchTipo) {
    rememberSearch({ q, tipo: mode })
    navigate(searchHref({ q, tipo: mode }), q)
  }

  function choose(option: Option) {
    switch (option.kind) {
      case 'search':
        search(term, option.tipo)
        break
      case 'pokemon':
        search(prettify(option.pokemon.name), 'equipos')
        break
      case 'trainer':
        navigate(`/u/${option.trainer.username}`)
        break
      case 'recent':
        search(option.recent.q, option.recent.tipo)
        break
      case 'clear':
        clearRecentSearches()
        setActiveIndex(-1)
        break
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (term) {
      search(term, primary)
      return
    }
    // Vaciar el campo y pulsar Intro en /search vuelve a las sugerencias.
    if (pathname === '/search') navigate(searchHref({ tipo: primary }), '')
  }

  function onChange(value: string) {
    setQuery(value)
    setActiveIndex(-1)
    openPopup()
    scrollRef.current?.scrollTo({ top: 0 })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        if (!visible) {
          openPopup()
          return
        }
        if (e.altKey) return
        // El -1 es el propio campo: al pasar de la última fila se vuelve a lo escrito.
        const slots = options.length + 1
        const step = e.key === 'ArrowDown' ? 1 : -1
        scrollToActive.current = true
        setActiveIndex(((active + 1 + step + slots) % slots) - 1)
        break
      }
      case 'Enter':
        if (visible && active >= 0) {
          e.preventDefault()
          choose(options[active])
        }
        break
      case 'Escape':
        // preventDefault también evita que el navegador vacíe el type="search" por su cuenta.
        if (visible) {
          e.preventDefault()
          close()
        } else if (query) {
          e.preventDefault()
          setQuery('')
        }
        break
    }
  }

  const announcement = !visible
    ? ''
    : term
      ? `${options.length} ${options.length === 1 ? 'sugerencia' : 'sugerencias'}`
      : `${recents.length} ${recents.length === 1 ? 'búsqueda reciente' : 'búsquedas recientes'}`

  const label =
    tipo === 'equipos' ? 'Buscar equipos' : tipo === 'entrenadores' ? 'Buscar entrenadores' : 'Buscar en PokeHub'
  const placeholder =
    tipo === 'equipos'
      ? 'Nombre del equipo o Pokémon…'
      : tipo === 'entrenadores'
        ? 'Nombre o usuario del entrenador…'
        : 'Entrenadores, equipos o Pokémon…'
  const lg = size === 'lg'

  return (
    <div className={clsx('search-box relative', className)}>
      <form role="search" action="/search" onSubmit={onSubmit} className="relative">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <span
          aria-hidden
          className={clsx(
            'search-box-icon pointer-events-none absolute top-1/2 -translate-y-1/2',
            lg ? 'left-4.5' : 'left-3.5',
          )}
        >
          {busy ? (
            <Loader2 size={lg ? 20 : 17} className="animate-spin" />
          ) : (
            <Search size={lg ? 20 : 17} strokeWidth={lg ? 2.25 : 2} />
          )}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible && active >= 0 ? optionId(active) : undefined}
          placeholder={placeholder}
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (silentFocus.current) ensurePokedex()
            else openPopup()
          }}
          onPointerDown={openPopup}
          onBlur={close}
          className={clsx(
            'search-input w-full min-w-0',
            lg
              ? 'h-13 pl-12 text-base sm:h-14 sm:pl-13 sm:text-[17px]'
              : 'h-11 pl-10 text-sm',
            // Hueco para los botones de la derecha, que tapan el final del texto.
            lg ? (query ? 'pr-24 sm:pr-36' : 'pr-14 sm:pr-28') : query ? 'pr-12' : 'pr-4',
          )}
        />
        {/* Sin JS el formulario sigue funcionando: GET a /search con el modo. */}
        {tipo === 'equipos' && <input type="hidden" name="tipo" value="equipos" />}

        <div className={clsx('absolute inset-y-0 flex items-center gap-1', lg ? 'right-1.5 sm:right-2' : 'right-1')}>
          {query && (
            <button
              type="button"
              // Sin robar el foco: el desplegable se queda abierto con las recientes.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('')
                inputRef.current?.focus()
              }}
              aria-label="Borrar lo escrito"
              title="Borrar"
              className="btn btn-ghost btn-icon btn-sm animate-scale-in text-muted hover:text-ink"
            >
              <X size={17} aria-hidden />
            </button>
          )}
          {lg && (
            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Buscar"
              className="btn btn-primary h-10 w-10 px-0 sm:h-11 sm:w-auto sm:px-5"
            >
              <Search size={18} strokeWidth={2.5} aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
          )}
        </div>
      </form>

      {/* mousedown sin acción: pulsar dentro no debe quitar el foco al campo y cerrarlo. */}
      <div className="search-popover" data-open={visible} onMouseDown={(e) => e.preventDefault()}>
        <div ref={scrollRef} className="search-popover-scroll">
          <div id={listId} role="listbox" aria-label="Sugerencias de búsqueda">
            {groups.map((group) => (
              <div key={group.key} role="group" aria-labelledby={`${uid}-group-${group.key}`}>
                <div id={`${uid}-group-${group.key}`} className="search-group-title">
                  {GROUP_TITLE[group.key]}
                  {group.key === 'trainer' && loadingTrainers && (
                    <Loader2 aria-hidden size={12} className="animate-spin" />
                  )}
                </div>
                {group.entries.map(({ option, index }) => (
                  <SuggestionRow
                    key={option.key}
                    id={optionId(index)}
                    option={option}
                    term={term}
                    selected={index === active}
                    enterHint={option.kind === 'search' && option.primary && active === -1}
                    onHover={() => {
                      if (index !== active) setActiveIndex(index)
                    }}
                    onChoose={() => choose(option)}
                  />
                ))}
              </div>
            ))}
          </div>

          {trainersPending && (
            <div aria-hidden>
              <div className="search-group-title">
                Entrenadores <Loader2 size={12} className="animate-spin" />
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="flex min-h-[3.25rem] items-center gap-3 px-2.5 py-1.5">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/5 rounded-md" />
                    <Skeleton className="h-2.5 w-1/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {noTrainers && (
            <p aria-hidden className="px-3 pb-2 pt-3 text-center text-xs text-muted">
              Ningún entrenador se llama así… todavía.
            </p>
          )}
        </div>

        <div
          aria-hidden
          className="hidden shrink-0 items-center gap-3 border-t border-line bg-ink/[.03] px-3.5 py-2 text-[11px] text-muted pointer-fine:flex"
        >
          <span className="flex items-center gap-1">
            <kbd className="search-kbd">↑</kbd>
            <kbd className="search-kbd">↓</kbd>
            moverse
          </span>
          <span className="flex items-center gap-1">
            <kbd className="search-kbd">↵</kbd>
            elegir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="search-kbd">Esc</kbd>
            cerrar
          </span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}

function SuggestionRow({
  id,
  option,
  term,
  selected,
  enterHint,
  onHover,
  onChoose,
}: {
  id: string
  option: Option
  term: string
  selected: boolean
  /** Es lo que hará Intro si no se ha elegido ninguna fila. */
  enterHint: boolean
  onHover: () => void
  onChoose: () => void
}) {
  let visual: React.ReactNode
  let title: React.ReactNode
  let hint: React.ReactNode = null

  switch (option.kind) {
    case 'search': {
      const Icon = option.tipo === 'equipos' ? Swords : Users
      visual = (
        <span aria-hidden className="search-option-icon">
          <Icon size={18} />
        </span>
      )
      title = (
        <>
          {TIPO_LABEL[option.tipo]} con «<span className="[overflow-wrap:anywhere]">{term}</span>»
        </>
      )
      hint = TIPO_HINT[option.tipo]
      break
    }
    case 'pokemon': {
      const name = prettify(option.pokemon.name)
      visual = (
        <span aria-hidden className="search-option-sprite">
          <Image src={spriteUrl(option.pokemon.id)} alt="" width={96} height={96} unoptimized draggable={false} />
        </span>
      )
      title = <Highlight text={name} term={term} />
      hint = `Equipos con ${name}`
      break
    }
    case 'trainer': {
      const { trainer } = option
      const name = trainer.display_name?.trim() || trainer.username
      const teams = `${trainer.team_count} ${trainer.team_count === 1 ? 'equipo' : 'equipos'}`
      visual = <Avatar src={trainer.avatar_url} name={trainer.username} size={36} />
      title = <Highlight text={name} term={term} />
      hint = (
        <>
          @<Highlight text={trainer.username} term={term} /> · {teams}
        </>
      )
      break
    }
    case 'recent':
      visual = (
        <span aria-hidden className="search-option-icon">
          <History size={17} />
        </span>
      )
      title = option.recent.q
      hint = TIPO_LABEL[option.recent.tipo]
      break
    case 'clear':
      visual = (
        <span aria-hidden className="search-option-icon">
          <Trash2 size={16} />
        </span>
      )
      title = 'Borrar búsquedas recientes'
      break
  }

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-tone={option.kind === 'clear' ? 'muted' : undefined}
      // Sólo con ratón: en táctil, arrastrar para desplazar la lista no debe mover la fila activa.
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') onHover()
      }}
      onClick={onChoose}
      className="search-option"
    >
      {visual}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{title}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-muted">{hint}</span>}
      </span>
      {enterHint && (
        <kbd aria-hidden className="search-kbd hidden animate-fade-in pointer-fine:inline-flex">
          ↵
        </kbd>
      )}
    </div>
  )
}
