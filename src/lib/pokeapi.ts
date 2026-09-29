'use client'

/**
 * Cliente ligero de PokeAPI con caché en memoria + sessionStorage.
 * Todas las llamadas ocurren en el navegador, así que el render del servidor
 * nunca depende de una API externa.
 */

const API = 'https://pokeapi.co/api/v2'
const memory = new Map<string, unknown>()
// Peticiones en curso: seis fichas de un equipo pidiendo "protect" a la vez
// comparten una sola descarga en vez de lanzar seis.
const inflight = new Map<string, Promise<unknown>>()

/**
 * `slim` recorta la respuesta antes de guardarla: una ficha de /pokemon trae
 * cientos de KB de historial de movimientos que nadie usa, y sin recortar
 * bastan unas pocas para llenar la cuota de sessionStorage.
 */
async function get<T>(path: string, slim?: (raw: T) => T): Promise<T> {
  if (memory.has(path)) return memory.get(path) as T

  if (typeof window !== 'undefined') {
    try {
      const cached = window.sessionStorage.getItem('pokeapi:' + path)
      if (cached) {
        const parsed = JSON.parse(cached) as T
        memory.set(path, parsed)
        return parsed
      }
    } catch { /* sessionStorage no disponible */ }
  }

  const pending = inflight.get(path)
  if (pending) return pending as Promise<T>

  const request = (async () => {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) throw new Error(`PokeAPI ${res.status} en ${path}`)
    const raw = (await res.json()) as T
    const data = slim ? slim(raw) : raw
    memory.set(path, data)
    try {
      window.sessionStorage.setItem('pokeapi:' + path, JSON.stringify(data))
    } catch { /* cuota llena: la caché en memoria basta */ }
    return data
  })()

  inflight.set(path, request)
  try {
    return await request
  } finally {
    inflight.delete(path)
  }
}

export interface PokemonAbility {
  name: string
  hidden: boolean
}

export interface PokemonDetail {
  id: number
  name: string
  types: string[]
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  abilities: string[]
  /** Igual que `abilities`, pero conservando cuál es la habilidad oculta. */
  abilityDetails: PokemonAbility[]
  /** Movimientos que la especie puede aprender, para acotar el selector. */
  moves: string[]
  height: number
  weight: number
  cry: string | null
  /** Especie (= nº de Pokédex nacional). Difiere de `id` en las formas: Mega Charizard X es 10034, especie 6. */
  speciesId?: number
}

interface RawPokemon {
  id: number
  name: string
  height: number
  weight: number
  types: { slot: number; type: { name: string } }[]
  stats: { base_stat: number; stat: { name: string } }[]
  abilities: { ability: { name: string }; is_hidden: boolean }[]
  moves?: { move: { name: string } }[]
  cries?: { latest?: string | null }
  species?: { name: string; url: string }
}

/** Sólo lo que lee esta capa; el resto de la respuesta no se guarda. */
function slimPokemon(raw: RawPokemon): RawPokemon {
  return {
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    types: raw.types.map((t) => ({ slot: t.slot, type: { name: t.type.name } })),
    stats: raw.stats.map((s) => ({ base_stat: s.base_stat, stat: { name: s.stat.name } })),
    abilities: raw.abilities.map((a) => ({ ability: { name: a.ability.name }, is_hidden: a.is_hidden })),
    moves: (raw.moves ?? []).map((m) => ({ move: { name: m.move.name } })),
    cries: { latest: raw.cries?.latest ?? null },
    species: raw.species ? { name: raw.species.name, url: raw.species.url } : undefined,
  }
}

async function getRawPokemon(idOrName: number | string) {
  const raw = await get<RawPokemon>(`/pokemon/${idOrName}`, slimPokemon)
  // Se guarda también por número: el creador pide cada especie por nombre al
  // importar o al sortear, y luego su ficha la vuelve a pedir por id.
  const byId = `/pokemon/${raw.id}`
  if (!memory.has(byId)) memory.set(byId, raw)
  return raw
}

const STAT_MAP: Record<string, keyof PokemonDetail['baseStats']> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
}

