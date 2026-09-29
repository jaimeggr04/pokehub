/**
 * Ficha de entrenador: medallas, nº de ID y Pokémon compañero.
 *
 * Todo son funciones puras sin dependencias de servidor ni de navegador. El
 * servidor calcula (también lo que depende de la fecha) y los componentes de
 * cliente sólo pintan el resultado, así nada cambia al hidratar.
 */

export const MEDAL_IDS = [
  'primer-equipo',
  'estratega',
  'popular',
  'estrella',
  'sociable',
  'lider',
  'variocolor',
  'veterano',
] as const

export type MedalId = (typeof MEDAL_IDS)[number]

export type TrainerStats = {
  /** Equipos visibles para quien mira (los privados sólo cuentan en tu propia ficha). */
  teams: number
  /** Suma de los me gusta de sus equipos públicos. */
  likesReceived: number
  followers: number
  /** Builds variocolor entre sus equipos visibles. */
  shinyBuilds: number
  /** Días completos desde que se registró. */
  accountDays: number
}

export type MedalDefinition = {
  id: MedalId
  name: string
  /** En infinitivo: vale igual para tu ficha que para la de otro entrenador. */
  hint: string
  metric: keyof TrainerStats
  goal: number
  /** [singular, plural] para el progreso: "3/5 equipos". */
  unit: readonly [string, string]
}

export const MEDALS: readonly MedalDefinition[] = [
  {
    id: 'primer-equipo',
    name: 'Primer equipo',
    hint: 'Publicar el primer equipo.',
    metric: 'teams',
    goal: 1,
    unit: ['equipo', 'equipos'],
  },
  {
    id: 'estratega',
    name: 'Estratega',
    hint: 'Publicar 5 equipos.',
    metric: 'teams',
    goal: 5,
    unit: ['equipo', 'equipos'],
  },
  {
    id: 'popular',
    name: 'Popular',
    hint: 'Recibir 10 me gusta entre todos sus equipos públicos.',
    metric: 'likesReceived',
    goal: 10,
    unit: ['me gusta', 'me gusta'],
  },
  {
    id: 'estrella',
    name: 'Estrella',
    hint: 'Recibir 50 me gusta entre todos sus equipos públicos.',
    metric: 'likesReceived',
    goal: 50,
    unit: ['me gusta', 'me gusta'],
  },
  {
    id: 'sociable',
    name: 'Sociable',
    hint: 'Conseguir 5 seguidores.',
    metric: 'followers',
    goal: 5,
    unit: ['seguidor', 'seguidores'],
  },
  {
    id: 'lider',
    name: 'Líder',
    hint: 'Conseguir 25 seguidores.',
    metric: 'followers',
    goal: 25,
    unit: ['seguidor', 'seguidores'],
  },
  {
    id: 'variocolor',
    name: 'Variocolor',
    hint: 'Incluir un Pokémon variocolor en algún equipo.',
    metric: 'shinyBuilds',
    goal: 1,
    unit: ['variocolor', 'variocolores'],
  },
  {
    id: 'veterano',
    name: 'Veterano',
    hint: 'Cumplir un año como entrenador en PokeHub.',
    metric: 'accountDays',
    goal: 365,
    unit: ['día', 'días'],
  },
]

const BY_ID = new Map(MEDALS.map((medal) => [medal.id, medal]))

export function getMedal(id: MedalId): MedalDefinition {
  // MEDALS cubre todos los MedalId: el tipo lo garantiza.
  return BY_ID.get(id) as MedalDefinition
}

export type MedalProgress = {
  id: MedalId
  /** Ya topado en `goal`: "5/5" y no "7/5" en una medalla conseguida. */
  current: number
  goal: number
  unlocked: boolean
}

export function computeMedals(stats: TrainerStats): MedalProgress[] {
  return MEDALS.map((medal) => {
    const value = Math.max(0, Math.floor(stats[medal.metric]))
    return {
      id: medal.id,
      current: Math.min(value, medal.goal),
      goal: medal.goal,
      unlocked: value >= medal.goal,
    }
  })
}

export function formatMedalProgress(medal: MedalDefinition, current: number): string {
  const [one, many] = medal.unit
  return `${current}/${medal.goal} ${medal.goal === 1 ? one : many}`
}

// FNV-1a: el mismo número en el servidor y en el cliente, y estable para siempre.
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** "ID Nº 04821": cinco cifras derivadas del id del usuario, como en los juegos. */
export function trainerNumber(userId: string): string {
  return String(hash(userId) % 100000).padStart(5, '0')
}

const DAY_MS = 86_400_000

/** Días completos transcurridos. Llamar sólo en el servidor y pasar el resultado. */
export function daysSince(iso: string, now: number = Date.now()): number {
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((now - start) / DAY_MS))
}

export type PartnerBuild = { pokemon_id: number; pokemon_name: string; shiny: boolean }

export type PartnerPokemon = {
  id: number
  name: string
  /** Si la mayoría de las veces lo lleva variocolor, el compañero sale variocolor. */
  shiny: boolean
  /** En cuántos equipos aparece. */
  teams: number
  /** Total de equipos considerados. */
  totalTeams: number
}

/**
 * El Pokémon más usado entre sus equipos. Los equipos deben llegar del más
 * reciente al más antiguo: en caso de empate gana el que usó más tarde.
 */
export function pickPartner(teams: { builds: PartnerBuild[] | null }[]): PartnerPokemon | null {
  const tally = new Map<number, { name: string; uses: number; shiny: number; teams: number; first: number }>()

  teams.forEach((team, index) => {
    const seen = new Set<number>()
    for (const build of team.builds ?? []) {
      const entry = tally.get(build.pokemon_id) ?? {
        name: build.pokemon_name,
        uses: 0,
        shiny: 0,
        teams: 0,
        first: index,
      }
      entry.uses += 1
      if (build.shiny) entry.shiny += 1
      if (!seen.has(build.pokemon_id)) {
        seen.add(build.pokemon_id)
        entry.teams += 1
      }
      tally.set(build.pokemon_id, entry)
    }
  })

  let best: [number, { name: string; uses: number; shiny: number; teams: number; first: number }] | null = null
  for (const candidate of tally) {
    if (!best) {
      best = candidate
      continue
    }
    const [, a] = candidate
    const [, b] = best
    if (a.uses > b.uses || (a.uses === b.uses && (a.teams > b.teams || (a.teams === b.teams && a.first < b.first)))) {
      best = candidate
    }
  }
  if (!best) return null

  const [id, entry] = best
  return {
    id,
    name: entry.name,
    shiny: entry.shiny * 2 > entry.uses,
    teams: entry.teams,
    totalTeams: teams.length,
  }
}
