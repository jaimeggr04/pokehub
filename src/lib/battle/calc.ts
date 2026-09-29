import { Field, Move, Pokemon, calculate, toID } from '@smogon/calc'
import type { BattleFormat } from '@/lib/battle/formats'
import { genFor, showdownSpeciesName, type Gen, type StatTable } from '@/lib/battle/dex'
import { parseSpread, type UsageEntry } from '@/lib/battle/usage'
import type { BuildRow } from '@/lib/database.types'

/*
 * Capa fina sobre @smogon/calc (la calculadora de daño de Showdown y
 * Smogon): recibe sets sencillos y devuelve el resultado ya explicado en
 * español, listo para enseñarlo.
 */

export type StatusId = 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz' | ''

export type MonSet = {
  species: string
  nature?: string
  /** EVs (0-252) o, en Champions, puntos de estadística (0-32). */
  invest?: Partial<StatTable>
  ability?: string
  item?: string
  teraType?: string
  moves: string[]
  boosts?: Partial<Omit<StatTable, 'hp'>>
  status?: StatusId
  /** Vida actual en %, 0-100 (para "¿lo debilita ya?"). */
  hpPercent?: number
  tera?: boolean
}

export type SideConditions = {
  reflect?: boolean
  lightScreen?: boolean
  auroraVeil?: boolean
  tailwind?: boolean
  helpingHand?: boolean
  friendGuard?: boolean
}

export type FieldState = {
  weather?: 'Sun' | 'Rain' | 'Sand' | 'Snow' | 'Harsh Sunshine' | 'Heavy Rain' | 'Strong Winds' | ''
  terrain?: 'Electric' | 'Grassy' | 'Psychic' | 'Misty' | ''
  /** Condiciones del lado del atacante y del defensor. */
  attackerSide?: SideConditions
  defenderSide?: SideConditions
}

export type DamageResult = {
  move: string
  moveType: string
  category: 'Physical' | 'Special' | 'Status'
  /** % de la vida máxima del defensor. */
  minPercent: number
  maxPercent: number
  /** Golpes para debilitar (0 = no lo hace en 4 o es de estado). */
  hits: number
  /** Probabilidad de hacerlo en esos golpes, 0-1. */
  chance: number
  /** "KO seguro", "2HKO probable (56 %)", "No le hace daño"… */
  label: string
  /** Tener en cuenta la vida que le queda: ¿lo debilita ya este golpe? */
  killsNow: 'yes' | 'maybe' | 'no'
  /** Descripción completa de la calculadora (en inglés, como la de Showdown). */
  desc: string
}

