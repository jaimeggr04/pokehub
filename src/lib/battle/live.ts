import { toID } from '@smogon/calc'
import type { StatusId } from '@/lib/battle/calc'

/*
 * Lector del protocolo de combate de Pokémon Showdown. Recibe las líneas que
 * manda el servidor a un espectador ("|switch|p1a: Nick|Species, L50|100/100")
 * y mantiene un estado de la partida pensado para el asistente: qué ha sacado
 * cada uno y todo lo que se ha revelado de cada Pokémon.
 *
 * No depende de React ni del navegador: se puede probar con un log guardado.
 * Formato del protocolo: https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md
 */

export type SideId = 'p1' | 'p2'
export type BoostStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion'

export type MonState = {
  /** Especie tal como salió en la vista previa ("Urshifu-*" si oculta la forma). */
  previewSpecies: string
  /** Especie actual (cambia al megaevolucionar o al revelar la forma). */
  species: string
  nickname: string | null
  level: number
  gender: 'M' | 'F' | ''
  /** Vida en %, null si aún no se ha visto. */
  hp: number | null
  fainted: boolean
  status: StatusId
  /** Movimientos vistos, en el orden en que los usó. */
  moves: string[]
  /** Objeto: string conocido, null = sin objeto conocido o ya gastado, undefined = desconocido. */
  item: string | null | undefined
  /** Objeto que tenía y ya no (baya comida, Banda Focus usada…). */
  lostItem: string | null
  ability: string | null
  mega: boolean
  tera: string | null
  boosts: Partial<Record<BoostStat, number>>
  /** Ha salido al campo al menos una vez (en VGC se eligen 4 de 6). */
  brought: boolean
}

export type SideConditionId = 'tailwind' | 'reflect' | 'lightscreen' | 'auroraveil' | 'safeguard' | 'mist'

export type SideState = {
  id: SideId
  name: string
  rating: number | null
  team: MonState[]
  /** Índice en `team` de cada hueco activo (a, b); null si vacío. */
  active: (number | null)[]
  /** Condición -> turno en que empezó. */
  conditions: Partial<Record<SideConditionId, number>>
}

export type FieldConditions = {
  weather: string | null
  terrain: string | null
  /** Turno en que empezó Espacio Raro, o null. */
  trickRoom: number | null
}

export type LogEntry = { turn: number; text: string; side?: SideId }

/** Quién se movió antes que quién en un mismo turno, para deducir velocidades. */
export type SpeedEvidence = {
  turn: number
  first: { side: SideId; index: number; move: string }
  second: { side: SideId; index: number; move: string }
  trickRoom: boolean
}

export type BattlePhase = 'connecting' | 'preview' | 'battle' | 'ended'

export type BattleState = {
  roomId: string
  title: string
  formatName: string
  gameType: 'doubles' | 'singles'
  phase: BattlePhase
  turn: number
  sides: Record<SideId, SideState>
  field: FieldConditions
  winner: string | null
  log: LogEntry[]
  speed: SpeedEvidence[]
}

const LOG_LIMIT = 60

function emptySide(id: SideId): SideState {
  return { id, name: '', rating: null, team: [], active: [null, null], conditions: {} }
}

export function createBattleState(roomId: string): BattleState {
  return {
    roomId,
    title: '',
    formatName: '',
    gameType: 'doubles',
    phase: 'connecting',
    turn: 0,
    sides: { p1: emptySide('p1'), p2: emptySide('p2') },
    field: { weather: null, terrain: null, trickRoom: null },
    winner: null,
    log: [],
    speed: [],
  }
}

/* ------------------------------ Utilidades ------------------------------ */

/** "Charizard-Mega-Y, L50, M, shiny" -> datos. */
function parseDetails(details: string) {
  const [species, ...rest] = details.split(',').map((s) => s.trim())
  let level = 100
  let gender: MonState['gender'] = ''
  for (const part of rest) {
    if (/^L\d+$/.test(part)) level = Number(part.slice(1))
    else if (part === 'M' || part === 'F') gender = part
  }
  return { species, level, gender }
}

/** "p1a: Nick" -> { side: 'p1', slot: 0, name: 'Nick' } */
function parseIdent(ident: string | undefined) {
  const m = ident?.match(/^(p[12])([a-c])?:\s*(.*)$/)
  if (!m) return null
  return { side: m[1] as SideId, slot: m[2] ? m[2].charCodeAt(0) - 97 : null, name: m[3] }
}

/** "45/100", "0 fnt", "100/100 brn" -> { hp, fainted, status } */
function parseCondition(condition: string | undefined) {
  if (!condition) return null
  const [hpPart, statusPart] = condition.split(' ')
  if (hpPart === '0' || statusPart === 'fnt') return { hp: 0, fainted: true, status: '' as StatusId }
  const [cur, max] = hpPart.split('/').map(Number)
  const hp = max ? Math.round((cur / max) * 1000) / 10 : cur
  return { hp, fainted: false, status: (statusPart ?? '') as StatusId }
}

