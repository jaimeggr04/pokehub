import type { BattleFormat } from '@/lib/battle/formats'
import { genFor, moveInfo, statAt, maxInvest, toID, type StatTable } from '@/lib/battle/dex'
import {
  calcAllMoves, calcDamage, likelySet, speedOf,
  type DamageResult, type FieldState, type MonSet,
} from '@/lib/battle/calc'
import { parseSpread, type UsageData, type UsageEntry } from '@/lib/battle/usage'
import { activeMons, foe, type BattleState, type MonState, type SideId } from '@/lib/battle/live'

/*
 * El "cerebro" del asistente: a partir de lo que se ha visto en la partida,
 * las estadísticas de uso y tu equipo, decide qué es importante decirte.
 * Todo son funciones puras: reciben datos y devuelven consejos ya redactados.
 */

export type Tone = 'danger' | 'warning' | 'good' | 'info'

export type Tip = {
  id: string
  tone: Tone
  title: string
  detail?: string
  /** Especies implicadas, para pintar sus sprites junto al consejo. */
  species?: string[]
}

const TONE_ORDER: Record<Tone, number> = { danger: 0, good: 1, warning: 2, info: 3 }

export function sortTips(tips: Tip[]) {
  return [...tips].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

/* ------------------------------------------------------------------ */
/* Perfil de un Pokémon rival: lo visto + lo probable                  */
/* ------------------------------------------------------------------ */

export type Chance = { name: string; pct: number; known: boolean }

export type SpeedRange = {
  /** Sin invertir y con naturaleza que la baja. */
  min: number
  /** Con el reparto más usado. */
  typical: number
  /** Máxima inversión y naturaleza a favor. */
  max: number
  /** % de sets que llevan Pañuelo Elegido (Choice Scarf). */
  scarf: number
}

export type MonProfile = {
  species: string
  state: MonState | null
  usage: UsageEntry | undefined
  /** Set con el que calcular: lo revelado y, para lo demás, lo más probable. */
  set: MonSet
  moves: Chance[]
  items: Chance[]
  abilities: Chance[]
  speed: SpeedRange
}

function chances(known: string[], usage: [string, number][] = [], limit = 6): Chance[] {
  const knownIds = new Set(known.map(toID))
  return [
    ...known.map((name) => ({ name, pct: 100, known: true })),
    ...usage.filter(([name]) => !knownIds.has(toID(name))).map(([name, pct]) => ({ name, pct, known: false })),
  ].slice(0, Math.max(limit, known.length))
}

const NATURE_SPE: Record<string, number> = {
  timid: 1.1, hasty: 1.1, jolly: 1.1, naive: 1.1,
  brave: 0.9, relaxed: 0.9, quiet: 0.9, sassy: 0.9,
}

export function speedRange(format: BattleFormat, species: string, usage: UsageEntry | undefined): SpeedRange {
  const gen = genFor(format)
  const base = gen.species.get(toID(species))?.baseStats.spe ?? 0
  const top = usage?.spreads[0] ? parseSpread(usage.spreads[0][0]) : null
  const typical = top
    ? statAt(base, 'spe', format, top.invest.spe, NATURE_SPE[toID(top.nature)] ?? 1)
    : statAt(base, 'spe', format, 0, 1)
  const scarf = usage?.items.find(([name]) => toID(name) === 'choicescarf')?.[1] ?? 0
  return {
    min: statAt(base, 'spe', format, 0, 0.9),
    typical,
    max: statAt(base, 'spe', format, maxInvest(format), 1.1),
    scarf,
  }
}

export function profileFor(
  format: BattleFormat,
  usageData: UsageData | null,
  species: string,
  state: MonState | null,
  /** Set exacto si es tu propio Pokémon (de tu equipo de PokeHub). */
  ownSet?: MonSet,
): MonProfile {
  const usage = usageData?.species[toID(species)] ?? usageData?.species[toID(species.split('-')[0])]
  const knownMoves = state?.moves ?? []
  const knownItem = typeof state?.item === 'string' ? state.item : null
  const knownAbility = state?.ability ?? null

  const set: MonSet = ownSet
    ? { ...ownSet, species }
    : likelySet(species, usage, {
        moves: knownMoves,
        item: knownItem ?? (state?.item === null ? '' : undefined),
        ability: knownAbility ?? undefined,
      })
  if (state) {
    set.hpPercent = state.hp ?? 100
    set.status = state.status
    set.boosts = state.boosts
    if (state.item === null) set.item = undefined
  }

  const items: Chance[] = knownItem
    ? [{ name: knownItem, pct: 100, known: true }]
    : state?.item === null
      ? []
      : chances([], usage?.items)

  return {
    species,
    state,
    usage,
    set,
    moves: ownSet ? ownSet.moves.map((name) => ({ name, pct: 100, known: true })) : chances(knownMoves, usage?.moves),
    items: ownSet?.item ? [{ name: ownSet.item, pct: 100, known: true }] : items,
    abilities: knownAbility ? [{ name: knownAbility, pct: 100, known: true }] : chances([], usage?.abilities, 3),
    speed: speedRange(format, species, usage),
  }
}

/* ------------------------------------------------------------------ */
/* Velocidad                                                            */
/* ------------------------------------------------------------------ */

const STAGE = (n = 0) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n))

