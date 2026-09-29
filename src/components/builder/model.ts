/* Modelo del creador de equipos: el estado de cada hueco y sus derivados. */

import {
  MAX_EVS_TOTAL, NATURES, STAT_LABELS, evSpread, evTotal, prettify, type StatKey,
} from '@/lib/pokemon'
import type { BuildInput } from '@/app/actions/teams'
import type { BuildRow, Gender } from '@/lib/database.types'
import type { RandomBuild } from '@/lib/random-team'

export const MAX_SLOTS = 6

export interface Slot {
  key: string
  pokemon_id: number
  pokemon_name: string
  nickname: string
  gender: Gender
  level: number
  shiny: boolean
  ability: string
  item: string
  nature: string
  tera_type: string
  moves: [string, string, string, string]
  ivs: Record<StatKey, number>
  evs: Record<StatKey, number>
}

export type SlotPatch = Partial<Omit<Slot, 'key'>>

// Las claves sólo sirven de `key` de React: nunca llegan al DOM, así que no
// importa que el contador del servidor y el del cliente no coincidan.
let keySeed = 0
export const nextKey = () => `slot-${++keySeed}`

export const FULL_IVS: Record<StatKey, number> = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
export const NO_EVS: Record<StatKey, number> = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
export const NO_MOVES: Slot['moves'] = ['', '', '', '']

export function emptySlot(): Slot {
  return {
    key: nextKey(),
    pokemon_id: 0,
    pokemon_name: '',
    nickname: '',
    gender: 'unknown',
    level: 50,
    shiny: false,
    ability: '',
    item: '',
    nature: 'hardy',
    tera_type: '',
    moves: [...NO_MOVES],
    ivs: { ...FULL_IVS },
    evs: { ...NO_EVS },
  }
}

export function slotFromBuild(b: BuildRow): Slot {
  return {
    key: nextKey(),
    pokemon_id: b.pokemon_id,
    pokemon_name: b.pokemon_name,
    nickname: b.nickname ?? '',
    gender: b.gender,
    level: b.level,
    shiny: b.shiny,
    ability: b.ability ?? '',
    item: b.item ?? '',
    nature: b.nature ?? 'hardy',
    tera_type: b.tera_type ?? '',
    moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''],
    ivs: { hp: b.hp_ivs, atk: b.atk_ivs, def: b.def_ivs, spa: b.spa_ivs, spd: b.spd_ivs, spe: b.spe_ivs },
    evs: { hp: b.hp_evs, atk: b.atk_evs, def: b.def_evs, spa: b.spa_evs, spd: b.spd_evs, spe: b.spe_evs },
  }
}

/** Un build de «Sorpréndeme» convertido en hueco. `key` permite reutilizar la de un hueco vacío. */
export function slotFromRandom(b: RandomBuild, key = nextKey()): Slot {
  return {
    ...emptySlot(),
    ...b,
    key,
    moves: [...b.moves],
    ivs: { ...b.ivs },
    evs: { ...b.evs },
  }
}

export function toInput(s: Slot, index: number): BuildInput {
  return {
    slot: index + 1,
    pokemon_id: s.pokemon_id,
    pokemon_name: s.pokemon_name,
    nickname: s.nickname.trim() || null,
    gender: s.gender,
    level: s.level,
    shiny: s.shiny,
    ability: s.ability || null,
    item: s.item || null,
    nature: s.nature || null,
    tera_type: s.tera_type || null,
    moves: s.moves.filter(Boolean),
    hp_ivs: s.ivs.hp, atk_ivs: s.ivs.atk, def_ivs: s.ivs.def,
    spa_ivs: s.ivs.spa, spd_ivs: s.ivs.spd, spe_ivs: s.ivs.spe,
    hp_evs: s.evs.hp, atk_evs: s.evs.atk, def_evs: s.evs.def,
    spa_evs: s.evs.spa, spd_evs: s.evs.spd, spe_evs: s.evs.spe,
  }
}

export const FORMATS = ['VGC Reg H', 'VGC Reg G', 'Doubles OU', 'Singles OU', 'Ubers', 'Little Cup', 'Casual']

/**
 * Traduce el código de formato de Showdown ("gen9vgc2024regh") a la etiqueta que
 * usa PokeHub ("VGC Reg H"). Si no encaja con ningún patrón conocido devuelve
 * null y se deja el formato que hubiera puesto el usuario.
 */
export function showdownFormatLabel(code: string | null): string | null {
  if (!code) return null
  const reg = code.match(/vgc\d*reg([a-z])/i)
  if (reg) return `VGC Reg ${reg[1].toUpperCase()}`
  if (/doubles ?ou/i.test(code) || /doublesou/i.test(code)) return 'Doubles OU'
  if (/ubers/i.test(code)) return 'Ubers'
  if (/\blc\b|littlecup/i.test(code)) return 'Little Cup'
  if (/ou$/i.test(code)) return 'Singles OU'
  return null
}