function baseName(species: string) {
  return species.replace(/-\*$/, '').split('-')[0]
}

/** ¿Encaja la especie vista en el campo con la de la vista previa? ("Urshifu-*" vale para cualquier Urshifu). */
function sameMon(preview: string, species: string) {
  if (toID(preview) === toID(species)) return true
  if (preview.endsWith('-*')) return baseName(preview) === baseName(species)
  // Mega o cambio de forma: comparten especie base.
  return baseName(preview) === baseName(species)
}

/** "[from] item: Life Orb" -> { kind: 'item', name: 'Life Orb' } */
function parseFrom(parts: string[]) {
  const from = parts.find((p) => p.startsWith('[from]'))
  const of = parts.find((p) => p.startsWith('[of]'))
  if (!from) return null
  const m = from.slice(6).trim().match(/^(item|ability|move):\s*(.+)$/)
  return { kind: m?.[1] ?? 'other', name: m?.[2] ?? from.slice(6).trim(), of: of ? of.slice(4).trim() : null }
}

const WEATHER_NAMES: Record<string, string> = {
  SunnyDay: 'Sun', DesolateLand: 'Harsh Sunshine', RainDance: 'Rain', PrimordialSea: 'Heavy Rain',
  Sandstorm: 'Sand', Snowscape: 'Snow', Hail: 'Snow', DeltaStream: 'Strong Winds',
}

const SIDE_CONDITIONS: Record<string, SideConditionId> = {
  tailwind: 'tailwind', reflect: 'reflect', lightscreen: 'lightscreen', auroraveil: 'auroraveil',
  safeguard: 'safeguard', mist: 'mist',
}

/* -------------------------------- Tracker -------------------------------- */

/**
 * Aplica líneas del protocolo sobre un estado. Muta el estado que recibe: el
 * hook de React trabaja sobre una copia y la publica al terminar cada bloque.
 */
export class BattleTracker {
  state: BattleState
  /** Movimientos del turno en curso, para las pruebas de velocidad. */
  private turnMoves: { side: SideId; index: number; move: string }[] = []

  constructor(roomId: string) {
    this.state = createBattleState(roomId)
  }

  reset() {
    this.state = createBattleState(this.state.roomId)
    this.turnMoves = []
  }

