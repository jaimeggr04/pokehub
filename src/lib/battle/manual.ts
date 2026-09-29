import { createBattleState, type BattleState, type MonState, type SideId } from '@/lib/battle/live'

/*
 * Modo manual: para cuando el combate es privado o no hay enlace. El
 * usuario va marcando lo que ve y el asistente trabaja igual que en vivo,
 * porque el estado tiene la misma forma. Todas las funciones devuelven un
 * estado nuevo (no mutan el que reciben).
 */

function mon(species: string): MonState {
  return {
    previewSpecies: species,
    species,
    nickname: species,
    level: 50,
    gender: '',
    hp: 100,
    fainted: false,
    status: '',
    moves: [],
    item: undefined,
    lostItem: null,
    ability: null,
    mega: species.includes('-Mega'),
    tera: null,
    boosts: {},
    brought: false,
    activeSince: null,
  }
}

export function createManualState(opts: {
  gameType: 'doubles' | 'singles'
  mySpecies: string[]
  theirSpecies: string[]
  myName?: string
  theirName?: string
}): BattleState {
  const state = createBattleState('manual')
  state.gameType = opts.gameType
  state.phase = 'preview'
  state.sides.p1.name = opts.myName ?? 'Tú'
  state.sides.p2.name = opts.theirName ?? 'Rival'
  state.sides.p1.team = opts.mySpecies.map(mon)
  state.sides.p2.team = opts.theirSpecies.map(mon)
  return state
}

function edit(state: BattleState, fn: (draft: BattleState) => void): BattleState {
  const draft = structuredClone(state)
  fn(draft)
  return draft
}

/** Pone un Pokémon en un hueco activo (o lo vacía con index null). */
export function setActive(state: BattleState, side: SideId, slot: number, index: number | null) {
  return edit(state, (d) => {
    if (d.phase === 'preview') d.phase = 'battle'
    if (d.turn === 0) d.turn = 1
    d.sides[side].active[slot] = index
    if (index !== null) {
      const m = d.sides[side].team[index]
      m.brought = true
      m.activeSince = d.turn - 1
      m.boosts = {}
    }
  })
}

export function nextTurn(state: BattleState) {
  return edit(state, (d) => {
    d.turn += 1
    d.phase = 'battle'
  })
}

export function reveal(
  state: BattleState,
  side: SideId,
  index: number,
  kind: 'move' | 'item' | 'ability',
  value: string,
) {
  return edit(state, (d) => {
    const m = d.sides[side].team[index]
    if (!m) return
    if (kind === 'move' && !m.moves.includes(value)) m.moves = [...m.moves, value].slice(-4)
    if (kind === 'item') m.item = value || undefined
    if (kind === 'ability') m.ability = value || null
  })
}

export function forget(state: BattleState, side: SideId, index: number, move: string) {
  return edit(state, (d) => {
    const m = d.sides[side].team[index]
    if (m) m.moves = m.moves.filter((x) => x !== move)
  })
}

export function setHp(state: BattleState, side: SideId, index: number, hp: number) {
  return edit(state, (d) => {
    const m = d.sides[side].team[index]
    if (!m) return
    m.hp = Math.max(0, Math.min(100, Math.round(hp)))
    m.fainted = m.hp === 0
    if (m.fainted) {
      const slot = d.sides[side].active.indexOf(index)
      if (slot >= 0) d.sides[side].active[slot] = null
    }
  })
}

export function setBoost(state: BattleState, side: SideId, index: number, stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe', value: number) {
  return edit(state, (d) => {
    const m = d.sides[side].team[index]
    if (m) m.boosts[stat] = Math.max(-6, Math.min(6, value))
  })
}

export function setStatus(state: BattleState, side: SideId, index: number, status: MonState['status']) {
  return edit(state, (d) => {
    const m = d.sides[side].team[index]
    if (m) m.status = status
  })
}

/** Viento Afín, pantallas… en un lado (on = empieza este turno, off = se acaba). */
export function toggleSideCondition(
  state: BattleState,
  side: SideId,
  condition: 'tailwind' | 'reflect' | 'lightscreen' | 'auroraveil',
  on: boolean,
) {
  return edit(state, (d) => {
    if (on) d.sides[side].conditions[condition] = d.turn
    else delete d.sides[side].conditions[condition]
  })
}

export function setField(
  state: BattleState,
  field: { weather?: string | null; terrain?: string | null; trickRoom?: boolean },
) {
  return edit(state, (d) => {
    if (field.weather !== undefined) d.field.weather = field.weather
    if (field.terrain !== undefined) d.field.terrain = field.terrain
    if (field.trickRoom !== undefined) d.field.trickRoom = field.trickRoom ? d.turn : null
  })
}