function makePokemon(gen: Gen, format: BattleFormat, set: MonSet) {
  const ivs = format.statPoints ? undefined : { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
  const pokemon = new Pokemon(gen, set.species, {
    level: format.level,
    nature: set.nature || 'Serious',
    evs: set.invest,
    ivs,
    ability: set.ability || undefined,
    item: set.item || undefined,
    teraType: format.tera && set.tera && set.teraType ? (set.teraType as never) : undefined,
    boosts: set.boosts,
    status: (set.status || '') as never,
  })
  if (set.hpPercent !== undefined) {
    pokemon.originalCurHP = Math.max(1, Math.round((pokemon.maxHP() * set.hpPercent) / 100))
  }
  return pokemon
}

function side(conditions?: SideConditions) {
  return {
    isReflect: conditions?.reflect,
    isLightScreen: conditions?.lightScreen,
    isAuroraVeil: conditions?.auroraVeil,
    isTailwind: conditions?.tailwind,
    isHelpingHand: conditions?.helpingHand,
    isFriendGuard: conditions?.friendGuard,
  }
}

const pct = (n: number) => Math.round(n * 10) / 10

export function koLabel(hits: number, chance: number, maxPercent: number): string {
  if (maxPercent <= 0) return 'No le hace daño'
  if (!hits) return 'No lo debilita en 4 golpes'
  const name = hits === 1 ? 'KO directo' : `${hits}HKO`
  if (chance >= 0.999) return `${name} seguro`
  const odds = Math.max(1, Math.round(chance * 100))
  return `${name} ${odds >= 50 ? 'probable' : 'posible'} (${odds} %)`
}

export function calcDamage(
  format: BattleFormat,
  attacker: MonSet,
  defender: MonSet,
  moveName: string,
  field: FieldState = {},
  opts: { crit?: boolean } = {},
): DamageResult | null {
  const gen = genFor(format)
  if (!gen.moves.get(toID(moveName))) return null
  try {
    const a = makePokemon(gen, format, attacker)
    const d = makePokemon(gen, format, defender)
    const move = new Move(gen, moveName, { isCrit: Boolean(opts.crit) })
    const result = calculate(
      gen,
      a,
      d,
      move,
      new Field({
        gameType: format.gameType === 'doubles' ? 'Doubles' : 'Singles',
        weather: (field.weather || undefined) as never,
        terrain: (field.terrain || undefined) as never,
        attackerSide: side(field.attackerSide),
        defenderSide: side(field.defenderSide),
      }),
    )
    const [min, max] = result.range()
    const maxHP = d.maxHP()
    const minPercent = pct((min / maxHP) * 100)
    const maxPercent = pct((max / maxHP) * 100)
    let hits = 0
    let chance = 0
    if (max > 0) {
      const ko = result.kochance(false)
      hits = ko.n ?? 0
      chance = ko.chance ?? 0
    }
    const remaining = defender.hpPercent ?? 100
    const killsNow = minPercent >= remaining ? 'yes' : maxPercent >= remaining ? 'maybe' : 'no'
    let desc = ''
    try {
      desc = result.desc()
    } catch {
      // Movimientos de estado: la calculadora no tiene nada que describir.
    }
    return {
      move: move.name,
      moveType: move.type,
      category: move.category,
      minPercent,
      maxPercent,
      hits,
      chance,
      label: koLabel(hits, chance, maxPercent),
      killsNow,
      desc,
    }
  } catch {
    return null
  }
}

/** Todos los ataques de un set contra un rival, del que más daño hace al que menos. */
export function calcAllMoves(format: BattleFormat, attacker: MonSet, defender: MonSet, field?: FieldState) {
  return attacker.moves
    .map((m) => calcDamage(format, attacker, defender, m, field))
    .filter((r): r is DamageResult => r !== null && r.category !== 'Status' && r.maxPercent > 0)
    .sort((a, b) => b.maxPercent - a.maxPercent)
}

/** Velocidad real del set en combate (sin contar Viento Afín ni parálisis: eso va aparte). */
export function speedOf(format: BattleFormat, set: MonSet): number {
  const gen = genFor(format)
  try {
    return makePokemon(gen, format, { ...set, boosts: undefined }).stats.spe
  } catch {
    return 0
  }
}

/* ------------------------------------------------------------------ */
/* De los datos de PokeHub y de Smogon a sets de la calculadora        */
/* ------------------------------------------------------------------ */

function nameOf(gen: Gen, kind: 'moves' | 'items' | 'abilities', slug: string | null | undefined): string | undefined {
  if (!slug) return undefined
  const found = gen[kind].get(toID(slug))
  return found ? String(found.name) : undefined
}

/**
 * Un Pokémon de un equipo de PokeHub como set de la calculadora. Los equipos
 * guardan EVs clásicos; en Champions se pasan a puntos (252 EVs ≈ 32 puntos).
 */
export function setFromBuild(format: BattleFormat, build: BuildRow): MonSet | null {
  const gen = genFor(format)
  const species = showdownSpeciesName(gen, build.pokemon_name)
  if (!species) return null
  const evs = {
    hp: build.hp_evs, atk: build.atk_evs, def: build.def_evs,
    spa: build.spa_evs, spd: build.spd_evs, spe: build.spe_evs,
  }
  const invest = format.statPoints
    ? (Object.fromEntries(Object.entries(evs).map(([k, v]) => [k, Math.min(32, Math.round(v / 8))])) as StatTable)
    : evs
  return {
    species,
    nature: build.nature ? build.nature.charAt(0).toUpperCase() + build.nature.slice(1) : undefined,
    invest,
    ability: nameOf(gen, 'abilities', build.ability),
    item: nameOf(gen, 'items', build.item),
    teraType: build.tera_type ? build.tera_type.charAt(0).toUpperCase() + build.tera_type.slice(1) : undefined,
    moves: build.moves.map((m) => nameOf(gen, 'moves', m)).filter((m): m is string => Boolean(m)),
  }
}

/**
 * El set más probable según las estadísticas de uso, respetando lo que ya se
 * ha visto en la partida (movimientos, objeto, habilidad revelados).
 */
export function likelySet(
  species: string,
  usage: UsageEntry | undefined,
  known: { moves?: string[]; item?: string; ability?: string } = {},
): MonSet {
  const spread = usage?.spreads[0] ? parseSpread(usage.spreads[0][0]) : null
  const seen = known.moves ?? []
  const guessed = (usage?.moves ?? []).map(([m]) => m).filter((m) => !seen.includes(m))
  return {
    species,
    nature: spread?.nature,
    invest: spread?.invest,
    ability: known.ability ?? usage?.abilities[0]?.[0],
    item: known.item ?? usage?.items[0]?.[0],
    moves: [...seen, ...guessed].slice(0, 4),
  }
}
