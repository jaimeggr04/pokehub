/*
 * Generador de equipos aleatorios ("Sorpréndeme"). Usa Math.random, así que
 * sólo debe llamarse desde manejadores de eventos del cliente, nunca al pintar.
 */

import { getMoves, getPokemon, type MoveDetail, type PokemonDetail } from '@/lib/pokeapi'
import { MAX_EV, POKEMON_TYPES, type StatKey } from '@/lib/pokemon'

/** Objetos que de verdad se ven en competitivo: con el catálogo entero saldrían fósiles y Poké Balls. */
export const COMPETITIVE_ITEMS = [
  'leftovers', 'choice-scarf', 'choice-band', 'choice-specs', 'life-orb', 'focus-sash',
  'assault-vest', 'sitrus-berry', 'rocky-helmet', 'heavy-duty-boots', 'booster-energy',
  'clear-amulet', 'covert-cloak', 'expert-belt', 'weakness-policy', 'light-clay',
] as const

/** Último Pokémon de la Pokédex nacional; por encima vienen formas alternativas. */
export const MAX_DEX_ID = 1025

export interface RandomBuild {
  pokemon_id: number
  pokemon_name: string
  ability: string
  item: string
  nature: string
  tera_type: string
  moves: [string, string, string, string]
  level: number
  shiny: boolean
  ivs: Record<StatKey, number>
  evs: Record<StatKey, number>
}

// Por debajo de esto suelen ser primeras fases: un equipo sorpresa de Caterpies
// hace gracia una vez, pero no sirve de punto de partida.
const MIN_BASE_TOTAL = 420
const ATTEMPTS_PER_SLOT = 3
// Muestra del learnset que se consulta para saber qué ataques hacen daño: pedir
// los ~100 movimientos de cada especie serían cientos de peticiones.
const MOVE_SAMPLE = 8
const SHINY_ODDS = 1 / 64

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** `count` números de Pokédex distintos, sin los excluidos. */
export function randomDexIds(
  count: number,
  exclude: ReadonlySet<number> = new Set(),
  dex: readonly { id: number }[] = [],
): number[] {
  const fromDex = dex.filter((d) => d.id >= 1 && d.id <= MAX_DEX_ID && !exclude.has(d.id)).map((d) => d.id)
  const pool = fromDex.length
    ? fromDex
    : Array.from({ length: MAX_DEX_ID }, (_, i) => i + 1).filter((id) => !exclude.has(id))
  return shuffle(pool).slice(0, count)
}

function baseTotal(p: PokemonDetail) {
  const s = p.baseStats
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe
}

type Attacking = 'atk' | 'spa'

/**
 * Reparto clásico 252/252/4 sobre lo que la especie hace mejor: si es rápida,
 * ataque y velocidad; si es lenta, PS y ataque (correr no le va a servir).
 */
function spreadFor(p: PokemonDetail) {
  const s = p.baseStats
  const attacking: Attacking = s.atk >= s.spa ? 'atk' : 'spa'
  const fast = s.spe >= 70
  const evs: Record<StatKey, number> = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const ivs: Record<StatKey, number> = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }

  let nature: string
  if (fast) {
    evs[attacking] = MAX_EV
    evs.spe = MAX_EV
    evs.hp = 4
    nature = attacking === 'atk' ? pick(['jolly', 'adamant']) : pick(['timid', 'modest'])
  } else {
    evs.hp = MAX_EV
    evs[attacking] = MAX_EV
    evs[s.def >= s.spd ? 'def' : 'spd'] = 4
    // Los muy lentos van mejor en Espacio Raro: naturaleza que baja la velocidad.
    const trickRoom = s.spe <= 45
    nature = attacking === 'atk'
      ? (trickRoom ? pick(['brave', 'adamant']) : 'adamant')
      : (trickRoom ? pick(['quiet', 'modest']) : 'modest')
  }

  // Detalles de competitivo: el atacante especial no quiere Ataque (menos daño
  // de Juego Sucio y de la confusión) y el de Espacio Raro no quiere Velocidad.
  if (attacking === 'spa') ivs.atk = 0
  if (nature === 'brave' || nature === 'quiet') ivs.spe = 0

  return { evs, ivs, nature, attacking }
}

