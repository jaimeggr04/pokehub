import { Generations, toID, type GenerationNum } from '@smogon/calc'
import type { BattleFormat } from '@/lib/battle/formats'

/*
 * Datos de especies, movimientos, objetos y habilidades para el asistente.
 * Salen de @smogon/calc, que ya trae los de Pokémon Champions (incluidas sus
 * megaevoluciones nuevas): así los datos y la calculadora nunca discrepan.
 * Los nombres son los de Showdown, en inglés, que es como los ve el jugador
 * en la partida.
 */

export { toID }

export type Gen = ReturnType<typeof Generations.get>

export function genFor(format: Pick<BattleFormat, 'calcGen'>): Gen {
  return Generations.get(format.calcGen as GenerationNum)
}

export type StatTable = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }

export type SpeciesInfo = {
  id: string
  name: string
  types: string[]
  baseStats: StatTable
  abilities: string[]
  baseSpecies: string
  weightkg: number
}

export function speciesInfo(gen: Gen, name: string): SpeciesInfo | null {
  const s = gen.species.get(toID(name))
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    types: [...s.types],
    baseStats: { ...s.baseStats } as StatTable,
    abilities: Object.values(s.abilities ?? {}).filter(Boolean) as string[],
    baseSpecies: s.baseSpecies ?? s.name,
    weightkg: s.weightkg,
  }
}

export function moveInfo(gen: Gen, name: string) {
  const m = gen.moves.get(toID(name))
  if (!m) return null
  return {
    id: m.id,
    name: m.name,
    type: m.type as string,
    category: m.category as 'Physical' | 'Special' | 'Status',
    basePower: m.basePower ?? 0,
    priority: m.priority ?? 0,
    target: m.target as string | undefined,
  }
}

export function itemName(gen: Gen, id: string): string {
  return gen.items.get(toID(id))?.name ?? id
}

export function abilityName(gen: Gen, id: string): string {
  return gen.abilities.get(toID(id))?.name ?? id
}

export function moveName(gen: Gen, id: string): string {
  return gen.moves.get(toID(id))?.name ?? id
}

/**
 * Nombre de Showdown para un slug de la PokéAPI de PokeHub ("lycanroc-dusk"
 * -> "Lycanroc-Dusk"). Como los ids de Showdown son el nombre sin guiones,
 * casi siempre basta con compararlos. Algunas formas se llaman distinto.
 */
const POKEAPI_ALIASES: Record<string, string> = {
  'ogerpon-wellspring-mask': 'Ogerpon-Wellspring',
  'ogerpon-hearthflame-mask': 'Ogerpon-Hearthflame',
  'ogerpon-cornerstone-mask': 'Ogerpon-Cornerstone',
  'urshifu-single-strike': 'Urshifu',
  'urshifu-rapid-strike': 'Urshifu-Rapid-Strike',
  'indeedee-male': 'Indeedee',
  'indeedee-female': 'Indeedee-F',
  'basculegion-male': 'Basculegion',
  'basculegion-female': 'Basculegion-F',
  'meowstic-male': 'Meowstic',
  'meowstic-female': 'Meowstic-F',
  'aegislash-shield': 'Aegislash',
  'tornadus-incarnate': 'Tornadus',
  'thundurus-incarnate': 'Thundurus',
  'landorus-incarnate': 'Landorus',
  'enamorus-incarnate': 'Enamorus',
  'giratina-altered': 'Giratina',
  'zygarde-50': 'Zygarde',
  'lycanroc-midday': 'Lycanroc',
  'toxtricity-amped': 'Toxtricity',
  'palafin-zero': 'Palafin',
  'mimikyu-disguised': 'Mimikyu',
  'maushold-family-of-four': 'Maushold',
  'tatsugiri-curly': 'Tatsugiri',
  'eiscue-ice': 'Eiscue',
  'morpeko-full-belly': 'Morpeko',
  'oricorio-baile': 'Oricorio',
  'minior-red-meteor': 'Minior',
  'wishiwashi-solo': 'Wishiwashi',
}

export function showdownSpeciesName(gen: Gen, pokeapiSlug: string): string | null {
  const alias = POKEAPI_ALIASES[pokeapiSlug]
  if (alias) return gen.species.get(toID(alias))?.name ?? alias
  return gen.species.get(toID(pokeapiSlug))?.name ?? null
}

/**
 * Sprites de Showdown por orden de preferencia. Las megaevoluciones nuevas de
 * Champions no están en todas las carpetas, así que la imagen prueba la
 * siguiente si falla (ver <ShowdownSprite>).
 */
export function spriteCandidates(name: string): string[] {
  const id = spriteId(name)
  return [
    `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/dex/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/afd/${id}.png`,
  ]
}

/** "Charizard-Mega-Y" -> "charizard-megay": especie base, guion y forma sin separadores. */
export function spriteId(name: string): string {
  const [base, ...forme] = name.split('-')
  const baseId = toID(base)
  return forme.length ? `${baseId}-${toID(forme.join(''))}` : baseId
}

/** Estadística real a nivel del formato, con naturaleza neutra y la inversión dada. */
export function statAt(
  base: number,
  stat: keyof StatTable,
  format: Pick<BattleFormat, 'statPoints' | 'level'>,
  invest: number,
  natureMod = 1,
): number {
  if (format.statPoints) {
    // Champions: HP = base + SP + 75; resto = (base + SP + 20) × naturaleza.
    if (stat === 'hp') return base === 1 ? 1 : base + invest + 75
    return Math.floor((base + invest + 20) * natureMod)
  }
  const level = format.level
  const common = Math.floor(((2 * base + 31 + Math.floor(invest / 4)) * level) / 100)
  if (stat === 'hp') return base === 1 ? 1 : common + level + 10
  return Math.floor((common + 5) * natureMod)
}

/** Máxima inversión posible en una estadística según el formato. */
export function maxInvest(format: Pick<BattleFormat, 'statPoints'>): number {
  return format.statPoints ? 32 : 252
}