  private log(text: string, side?: SideId) {
    this.state.log.push({ turn: this.state.turn, text, side })
    if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, this.state.log.length - LOG_LIMIT)
  }

  /** Busca (o da de alta) el Pokémon al que se refiere un ident como "p2a: Nick". */
  private mon(ident: string | undefined, details?: string): { side: SideState; index: number; mon: MonState } | null {
    const who = parseIdent(ident)
    if (!who) return null
    const side = this.state.sides[who.side]
    let index = -1

    // 1) Por el hueco activo, si el ident trae posición y el mote coincide.
    if (who.slot !== null) {
      const at = side.active[who.slot]
      if (at !== null && at !== undefined && side.team[at]?.nickname === who.name) index = at
    }
    // 2) Por el mote ya conocido.
    if (index < 0) index = side.team.findIndex((m) => m.nickname === who.name)
    // 3) Por la especie de la vista previa (primera vez que sale).
    if (index < 0 && details) {
      const { species } = parseDetails(details)
      index = side.team.findIndex((m) => m.nickname === null && sameMon(m.previewSpecies, species))
    }
    // 4) Sin vista previa (formatos que no la tienen): se da de alta.
    if (index < 0 && details) {
      const { species, level, gender } = parseDetails(details)
      side.team.push(newMon(species, level, gender))
      index = side.team.length - 1
    }
    if (index < 0) return null
    return { side, index, mon: side.team[index] }
  }

  private revealFrom(parts: string[], target: string | undefined) {
    const from = parseFrom(parts)
    if (!from) return
    const owner = this.mon(from.of ?? target)?.mon
    if (!owner) return
    if (from.kind === 'item') owner.item = from.name
    else if (from.kind === 'ability') owner.ability = from.name
  }

  /** Una línea del protocolo ("|move|p1a: X|Protect|p1a: X"). */
  line(raw: string) {
    if (!raw.startsWith('|')) return
    const parts = raw.slice(1).split('|')
    const [cmd, a, b, c, d] = parts
    const s = this.state

    switch (cmd) {
      case 'init':
        if (a === 'battle') s.phase = s.phase === 'connecting' ? 'preview' : s.phase
        break
      case 'title':
        s.title = a ?? ''
        break
      case 'tier':
        s.formatName = a ?? ''
        break
      case 'gametype':
        s.gameType = a === 'singles' ? 'singles' : 'doubles'
        break
      case 'player': {
        const side = s.sides[a as SideId]
        if (side && b) {
          side.name = b
          side.rating = d ? Number(d) || null : null
        }
        break
      }
      case 'clearpoke':
        s.sides.p1.team = []
        s.sides.p2.team = []
        break
      case 'poke': {
        const side = s.sides[a as SideId]
        if (side && b) {
          const { species, level, gender } = parseDetails(b)
          side.team.push(newMon(species, level, gender))
        }
        break
      }
      case 'teampreview':
        s.phase = 'preview'
        break
      case 'start':
        s.phase = 'battle'
        this.log('¡Empieza el combate!')
        break
      case 'turn':
        s.turn = Number(a) || s.turn + 1
        s.phase = 'battle'
        this.turnMoves = []
        break
      case 'switch':
      case 'drag':
      case 'replace': {
        const who = parseIdent(a)
        const found = this.mon(a, b)
        if (!who || !found) break
        const { side, index, mon } = found
        const { species, level, gender } = parseDetails(b ?? '')
        mon.nickname = who.name
        mon.species = species
        mon.level = level
        if (gender) mon.gender = gender
        mon.brought = true
        mon.boosts = {}
        if (species.includes('-Mega')) mon.mega = true
        const cond = parseCondition(c)
        if (cond) Object.assign(mon, cond)
        if (who.slot !== null) {
          // El que estaba en ese hueco se retira: pierde los cambios de estadísticas.
          const previous = side.active[who.slot]
          if (previous !== null && previous !== undefined && previous !== index) side.team[previous].boosts = {}
          side.active[who.slot] = index
        }
        if (cmd !== 'replace') this.log(`${side.name || who.side} saca a ${species}`, who.side)
        break
      }
      case 'detailschange':
      case '-formechange': {
        const found = this.mon(a)
        if (!found || !b) break
        const { species } = parseDetails(b)
        found.mon.species = species
        if (species.includes('-Mega')) found.mon.mega = true
        break
      }
      case '-mega': {
        const found = this.mon(a)
        if (!found) break
        found.mon.mega = true
        if (c) found.mon.item = c
        this.log(`¡${b ?? found.mon.species} megaevoluciona!`, found.side.id)
        break
      }
      case '-terastallize': {
        const found = this.mon(a)
        if (!found) break
        found.mon.tera = b ?? null
        this.log(`${found.mon.species} se teracristaliza (${b})`, found.side.id)
        break
      }
      case 'move': {
        const found = this.mon(a)
        if (!found || !b) break
        const extra = parts.slice(3)
        // Movimientos que no salen de su moveset (Bailarina, Contraataque de Espejo Mágico…).
        const borrowed = extra.some((p) => p.startsWith('[from]') && !p.includes('lockedmove'))
        if (!borrowed && !found.mon.moves.includes(b)) found.mon.moves.push(b)
        if (!borrowed && !extra.includes('[still]')) {
          this.turnMoves.push({ side: found.side.id, index: found.index, move: b })
          this.recordSpeed()
        }
        const target = this.mon(c)?.mon.species
        this.log(`${found.mon.species} usa ${b}${target && c !== a ? ` → ${target}` : ''}`, found.side.id)
        break
      }
      case '-damage':
      case '-heal':
      case '-sethp': {
        const found = this.mon(a)
        if (!found) break
        const cond = parseCondition(b)
        if (cond) {
          const before = found.mon.hp
          Object.assign(found.mon, { hp: cond.hp, fainted: cond.fainted })
          if (cond.status) found.mon.status = cond.status
          if (cmd === '-damage' && before !== null && cond.hp < before) {
            this.log(`${found.mon.species} pierde ${Math.round((before - cond.hp) * 10) / 10} %`, found.side.id)
          }
        }
        this.revealFrom(parts.slice(2), a)
        break
      }
      case 'faint': {
        const found = this.mon(a)
        if (!found) break
        found.mon.hp = 0
        found.mon.fainted = true
        this.log(`${found.mon.species} se debilita`, found.side.id)
        break
      }
      case '-status': {
        const found = this.mon(a)
        if (found) found.mon.status = (b ?? '') as StatusId
        this.revealFrom(parts.slice(2), a)
        break
      }
      case '-curestatus': {
        const found = this.mon(a)
        if (found) found.mon.status = ''
        break
      }
      case '-item': {
        const found = this.mon(a)
        if (found && b) found.mon.item = b
        break
      }
      case '-enditem': {
        const found = this.mon(a)
        if (!found || !b) break
        found.mon.lostItem = b
        found.mon.item = null
        this.log(`${found.mon.species} gasta ${b}`, found.side.id)
        break
      }
      case '-ability': {
        const found = this.mon(a)
        if (found && b) found.mon.ability = b
        this.revealFrom(parts.slice(3), a)
        break
      }
      case '-boost':
      case '-unboost': {
        const found = this.mon(a)
        if (!found || !b) break
        const amount = (Number(c) || 0) * (cmd === '-boost' ? 1 : -1)
        const stat = b as BoostStat
        found.mon.boosts[stat] = Math.max(-6, Math.min(6, (found.mon.boosts[stat] ?? 0) + amount))
        this.revealFrom(parts.slice(3), a)
        break
      }
      case '-setboost': {
        const found = this.mon(a)
        if (found && b) found.mon.boosts[b as BoostStat] = Number(c) || 0
        break
      }
      case '-clearboost':
      case '-clearallboost': {
        if (cmd === '-clearallboost') {
          for (const side of Object.values(s.sides)) side.team.forEach((m) => (m.boosts = {}))
        } else {
          const found = this.mon(a)
          if (found) found.mon.boosts = {}
        }
        break
      }
      case '-clearnegativeboost': {
        const found = this.mon(a)
        if (found) {
          for (const [k, v] of Object.entries(found.mon.boosts)) if ((v ?? 0) < 0) delete found.mon.boosts[k as BoostStat]
        }
        break
      }
      case '-weather': {
        if (!a || a === 'none') {
          s.field.weather = null
        } else if (!parts.includes('[upkeep]')) {
          s.field.weather = WEATHER_NAMES[a] ?? a
          this.log(`Clima: ${s.field.weather}`)
        }
        this.revealFrom(parts.slice(2), undefined)
        break
      }
      case '-fieldstart': {
        const name = (a ?? '').replace(/^move:\s*/, '')
        if (toID(name) === 'trickroom') {
          s.field.trickRoom = s.turn
          this.log('¡Espacio Raro! Los lentos se mueven primero')
        } else if (/terrain/i.test(name)) {
          s.field.terrain = name.replace(/\s*Terrain$/i, '')
          this.log(`Campo: ${name}`)
        }
        this.revealFrom(parts.slice(2), undefined)
        break
      }
      case '-fieldend': {
        const name = (a ?? '').replace(/^move:\s*/, '')
        if (toID(name) === 'trickroom') s.field.trickRoom = null
        else if (/terrain/i.test(name)) s.field.terrain = null
        break
      }
      case '-sidestart':
      case '-sideend': {
        const sideId = a?.slice(0, 2) as SideId
        const side = s.sides[sideId]
        const condition = SIDE_CONDITIONS[toID((b ?? '').replace(/^move:\s*/, ''))]
        if (!side || !condition) break
        if (cmd === '-sidestart') {
          side.conditions[condition] = s.turn
          this.log(`${side.name}: ${b?.replace(/^move:\s*/, '')}`, sideId)
        } else {
          delete side.conditions[condition]
        }
        break
      }
      case 'win':
        s.winner = a ?? null
        s.phase = 'ended'
        this.log(`¡Gana ${a}!`)
        break
      case 'tie':
        s.phase = 'ended'
        this.log('Empate')
        break
    }
  }

  /** Los dos últimos movimientos del turno dan una comparación de velocidad si son de rivales. */
  private recordSpeed() {
    const moves = this.turnMoves
    if (moves.length < 2) return
    const second = moves[moves.length - 1]
    // Compara con el último movimiento del otro jugador en este turno.
    for (let i = moves.length - 2; i >= 0; i--) {
      const first = moves[i]
      if (first.side === second.side) continue
      this.state.speed.push({ turn: this.state.turn, first, second, trickRoom: this.state.field.trickRoom !== null })
      if (this.state.speed.length > 80) this.state.speed.shift()
      break
    }
  }

  /** Un bloque tal como llega del servidor (varias líneas, la primera ">room"). */
  chunk(text: string) {
    for (const raw of text.split('\n')) {
      if (raw.startsWith('|init|battle') && this.state.phase !== 'connecting') {
        // Al reconectar, el servidor repite el combate entero desde el principio.
        this.reset()
      }
      this.line(raw)
    }
  }
}

function newMon(species: string, level: number, gender: MonState['gender']): MonState {
  return {
    previewSpecies: species,
    species: species.replace(/-\*$/, ''),
    nickname: null,
    level,
    gender,
    hp: null,
    fainted: false,
    status: '',
    moves: [],
    item: undefined,
    lostItem: null,
    ability: null,
    mega: false,
    tera: null,
    boosts: {},
    brought: false,
  }
}

/** Los Pokémon activos de un lado, con su índice en el equipo. */
export function activeMons(side: SideState) {
  return side.active
    .map((index, slot) => (index === null || index === undefined ? null : { slot, index, mon: side.team[index] }))
    .filter((x): x is { slot: number; index: number; mon: MonState } => x !== null && !x.mon.fainted)
}

/** Lado contrario. */
export function foe(side: SideId): SideId {
  return side === 'p1' ? 'p2' : 'p1'
}