async function pickMoves(p: PokemonDetail, attacking: Attacking, attackingOnly: boolean): Promise<string[]> {
  const learnset = p.moves
  if (learnset.length <= 4) return [...learnset]

  const sample = shuffle(learnset).slice(0, MOVE_SAMPLE)
  // getMoves nunca rechaza: los que fallan vuelven como "status" sin potencia.
  const details: MoveDetail[] = await getMoves(sample)
  const category = attacking === 'atk' ? 'physical' : 'special'

  const damaging = details
    .filter((m) => m.damageClass !== 'status' && (m.power ?? 0) >= 50)
    .map((m) => ({
      name: m.name,
      type: m.type,
      // Prioriza STAB y la categoría buena, con algo de azar para no repetir siempre lo mismo.
      score:
        (m.power ?? 0) *
        (p.types.includes(m.type) ? 1.5 : 1) *
        (m.damageClass === category ? 1.3 : 0.7) *
        (0.75 + Math.random() * 0.5),
    }))
    .sort((a, b) => b.score - a.score)

  const chosen: string[] = []
  const coveredTypes = new Set<string>()
  const attacks = attackingOnly ? 4 : 3
  // Primero, tipos distintos (cobertura); si no llegan, lo que haya.
  for (const m of damaging) {
    if (chosen.length >= attacks) break
    if (coveredTypes.has(m.type)) continue
    chosen.push(m.name)
    coveredTypes.add(m.type)
  }
  for (const m of damaging) {
    if (chosen.length >= attacks) break
    if (!chosen.includes(m.name)) chosen.push(m.name)
  }

  // Protección es el cuarto movimiento de medio metagame (y con objetos de
  // elección o Chaleco Asalto no se puede usar, así que ahí no se ofrece).
  if (!attackingOnly && learnset.includes('protect') && !chosen.includes('protect') && Math.random() < 0.6) {
    chosen.push('protect')
  }

  const rest = attackingOnly
    ? details.filter((m) => m.damageClass !== 'status').map((m) => m.name)
    : sample
  for (const name of [...rest, ...sample]) {
    if (chosen.length >= 4) break
    if (!chosen.includes(name)) chosen.push(name)
  }
  return chosen.slice(0, 4)
}

/**
 * Un build completo a partir de varios candidatos: se queda con el primero que
 * tenga estadísticas de Pokémon hecho y derecho (o con el último que cargue).
 */
export async function randomBuild(candidates: number[]): Promise<RandomBuild | null> {
  let species: PokemonDetail | null = null
  let fallback: PokemonDetail | null = null
  for (const id of candidates) {
    try {
      const p = await getPokemon(id)
      if (baseTotal(p) >= MIN_BASE_TOTAL) {
        species = p
        break
      }
      fallback ??= p
    } catch {
      // Sin red o 404: se prueba el siguiente candidato.
    }
  }
  const p = species ?? fallback
  if (!p) return null

  const item = pick(COMPETITIVE_ITEMS)
  const attackingOnly = item.startsWith('choice-') || item === 'assault-vest'
  const { evs, ivs, nature, attacking } = spreadFor(p)
  const moves = await pickMoves(p, attacking, attackingOnly)

  return {
    pokemon_id: p.id,
    pokemon_name: p.name,
    ability: p.abilities.length ? pick(p.abilities) : '',
    item,
    nature,
    // Mitad de las veces un teratipo propio (refuerza el STAB), mitad uno cualquiera.
    tera_type: Math.random() < 0.5 && p.types.length ? pick(p.types) : pick(POKEMON_TYPES),
    moves: [moves[0] ?? '', moves[1] ?? '', moves[2] ?? '', moves[3] ?? ''],
    level: 50,
    shiny: Math.random() < SHINY_ODDS,
    ivs,
    evs,
  }
}

/**
 * `count` builds aleatorios sin especies repetidas entre sí ni con `exclude`.
 * Los candidatos se reparten antes de lanzar las peticiones en paralelo, así
 * dos huecos nunca pueden acabar con el mismo Pokémon.
 */
export async function randomTeam(
  count: number,
  exclude: ReadonlySet<number>,
  dex: readonly { id: number }[] = [],
): Promise<(RandomBuild | null)[]> {
  const ids = randomDexIds(count * ATTEMPTS_PER_SLOT, exclude, dex)
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      randomBuild(ids.slice(i * ATTEMPTS_PER_SLOT, (i + 1) * ATTEMPTS_PER_SLOT)),
    ),
  )
}