/** "adamant" -> "Adamant (+Atk, −SpA)": la naturaleza deja de ser un nombre suelto. */
export function natureLabel(name: string) {
  const mod = NATURES[name]
  if (!mod) return `${prettify(name)} (neutra)`
  return `${prettify(name)} (+${STAT_LABELS[mod[0]]}, −${STAT_LABELS[mod[1]]})`
}

export function clampNum(raw: string, min: number, max: number, fallback: number) {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * Colores de cada estadística (los de la Pokédex de Bulbapedia, algo más
 * saturados para que el relleno de los sliders se lea sobre fondo claro).
 */
export const STAT_TINTS: Record<StatKey, string> = {
  hp: '#ff5959',
  atk: '#f08a4b',
  def: '#e3bd35',
  spa: '#6f95ee',
  spd: '#6cc152',
  spe: '#f16b98',
}

export function slotName(slot: Slot, index: number) {
  if (slot.nickname.trim()) return slot.nickname.trim()
  if (slot.pokemon_id) return prettify(slot.pokemon_name)
  return `Hueco ${index + 1}`
}

/** Resumen de una línea para el hueco plegado: naturaleza · movimientos · EVs. */
export function slotSummary(slot: Slot) {
  if (!slot.pokemon_id) return 'Elige un Pokémon para empezar'
  const moves = slot.moves.filter(Boolean).map(prettify)
  const parts = [
    prettify(slot.nature),
    moves.length ? moves.join(', ') : 'sin movimientos',
    evSpread(slot.evs) || 'sin EVs',
  ]
  return parts.join(' · ')
}

/**
 * Cuánto le falta a un build para estar "listo": habilidad, objeto, teratipo,
 * cuatro movimientos y los EVs repartidos. Es la barra de "PS" del panel del
 * equipo: se lee de un vistazo qué hueco está a medias.
 */
export function buildProgress(slot: Slot): { done: number; total: number; missing: string[] } {
  if (!slot.pokemon_id) return { done: 0, total: 8, missing: ['Pokémon'] }
  const moves = slot.moves.filter(Boolean).length
  const evs = evTotal(slot.evs)
  // Con 508 no se puede repartir todo en múltiplos de 4: 504 ya cuenta como completo.
  const evsDone = evs >= MAX_EVS_TOTAL - 4 && evs <= MAX_EVS_TOTAL
  const checks: [boolean, string][] = [
    [Boolean(slot.ability), 'habilidad'],
    [Boolean(slot.item), 'objeto'],
    [Boolean(slot.tera_type), 'teratipo'],
    [evsDone, 'EVs'],
  ]
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  if (moves < 4) missing.push(moves === 3 ? '1 movimiento' : `${4 - moves} movimientos`)
  const done = checks.filter(([ok]) => ok).length + moves
  return { done, total: 8, missing }
}

export type SlotIssue = { tone: 'danger' | 'warning'; label: string }

export function slotIssues(slot: Slot, duplicate: boolean): SlotIssue[] {
  const issues: SlotIssue[] = []
  const over = evTotal(slot.evs) - MAX_EVS_TOTAL
  if (over > 0) issues.push({ tone: 'danger', label: `Sobran ${over} EVs` })
  if (duplicate) issues.push({ tone: 'warning', label: 'Repetido' })
  if (slot.pokemon_id && !slot.moves.some(Boolean)) issues.push({ tone: 'warning', label: 'Sin movimientos' })
  return issues
}

/** Estadísticas que la naturaleza sube y baja, para colorear sin repetir la búsqueda. */
export function natureShift(nature: string): { up: StatKey | null; down: StatKey | null } {
  const mod = NATURES[nature]
  return { up: mod?.[0] ?? null, down: mod?.[1] ?? null }
}

/** EVs que quedan por repartir; negativo si el hueco se pasa del máximo. */
export function evsLeft(slot: Pick<Slot, 'evs'>) {
  return MAX_EVS_TOTAL - evTotal(slot.evs)
}

/**
 * Huella de lo que se guardaría. Si cambia respecto a la inicial hay cambios
 * sin guardar. Los huecos vacíos no cuentan: tampoco se envían al guardar.
 */
export function teamSnapshot(team: {
  name: string
  format: string
  description: string
  isPublic: boolean
  slots: Slot[]
}) {
  return JSON.stringify([
    team.name.trim(),
    team.format.trim(),
    team.description.trim(),
    team.isPublic,
    team.slots.filter((s) => s.pokemon_id > 0).map(toInput),
  ])
}