export async function getPokemon(idOrName: number | string): Promise<PokemonDetail> {
  const raw = await getRawPokemon(idOrName)
  const baseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  for (const s of raw.stats) {
    const key = STAT_MAP[s.stat.name]
    if (key) baseStats[key] = s.base_stat
  }
  const abilityDetails = raw.abilities.map((a) => ({
    name: a.ability.name,
    hidden: a.is_hidden,
  }))

  return {
    id: raw.id,
    name: raw.name,
    types: [...raw.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    baseStats,
    abilities: abilityDetails.map((a) => a.name),
    abilityDetails,
    moves: (raw.moves ?? []).map((m) => m.move.name).sort(),
    height: raw.height,
    weight: raw.weight,
    cry: raw.cries?.latest ?? null,
    speciesId: raw.species ? idFromUrl(raw.species.url) || undefined : undefined,
  }
}

interface RawSpecies {
  varieties?: { is_default: boolean; pokemon: { name: string } }[]
}

interface RawSpeciesDetail extends RawSpecies {
  id: number
  is_legendary?: boolean
  is_mythical?: boolean
  genera?: { genus: string; language: { name: string } }[]
  flavor_text_entries?: { flavor_text: string; language: { name: string } }[]
}

export interface SpeciesInfo {
  /** Nº de la Pokédex nacional (el de la especie, también en las formas). */
  dexNumber: number
  /** Categoría en español, p. ej. "Pokémon Ratón". */
  genus: string | null
  /** Entrada de la Pokédex en español, en una sola línea. */
  flavor: string | null
  legendary: boolean
  mythical: boolean
}

// Primero el español de España; el latinoamericano sólo si falta.
const SPANISH = ['es', 'es-419']

function isSpanish(entry: { language: { name: string } }) {
  return SPANISH.includes(entry.language.name)
}

/** Los textos vienen con los saltos de línea de la pantalla de la consola y guiones blandos. */
function normalizeFlavor(text: string) {
  return text.replace(/\u00ad\s*/g, '').replace(/\s+/g, ' ').trim()
}

function slimSpecies(raw: RawSpeciesDetail): RawSpeciesDetail {
  return {
    id: raw.id,
    is_legendary: raw.is_legendary,
    is_mythical: raw.is_mythical,
    genera: (raw.genera ?? []).filter(isSpanish),
    flavor_text_entries: (raw.flavor_text_entries ?? []).filter(isSpanish),
    varieties: raw.varieties,
  }
}

/**
 * Categoría y entrada de Pokédex en español. Se llega a la especie desde la
 * ficha (ya en caché si se pidió getPokemon), así las formas alternativas
 * comparten la descripción de su especie.
 */
export async function getSpeciesInfo(pokemonId: number): Promise<SpeciesInfo> {
  const pokemon = await getRawPokemon(pokemonId)
  const speciesId = pokemon.species ? idFromUrl(pokemon.species.url) : 0
  const raw = await get<RawSpeciesDetail>(`/pokemon-species/${speciesId || pokemonId}`, slimSpecies)

  const pick = <T extends { language: { name: string } }>(list: T[] | undefined, latest: boolean) => {
    for (const lang of SPANISH) {
      const matches = (list ?? []).filter((e) => e.language.name === lang)
      if (matches.length) return latest ? matches[matches.length - 1] : matches[0]
    }
    return null
  }

  // La entrada más reciente: los textos de los juegos nuevos están mejor redactados.
  const flavor = pick(raw.flavor_text_entries, true)
  return {
    dexNumber: raw.id,
    genus: pick(raw.genera, false)?.genus ?? null,
    flavor: flavor ? normalizeFlavor(flavor.flavor_text) : null,
    legendary: Boolean(raw.is_legendary),
    mythical: Boolean(raw.is_mythical),
  }
}

/**
 * Muchas especies no existen bajo su nombre base en /pokemon: Aegislash es
 * "aegislash-shield", Zygarde es "zygarde-50", Giratina "giratina-altered"…
 * /pokemon-species sí acepta el nombre base y dice cuál es la forma por
 * defecto, así que sirve de red para todas ellas sin listarlas a mano.
 */
async function defaultForm(name: string): Promise<string | null> {
  try {
    const raw = await get<RawSpeciesDetail>(`/pokemon-species/${name}`, slimSpecies)
    return raw.varieties?.find((v) => v.is_default)?.pokemon.name ?? null
  } catch {
    return null
  }
}

/**
 * Prueba varios slugs y devuelve el primero que exista. Lo usa la importación de
 * Showdown, donde el nombre de una forma puede no coincidir con la PokéAPI.
 */
export async function resolvePokemon(candidates: string[]): Promise<PokemonDetail | null> {
  for (const name of candidates) {
    try {
      return await getPokemon(name)
    } catch {
      // 404: puede ser una especie cuya forma por defecto tiene otro nombre.
      const form = await defaultForm(name)
      if (form) {
        try {
          return await getPokemon(form)
        } catch {
          // Sigue sin existir: se prueba el siguiente candidato.
        }
      }
    }
  }
  return null
}

export interface MoveDetail {
  name: string
  type: string
  damageClass: 'physical' | 'special' | 'status'
  power: number | null
  accuracy: number | null
  pp: number | null
}

interface RawMove {
  name: string
  type: { name: string }
  damage_class: { name: string }
  power: number | null
  accuracy: number | null
  pp: number | null
}

export async function getMove(name: string): Promise<MoveDetail> {
  const raw = await get<RawMove>(`/move/${name}`)
  return {
    name: raw.name,
    type: raw.type.name,
    damageClass: raw.damage_class.name as MoveDetail['damageClass'],
    power: raw.power,
    accuracy: raw.accuracy,
    pp: raw.pp,
  }
}

export async function getMoves(names: (string | null | undefined)[]) {
  const clean = names.filter(Boolean) as string[]
  const settled = await Promise.allSettled(clean.map((n) => getMove(n)))
  return settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : ({ name: clean[i], type: 'unknown', damageClass: 'status', power: null, accuracy: null, pp: null } as MoveDetail),
  )
}

/* ---------- Listados para los selectores del creador de equipos ---------- */

interface NamedList {
  results: { name: string; url: string }[]
}

function idFromUrl(url: string) {
  const m = url.match(/\/(\d+)\/?$/)
  return m ? Number(m[1]) : 0
}

export async function listPokemon(): Promise<{ id: number; name: string }[]> {
  const raw = await get<NamedList>('/pokemon?limit=100000')
  return raw.results.map((r) => ({ id: idFromUrl(r.url), name: r.name }))
}

/**
 * Los sprites de objetos se sirven por nombre, no por id, así que el listado ya
 * trae todo lo necesario para pintar icono + nombre sin una petición por objeto.
 */
export async function listItems(): Promise<{ id: number; name: string }[]> {
  const raw = await get<NamedList>('/item?limit=100000')
  return raw.results.map((r) => ({ id: idFromUrl(r.url), name: r.name }))
}
