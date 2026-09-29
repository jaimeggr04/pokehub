import { slug } from '@/lib/showdown'

/*
 * Utilidades de búsqueda sin dependencias de servidor ni de navegador: las
 * comparten la página /search (servidor) y el cuadro de búsqueda (cliente).
 */

export type SearchTipo = 'entrenadores' | 'equipos'

/** Más no aporta nada y sólo alarga la URL y las consultas. */
export const MAX_QUERY_LENGTH = 60

/** A partir de cuántas letras se sugiere mientras se escribe. */
export const MIN_SUGGEST_CHARS = 2

type Param = string | string[] | undefined

export function firstParam(value: Param): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

export function parseTipo(value: Param): SearchTipo {
  return firstParam(value) === 'equipos' ? 'equipos' : 'entrenadores'
}

/** Espacios colapsados y longitud acotada: es lo que se busca y lo que se enseña. */
export function cleanQuery(value: Param): string {
  return firstParam(value).replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH).trim()
}

/** URL canónica de una búsqueda. Entrenadores es el modo por defecto y no lleva `tipo`. */
export function searchHref({ q, tipo }: { q?: string; tipo?: SearchTipo }): string {
  const params = new URLSearchParams()
  const term = q?.trim()
  if (term) params.set('q', term)
  if (tipo === 'equipos') params.set('tipo', 'equipos')
  const query = params.toString()
  return query ? `/search?${query}` : '/search'
}

/* ------------------------------ Pokémon ------------------------------ */

// Prefijos de forma tal y como la gente los escribe, al sufijo de la PokéAPI:
// «Mega Charizard X» es charizard-mega-x y «Raichu de Alola», raichu-alola.
const FORM_WORDS: Record<string, string> = {
  mega: 'mega',
  gmax: 'gmax',
  gigamax: 'gmax',
  gigantamax: 'gmax',
  alola: 'alola',
  alolan: 'alola',
  galar: 'galar',
  galarian: 'galar',
  hisui: 'hisui',
  hisuian: 'hisui',
  paldea: 'paldea',
  paldean: 'paldea',
}

const FILLER_WORDS = new Set(['de', 'del', 'la', 'el'])

/**
 * Convierte lo escrito en un slug de la PokéAPI. Sólo deja [a-z0-9-], así que
 * el resultado se puede meter tal cual en un patrón ilike sin escapar nada.
 */
export function pokemonSlug(term: string): string {
  const words = slug(term)
    .replace(/[^a-z0-9-]/g, '')
    .split('-')
    .filter((word) => word && !FILLER_WORDS.has(word))
    .map((word) => FORM_WORDS[word] ?? word)

  if (words.length > 1 && FORM_WORDS[words[0]]) words.splice(0, 2, words[1], words[0])
  return words.join('-')
}

// Las formas (ids 10000+) van detrás de su especie: quien escribe «char»
// busca a Charizard antes que a Charizard Gigamax.
const FORM_ID_START = 10000

/**
 * Los mejores `limit` Pokémon para lo escrito: coincidencia exacta, luego los
 * que empiezan igual, luego los que tienen una palabra que empieza igual y por
 * último cualquier coincidencia.
 */
export function rankPokemonMatches<T extends { id: number; name: string }>(
  list: readonly T[],
  term: string,
  limit: number,
): T[] {
  const needle = pokemonSlug(term)
  if (needle.length < MIN_SUGGEST_CHARS) return []

  const scored: { entry: T; rank: number }[] = []
  for (const entry of list) {
    const at = entry.name.indexOf(needle)
    if (at === -1) continue
    const rank = entry.name === needle ? 0 : at === 0 ? 1 : entry.name[at - 1] === '-' ? 2 : 3
    scored.push({ entry, rank })
  }

  return scored
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(a.entry.id >= FORM_ID_START) - Number(b.entry.id >= FORM_ID_START) ||
        a.entry.name.length - b.entry.name.length ||
        a.entry.id - b.entry.id,
    )
    .slice(0, limit)
    .map((item) => item.entry)
}

/* ------------------------------ Consultas ------------------------------ */

/**
 * Escapa un texto para usarlo dentro de un patrón ilike. PostgREST además
 * convierte `*` en `%`: se sustituye por `_` (un carácter cualquiera, que
 * incluye al propio asterisco) para que no actúe como comodín de varios.
 * Las comas y paréntesis no molestan porque el valor no va dentro de un `or`.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, '_')
}

/* ------------------------------ Resaltado ------------------------------ */

export type HighlightPart = { text: string; match: boolean }

/** Sin tildes ni mayúsculas, carácter a carácter para no perder las posiciones. */
function fold(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Trocea `text` marcando dónde aparece `term`, ignorando tildes y mayúsculas:
 * «jose» resalta «José». Los trozos conservan el texto original.
 */
export function highlightParts(text: string, term: string): HighlightPart[] {
  const needle = Array.from(term.trim()).map(fold).join('')
  if (!needle) return [{ text, match: false }]

  const chars = Array.from(text)
  // Posición de cada carácter original dentro del texto plegado.
  const starts: number[] = []
  let haystack = ''
  for (const char of chars) {
    starts.push(haystack.length)
    haystack += fold(char)
  }

  // Carácter original que contiene la posición `offset` del texto plegado.
  const charAt = (offset: number) => {
    let index = 0
    while (index + 1 < starts.length && starts[index + 1] <= offset) index++
    return index
  }

  const parts: HighlightPart[] = []
  let cursor = 0
  let from = haystack.indexOf(needle)
  while (from !== -1) {
    const first = charAt(from)
    const last = charAt(from + needle.length - 1)
    if (first > cursor) parts.push({ text: chars.slice(cursor, first).join(''), match: false })
    parts.push({ text: chars.slice(first, last + 1).join(''), match: true })
    cursor = last + 1
    from = haystack.indexOf(needle, starts[last] + fold(chars[last]).length)
  }
  if (cursor < chars.length) parts.push({ text: chars.slice(cursor).join(''), match: false })
  return parts.length ? parts : [{ text, match: false }]
}
