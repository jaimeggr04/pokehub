import { Field, Move, Pokemon, calculate, toID } from '@smogon/calc'
import type { BattleFormat } from '@/lib/battle/formats'
import { genFor, moveInfo, speciesInfo } from '@/lib/battle/dex'
import { calcDamage, koLabel, type DamageResult, type FieldState, type MonSet, type SideConditions } from '@/lib/battle/calc'
import { effectiveness, formatMultiplier, isAttackType, type Effectiveness } from '@/lib/type-chart'

/*
 * Utilidades de la calculadora y las fichas de detalle: el cálculo con golpe
 * crítico (calcDamage no lo expone) y los textos en lenguaje llano que se leen
 * de un vistazo en mitad de un turno.
 */

/* ------------------------------------------------------------------ */
/* Cálculo con crítico                                                  */
/* ------------------------------------------------------------------ */

function side(c?: SideConditions) {
  return {
    isReflect: c?.reflect,
    isLightScreen: c?.lightScreen,
    isAuroraVeil: c?.auroraVeil,
    isTailwind: c?.tailwind,
    isHelpingHand: c?.helpingHand,
    isFriendGuard: c?.friendGuard,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Igual que `calcDamage`, pero con la opción de golpe crítico. Sin crítico
 * delega en `calcDamage` para que los números coincidan con el resto del
 * asistente; con crítico repite su montaje con `isCrit`.
 * TODO: si calcDamage acepta `{ crit }`, esto se reduce a una llamada.
 */
export function damageWith(
  format: BattleFormat,
  attacker: MonSet,
  defender: MonSet,
  moveName: string,
  field: FieldState = {},
  crit = false,
): DamageResult | null {
  if (!crit) return calcDamage(format, attacker, defender, moveName, field)
  const gen = genFor(format)
  if (!gen.moves.get(toID(moveName))) return null
  try {
    const make = (set: MonSet) => {
      const p = new Pokemon(gen, set.species, {
        level: format.level,
        nature: set.nature || 'Serious',
        evs: set.invest,
        ivs: format.statPoints ? undefined : { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        ability: set.ability || undefined,
        item: set.item || undefined,
        teraType: format.tera && set.tera && set.teraType ? (set.teraType as never) : undefined,
        boosts: set.boosts,
        status: (set.status || '') as never,
      })
      if (set.hpPercent !== undefined) p.originalCurHP = Math.max(1, Math.round((p.maxHP() * set.hpPercent) / 100))
      return p
    }
    const a = make(attacker)
    const d = make(defender)
    const move = new Move(gen, moveName, { isCrit: true })
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
    const minPercent = round1((min / maxHP) * 100)
    const maxPercent = round1((max / maxHP) * 100)
    let hits = 0
    let chance = 0
    if (max > 0) {
      const ko = result.kochance(false)
      hits = ko.n ?? 0
      chance = ko.chance ?? 0
    }
    const remaining = defender.hpPercent ?? 100
    let desc = ''
    try {
      desc = result.desc()
    } catch {
      // Movimientos de estado: no hay descripción.
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
      killsNow: minPercent >= remaining ? 'yes' : maxPercent >= remaining ? 'maybe' : 'no',
      desc,
    }
  } catch {
    return null
  }
}

/** Todos los ataques de `moves` contra el defensor, del que más hace al que menos (sin los de estado). */
export function allHits(
  format: BattleFormat,
  attacker: MonSet,
  defender: MonSet,
  moves: string[],
  field?: FieldState,
  crit = false,
): DamageResult[] {
  return moves
    .map((m) => damageWith(format, attacker, defender, m, field, crit))
    .filter((r): r is DamageResult => r !== null && r.category !== 'Status' && r.maxPercent > 0)
    .sort((a, b) => b.maxPercent - a.maxPercent)
}

/** Da la vuelta a un campo: lo que era del atacante pasa a ser del defensor. */
export function flipField(field?: FieldState): FieldState | undefined {
  if (!field) return undefined
  return { ...field, attackerSide: field.defenderSide, defenderSide: field.attackerSide }
}

/* ------------------------------------------------------------------ */
/* Textos en lenguaje llano                                             */
/* ------------------------------------------------------------------ */

const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** "45–53 %" sin pasar de 100: para el titular grande. */
export function bigRange(min: number, max: number) {
  if (min >= 100) return '100 %'
  if (max > 100) return `${num(min)}–100 %`
  if (num(min) === num(max)) return `${num(min)} %`
  return `${num(min)}–${num(max)} %`
}

/**
 * La etiqueta de KO contada como la diría una persona: "lo debilita en 2
 * golpes seguro". Los golpes ya cuentan la vida que le queda (y el daño de fin
 * de turno), así que con un golpe basta decir "ya".
 */
export function plainKo(r: Pick<DamageResult, 'hits' | 'chance' | 'maxPercent'>, remaining = 100): string {
  if (r.maxPercent <= 0) return 'no le hace daño'
  if (!r.hits) return 'no lo debilita en 4 golpes'
  if (r.hits > 4) return `harían falta ${r.hits} golpes o más`
  const hurt = remaining < 100
  const what = r.hits === 1 ? (hurt ? 'lo debilita ya' : 'lo debilita de un golpe') : `lo debilita en ${r.hits} golpes`
  const tail = hurt && r.hits === 1 ? ` (le queda ${num(remaining)} %)` : ''
  if (r.chance >= 0.999) return `${what} seguro${tail}`
  const odds = Math.max(1, Math.round(r.chance * 100))
  return `${what} el ${odds} % de las veces${tail}`
}

/** ¿La etiqueta técnica (2HKO…) aporta algo? A partir de 5 golpes, no. */
export function showsKoLabel(r: Pick<DamageResult, 'hits'>) {
  return r.hits >= 1 && r.hits <= 4
}

/** Tono del resultado: rojo si cae ya o de un golpe, ámbar en 2 golpes, neutro si no. */
export function koTone(r: Pick<DamageResult, 'hits' | 'chance'>): 'danger' | 'warning' | 'muted' {
  if (r.hits === 1 && r.chance >= 0.5) return 'danger'
  if (r.hits === 1 || r.hits === 2) return 'warning'
  return 'muted'
}

/** Tipos de una especie en minúsculas (como los usa la tabla de tipos de PokeHub). */
export function typesOf(format: BattleFormat, species: string): string[] {
  return (speciesInfo(genFor(format), species)?.types ?? []).map((t) => t.toLowerCase())
}

/** ¿El ataque tiene STAB (mismo tipo que quien lo usa)? */
export function hasStab(format: BattleFormat, species: string, moveType: string) {
  return typesOf(format, species).includes(moveType.toLowerCase())
}

/** Eficacia del tipo del ataque contra el defensor, con su texto corto. */
export function typeEffect(format: BattleFormat, moveType: string, defender: string): { value: Effectiveness; text: string } | null {
  const t = moveType.toLowerCase()
  if (!isAttackType(t)) return null
  const value = effectiveness(t, typesOf(format, defender))
  if (value === 1) return null
  const text =
    value === 0 ? 'No le afecta' : value > 1 ? `Súper eficaz ${formatMultiplier(value)}` : `Poco eficaz ${formatMultiplier(value)}`
  return { value, text }
}

/** Datos del ataque para pintarlo (tipo en minúsculas, categoría, potencia, prioridad). */
export function moveMeta(format: BattleFormat, name: string) {
  const m = moveInfo(genFor(format), name)
  if (!m) return null
  return { ...m, type: m.type.toLowerCase() }
}