export type SpeedContext = { tailwind: boolean; paralyzed: boolean; boost: number; scarf?: boolean }

export function effectiveSpeed(raw: number, ctx: SpeedContext) {
  let speed = Math.floor(raw * STAGE(ctx.boost))
  if (ctx.scarf) speed = Math.floor(speed * 1.5)
  if (ctx.tailwind) speed *= 2
  if (ctx.paralyzed) speed = Math.floor(speed * 0.5)
  return speed
}

export type SpeedVerdict = {
  /** Quién se mueve antes con movimientos de la misma prioridad. */
  result: 'you' | 'them' | 'tie' | 'depends'
  text: string
  mine: number
  theirs: { min: number; typical: number; max: number; scarf: number | null }
}

/** Compara tu Pokémon con el rival teniendo en cuenta Viento Afín, Espacio Raro, parálisis y cambios. */
export function compareSpeed(
  format: BattleFormat,
  mine: MonProfile,
  theirs: MonProfile,
  field: { trickRoom: boolean; myTailwind: boolean; theirTailwind: boolean },
): SpeedVerdict {
  const myRaw = speedOf(format, mine.set)
  const my = effectiveSpeed(myRaw, {
    tailwind: field.myTailwind,
    paralyzed: mine.state?.status === 'par',
    boost: mine.state?.boosts.spe ?? 0,
    scarf: toID(mine.set.item ?? '') === 'choicescarf',
  })
  const ctx = {
    tailwind: field.theirTailwind,
    paralyzed: theirs.state?.status === 'par',
    boost: theirs.state?.boosts.spe ?? 0,
  }
  const knownItem = theirs.items.find((i) => i.known)?.name
  const scarfKnown = knownItem ? toID(knownItem) === 'choicescarf' : false
  const scarfPossible = !knownItem && theirs.speed.scarf >= 3
  const t = {
    min: effectiveSpeed(theirs.speed.min, { ...ctx, scarf: scarfKnown }),
    typical: effectiveSpeed(theirs.speed.typical, { ...ctx, scarf: scarfKnown }),
    max: effectiveSpeed(theirs.speed.max, { ...ctx, scarf: scarfKnown }),
    scarf: scarfPossible ? effectiveSpeed(theirs.speed.typical, { ...ctx, scarf: true }) : null,
  }

  // En Espacio Raro gana el más lento.
  const beats = (a: number, b: number) => (field.trickRoom ? a < b : a > b)
  const you = mine.species
  const them = theirs.species
  let result: SpeedVerdict['result']
  let text: string

  if (beats(my, t.max) && (t.scarf === null || beats(my, t.scarf))) {
    result = 'you'
    text = `Tu ${you} se mueve antes que ${them} siempre.`
  } else if (beats(t.min, my)) {
    result = 'them'
    text = `${them} se mueve antes que tu ${you} en cualquier caso.`
  } else if (my === t.typical) {
    result = 'tie'
    text = `Empate de velocidad con el reparto más usado de ${them}: es al azar.`
  } else if (beats(my, t.typical)) {
    result = 'depends'
    text =
      t.scarf !== null && !beats(my, t.scarf)
        ? `Tu ${you} va antes que el ${them} típico, pero no si lleva Pañuelo Elegido (${Math.round(theirs.speed.scarf)} %).`
        : `Tu ${you} va antes que el ${them} típico, pero uno con toda la inversión en velocidad te adelanta.`
  } else {
    result = 'depends'
    text = `El ${them} típico va antes que tu ${you}; sólo le ganas si no invierte en velocidad.`
  }
  if (field.trickRoom) text += ' (Espacio Raro: el más lento se mueve primero).'
  return { result, text, mine: my, theirs: t }
}

