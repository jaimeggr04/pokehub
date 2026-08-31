'use client'

/**
 * Cliente ligero de PokeAPI con caché en memoria + sessionStorage.
 * Todas las llamadas ocurren en el navegador, así que el render del servidor
 * nunca depende de una API externa.
 */

const API = 'https://pokeapi.co/api/v2'
const memory = new Map<string, unknown>()

async function get<T>(path: string): Promise<T> {
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

  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`PokeAPI ${res.status} en ${path}`)
  const data = (await res.json()) as T
  memory.set(path, data)
  try {
    window.sessionStorage.setItem('pokeapi:' + path, JSON.stringify(data))
  } catch { /* cuota llena: la caché en memoria basta */ }
  return data
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
  const raw = await get<RawPokemon>(`/pokemon/${idOrName}`)
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
  }
}

interface RawSpecies {
  varieties?: { is_default: boolean; pokemon: { name: string } }[]
}

/**
 * Muchas especies no existen bajo su nombre base en /pokemon: Aegislash es
 * "aegislash-shield", Zygarde es "zygarde-50", Giratina "giratina-altered"…
 * /pokemon-species sí acepta el nombre base y dice cuál es la forma por
 * defecto, así que sirve de red para todas ellas sin listarlas a mano.
 */
async function defaultForm(name: string): Promise<string | null> {
  try {
    const raw = await get<RawSpecies>(`/pokemon-species/${name}`)
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