/* ------------------------------------------------------------------ */
/* Daño                                                                  */
/* ------------------------------------------------------------------ */

function fieldFor(state: BattleState | null, attacker: SideId): FieldState {
  if (!state) return {}
  const weather = state.field.weather as FieldState['weather']
  const terrain = state.field.terrain as FieldState['terrain']
  const cond = (side: SideId) => {
    const c = state.sides[side].conditions
    return { reflect: c.reflect !== undefined, lightScreen: c.lightscreen !== undefined, auroraVeil: c.auroraveil !== undefined }
  }
  return { weather: weather ?? '', terrain: terrain ?? '', attackerSide: {}, defenderSide: cond(foe(attacker)) }
}

/** El golpe más fuerte que puede hacer `attacker` a `defender` con sus ataques (conocidos o probables). */
export function bestHit(format: BattleFormat, attacker: MonProfile, defender: MonProfile, field?: FieldState): DamageResult | null {
  // Para el rival se prueban también ataques probables más allá de los 4 del set.
  const moves = attacker.moves.filter((m) => m.known || m.pct >= 15).map((m) => m.name)
  const results = calcAllMoves(format, { ...attacker.set, moves }, defender.set, field)
  return results[0] ?? null
}

/** "45–53 %", "88–100+ %" o "más del 100 %": por encima del 100 % el número exacto no aporta. */
export function pctRange(min: number, max: number) {
  const f = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
  if (min >= 100) return 'más del 100 %'
  if (max > 100) return `${f(min)}–100+ %`
  return `${f(min)}–${f(max)} %`
}

/* ------------------------------------------------------------------ */
/* Vista previa: qué traer                                              */
/* ------------------------------------------------------------------ */

export type PreviewPick = { species: string; score: number; reasons: string[] }

export type PreviewPlan = {
  /** Tus Pokémon de mejor a peor contra este equipo. */
  picks: PreviewPick[]
  /** Cuántos se eligen (4 en dobles VGC, 3 en BSS…). */
  bringCount: number
  leads: string[]
  /** Sus Pokémon más peligrosos para tu equipo. */
  threats: PreviewPick[]
  tips: Tip[]
}

const SPEED_CONTROL = ['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'scaryface']
const REDIRECTION = ['followme', 'ragepowder']

function has(profile: MonProfile, ids: string[], minPct = 40) {
  return profile.moves.find((m) => ids.includes(toID(m.name)) && (m.known || m.pct >= minPct))
}

export function previewPlan(
  format: BattleFormat,
  usageData: UsageData | null,
  mine: MonProfile[],
  theirs: MonProfile[],
): PreviewPlan {
  const doubles = format.gameType === 'doubles'
  const bringCount = doubles ? 4 : format.id.includes('bss') ? 3 : 6

  // Matriz de daño: cuánto hace cada uno de los tuyos a cada uno de los suyos y al revés.
  const score = new Map<string, { off: number; def: number; speed: number; n: number }>()
  const threat = new Map<string, { dmg: number; taken: number; n: number }>()
  for (const m of mine) {
    for (const t of theirs) {
      const off = Math.min(100, bestHit(format, m, t)?.maxPercent ?? 0)
      const def = Math.min(100, bestHit(format, t, m)?.maxPercent ?? 0)
      const sp = compareSpeed(format, m, t, { trickRoom: false, myTailwind: false, theirTailwind: false }).result
      const speed = sp === 'you' ? 1 : sp === 'them' ? -1 : 0
      const s = score.get(m.species) ?? { off: 0, def: 0, speed: 0, n: 0 }
      score.set(m.species, { off: s.off + off, def: s.def + def, speed: s.speed + speed, n: s.n + 1 })
      const th = threat.get(t.species) ?? { dmg: 0, taken: 0, n: 0 }
      threat.set(t.species, { dmg: th.dmg + def, taken: th.taken + off, n: th.n + 1 })
    }
  }

  const picks: PreviewPick[] = mine
    .map((m) => {
      const s = score.get(m.species) ?? { off: 0, def: 0, speed: 0, n: 1 }
      const off = s.off / s.n
      const def = s.def / s.n
      const reasons: string[] = []
      let value = off - def * 0.75 + s.speed * 6
      if (off >= 55) reasons.push(`Golpea fuerte a su equipo (${Math.round(off)} % de media)`)
      if (def <= 35) reasons.push('Aguanta bien sus ataques')
      if (def >= 70) reasons.push('Sufre mucho contra su equipo')
      if (s.speed > s.n / 2) reasons.push('Más rápido que la mayoría de sus Pokémon')
      if (doubles && has(m, ['fakeout'])) {
        value += 8
        reasons.push('Fake Out para controlar el primer turno')
      }
      if (doubles && has(m, SPEED_CONTROL)) {
        value += 8
        reasons.push('Controla la velocidad')
      }
      if (doubles && m.abilities.some((a) => a.known && toID(a.name) === 'intimidate')) {
        value += 6
        reasons.push('Intimidación contra sus atacantes físicos')
      }
      return { species: m.species, score: Math.round(value), reasons }
    })
    .sort((a, b) => b.score - a.score)

  const threats: PreviewPick[] = theirs
    .map((t) => {
      const th = threat.get(t.species) ?? { dmg: 0, taken: 0, n: 1 }
      const dmg = th.dmg / th.n
      const taken = th.taken / th.n
      const reasons: string[] = []
      if (dmg >= 55) reasons.push(`Hace mucho daño a tu equipo (${Math.round(dmg)} % de media)`)
      if (taken <= 35) reasons.push('A tu equipo le cuesta dañarlo')
      return { species: t.species, score: Math.round(dmg - taken * 0.75), reasons }
    })
    .sort((a, b) => b.score - a.score)

  const brought = picks.slice(0, bringCount)
  const leadOrder = [...brought].sort((a, b) => {
    const lead = (p: PreviewPick) =>
      (p.reasons.some((r) => r.startsWith('Fake Out')) ? 2 : 0) + (p.reasons.some((r) => r.startsWith('Controla')) ? 2 : 0)
    return lead(b) - lead(a) || b.score - a.score
  })

  return {
    picks,
    bringCount,
    leads: leadOrder.slice(0, doubles ? 2 : 1).map((p) => p.species),
    threats: threats.slice(0, 3),
    tips: sortTips(teamNotes(theirs, doubles)),
  }
}

/** Lo que conviene saber del equipo rival antes de empezar. */
export function teamNotes(theirs: MonProfile[], doubles: boolean): Tip[] {
  const tips: Tip[] = []
  const withMove = (ids: string[], min = 40) =>
    theirs.map((p) => ({ p, m: has(p, ids, min) })).filter((x): x is { p: MonProfile; m: Chance } => Boolean(x.m))

  const tr = withMove(['trickroom'], 30)
  if (tr.length) {
    tips.push({
      id: 'note-tr',
      tone: 'warning',
      title: 'Pueden poner Espacio Raro',
      detail: `${tr.map(({ p, m }) => `${p.species} (${Math.round(m.pct)} %)`).join(', ')}. Si lo activan, tus Pokémon más lentos irán primero durante 4 turnos. Guarda Protección o un Taunt para ese turno.`,
      species: tr.map(({ p }) => p.species),
    })
  }
  const tw = withMove(['tailwind'], 30)
  if (tw.length) {
    tips.push({
      id: 'note-tw',
      tone: 'warning',
      title: 'Pueden poner Viento Afín',
      detail: `${tw.map(({ p, m }) => `${p.species} (${Math.round(m.pct)} %)`).join(', ')}. Dobla su velocidad 4 turnos: si tienes el tuyo, respóndelo o aguanta con Protección.`,
      species: tw.map(({ p }) => p.species),
    })
  }
  if (doubles) {
    const fo = withMove(['fakeout'], 50)
    if (fo.length) {
      tips.push({
        id: 'note-fo',
        tone: 'info',
        title: 'Fake Out en su equipo',
        detail: `${fo.map(({ p }) => p.species).join(', ')}: en su primer turno en el campo pueden hacer retroceder a uno de los tuyos.`,
        species: fo.map(({ p }) => p.species),
      })
    }
    const redirect = withMove(REDIRECTION, 40)
    if (redirect.length) {
      tips.push({
        id: 'note-redirect',
        tone: 'info',
        title: 'Redirección',
        detail: `${redirect.map(({ p }) => p.species).join(', ')} puede atraer tus ataques de un solo objetivo con Follow Me o Rage Powder. Los ataques en área no se ven afectados.`,
        species: redirect.map(({ p }) => p.species),
      })
    }
  }
  const intimidate = theirs.filter((p) => p.abilities.some((a) => toID(a.name) === 'intimidate' && (a.known || a.pct >= 50)))
  if (intimidate.length && doubles) {
    tips.push({
      id: 'note-intimidate',
      tone: 'info',
      title: 'Intimidación',
      detail: `${intimidate.map((p) => p.species).join(', ')}: al salir baja el Ataque de tus dos Pokémon. Tus atacantes especiales no lo notan.`,
      species: intimidate.map((p) => p.species),
    })
  }
  const WEATHER: Record<string, string> = { drought: 'sol', drizzle: 'lluvia', sandstream: 'arena', snowwarning: 'nieve' }
  for (const p of theirs) {
    const w = p.abilities.find((a) => WEATHER[toID(a.name)] && (a.known || a.pct >= 50))
    if (w) {
      tips.push({
        id: `note-weather-${toID(p.species)}`,
        tone: 'info',
        title: `Pone ${WEATHER[toID(w.name)]} al salir`,
        detail: `${p.species} (${w.name}) cambia el clima nada más entrar.`,
        species: [p.species],
      })
    }
  }
  return tips
}

/* ------------------------------------------------------------------ */
/* Consejos del turno                                                   */
/* ------------------------------------------------------------------ */

export type TurnContext = {
  format: BattleFormat
  state: BattleState
  mySide: SideId
  usage: UsageData | null
  /** Perfiles de todos los Pokémon de cada lado (mismo orden que state.sides[x].team). */
  profiles: Record<SideId, MonProfile[]>
}

/** Turnos que le quedan a un efecto que dura `duration` y empezó en `since`. */
export function turnsLeft(since: number | undefined | null, duration: number, turn: number) {
  if (since === undefined || since === null) return 0
  return Math.max(0, since + duration - turn)
}

export function turnTips(ctx: TurnContext): Tip[] {
  const { format, state, mySide, profiles } = ctx
  const theirSide = foe(mySide)
  const tips: Tip[] = []
  const myActive = activeMons(state.sides[mySide])
  const theirActive = activeMons(state.sides[theirSide])
  if (!myActive.length || !theirActive.length) return tips

  const trickRoom = state.field.trickRoom !== null
  const myTailwind = state.sides[mySide].conditions.tailwind !== undefined
  const theirTailwind = state.sides[theirSide].conditions.tailwind !== undefined

  // Efectos de campo con cuenta atrás.
  if (trickRoom) {
    const left = turnsLeft(state.field.trickRoom, 5, state.turn)
    tips.push({
      id: 'field-tr',
      tone: 'warning',
      title: `Espacio Raro: ${left === 1 ? 'último turno' : `quedan ${left} turnos`}`,
      detail: 'Los Pokémon más lentos se mueven primero (la prioridad sigue funcionando igual).',
    })
  }
  if (theirTailwind) {
    const left = turnsLeft(state.sides[theirSide].conditions.tailwind, 4, state.turn)
    tips.push({
      id: 'field-tw-them',
      tone: 'warning',
      title: `Su Viento Afín: ${left === 1 ? 'último turno' : `quedan ${left} turnos`}`,
      detail: 'Su velocidad está duplicada. Protegerte estos turnos puede agotarlo.',
    })
  }
  if (myTailwind) {
    const left = turnsLeft(state.sides[mySide].conditions.tailwind, 4, state.turn)
    tips.push({
      id: 'field-tw-me',
      tone: 'good',
      title: `Tu Viento Afín: ${left === 1 ? 'último turno' : `quedan ${left} turnos`}`,
      detail: 'Aprovecha para atacar: vas por delante.',
    })
  }

  const field = { trickRoom, myTailwind, theirTailwind }

  for (const them of theirActive) {
    const tp = profiles[theirSide][them.index]
    if (!tp) continue

    // Fake Out en su primer turno en el campo.
    if (
      format.gameType === 'doubles' &&
      them.mon.activeSince !== null &&
      state.turn === them.mon.activeSince + 1 &&
      has(tp, ['fakeout'], 40) &&
      !them.mon.moves.some((m) => toID(m) === 'fakeout' && them.mon.activeSince === state.turn)
    ) {
      const pct = tp.moves.find((m) => toID(m.name) === 'fakeout')?.pct ?? 0
      tips.push({
        id: `fo-${them.index}`,
        tone: 'warning',
        title: `${tp.species} puede usar Fake Out este turno`,
        detail: `Lo lleva el ${Math.round(pct)} % de los ${tp.species}. Protección o un Pokémon de tipo Fantasma lo esquivan.`,
        species: [tp.species],
      })
    }

    for (const me of myActive) {
      const mp = profiles[mySide][me.index]
      if (!mp) continue
      const speed = compareSpeed(format, mp, tp, field)

      // Peligro: su mejor golpe te debilita.
      const incoming = bestHit(format, tp, mp, fieldFor(state, theirSide))
      if (incoming && incoming.killsNow !== 'no') {
        const first = speed.result === 'them' || speed.result === 'depends'
        tips.push({
          id: `danger-${them.index}-${me.index}`,
          tone: first ? 'danger' : 'warning',
          title:
            incoming.killsNow === 'yes'
              ? `${tp.species} debilita a tu ${mp.species} con ${incoming.move}`
              : `${tp.species} puede debilitar a tu ${mp.species} con ${incoming.move}`,
          detail: `${pctRange(incoming.minPercent, incoming.maxPercent)} y le queda ${Math.round(mp.set.hpPercent ?? 100)} %. ${speed.text}`,
          species: [tp.species, mp.species],
        })
      }

      // Oportunidad: tu mejor golpe.
      const outgoing = bestHit(format, mp, tp, fieldFor(state, mySide))
      if (outgoing && outgoing.killsNow !== 'no') {
        tips.push({
          id: `ko-${me.index}-${them.index}`,
          tone: 'good',
          title:
            outgoing.killsNow === 'yes'
              ? `Tu ${mp.species} debilita a ${tp.species} con ${outgoing.move}`
              : `Tu ${mp.species} puede debilitar a ${tp.species} con ${outgoing.move}`,
          detail: `${pctRange(outgoing.minPercent, outgoing.maxPercent)} y le queda ${Math.round(tp.set.hpPercent ?? 100)} %. ${speed.text}`,
          species: [mp.species, tp.species],
        })
      }
    }

    // Objeto sin revelar que cambia el cálculo.
    const sash = !tp.items.some((i) => i.known) && tp.items.find((i) => toID(i.name) === 'focussash' && i.pct >= 25)
    if (sash && (tp.set.hpPercent ?? 100) >= 100) {
      tips.push({
        id: `sash-${them.index}`,
        tone: 'info',
        title: `${tp.species} puede llevar Banda Focus (${Math.round(sash.pct)} %)`,
        detail: 'Con la vida completa aguantaría un golpe que lo debilitara. Un ataque en área o un golpe múltiple la rompen.',
        species: [tp.species],
      })
    }
  }

  return sortTips(dedupe(tips)).slice(0, 8)
}

function dedupe(tips: Tip[]) {
  const seen = new Set<string>()
  return tips.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

/* ------------------------------------------------------------------ */
/* Deducciones de velocidad a partir del orden de los ataques            */
/* ------------------------------------------------------------------ */

export type SpeedInsight = { species: string; text: string }

/** Qué se sabe de la velocidad del rival por quién se movió antes. */
export function speedInsights(ctx: TurnContext): SpeedInsight[] {
  const { format, state, mySide, profiles } = ctx
  const gen = genFor(format)
  const out = new Map<string, SpeedInsight>()
  for (const ev of state.speed) {
    if (ev.trickRoom) continue
    const pa = moveInfo(gen, ev.first.move)?.priority ?? 0
    const pb = moveInfo(gen, ev.second.move)?.priority ?? 0
    if (pa !== pb) continue
    const mineFirst = ev.first.side === mySide
    const mine = mineFirst ? ev.first : ev.second
    const theirs = mineFirst ? ev.second : ev.first
    const mp = profiles[mySide][mine.index]
    const tp = profiles[foe(mySide)][theirs.index]
    if (!mp || !tp) continue
    const mySpeed = speedOf(format, mp.set)
    const key = `${tp.species}-${mineFirst ? 'slower' : 'faster'}`
    if (mineFirst) {
      out.set(key, { species: tp.species, text: `${tp.species} es más lento que tu ${mp.species} (${mySpeed} de velocidad).` })
    } else {
      const scarfy = tp.speed.max < mySpeed ? ' Tiene que llevar Pañuelo Elegido o un aumento de velocidad.' : ''
      out.set(key, { species: tp.species, text: `${tp.species} es más rápido que tu ${mp.species} (${mySpeed} de velocidad).${scarfy}` })
    }
  }
  return [...out.values()]
}

/* ------------------------------------------------------------------ */
/* Utilidades para la interfaz                                          */
/* ------------------------------------------------------------------ */

/** Estadísticas reales de un set (para enseñarlas en la ficha). */
export function statsOf(format: BattleFormat, set: MonSet): StatTable | null {
  try {
    const gen = genFor(format)
    const s = gen.species.get(toID(set.species))
    if (!s) return null
    const nature = set.nature ? gen.natures.get(toID(set.nature)) : undefined
    const mod = (k: keyof StatTable) => (nature?.plus === k && nature?.minus !== k ? 1.1 : nature?.minus === k && nature?.plus !== k ? 0.9 : 1)
    const keys: (keyof StatTable)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    return Object.fromEntries(
      keys.map((k) => [k, statAt(s.baseStats[k], k, format, set.invest?.[k] ?? 0, k === 'hp' ? 1 : mod(k))]),
    ) as StatTable
  } catch {
    return null
  }
}

export { calcDamage }
