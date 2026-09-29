/* Tabla de tipos de la 6.ª generación en adelante y análisis defensivo de equipos. */

/** Los 18 tipos de ataque, en el orden de la tabla oficial. Astral sólo existe como teratipo. */
export const ATTACK_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const

export type AttackType = (typeof ATTACK_TYPES)[number]

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4

/** Nombres oficiales en español (España). */
export const TYPE_NAMES_ES: Record<AttackType | 'stellar', string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada', stellar: 'Astral',
}

export function typeNameEs(type: string): string {
  return TYPE_NAMES_ES[type as AttackType] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

type Row = Partial<Record<AttackType, 0 | 0.5 | 2>>

// Sólo lo que no es neutro: cualquier cruce que no aparezca vale ×1.
const CHART: Record<AttackType, Row> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2,
    dragon: 0.5, steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0,
    dark: 2, steel: 2, fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5,
    dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
}

export function isAttackType(type: string): type is AttackType {
  return Object.prototype.hasOwnProperty.call(CHART, type)
}

/**
 * Multiplicador de un ataque de `attackType` contra un Pokémon de `defenderTypes`.
 * Se usan como mucho dos tipos distintos (un Pokémon no tiene más); los que la
 * tabla no conoce ("unknown", "stellar") cuentan como neutros.
 */
export function effectiveness(attackType: string, defenderTypes: readonly string[]): Effectiveness {
  if (!isAttackType(attackType)) return 1
  const row = CHART[attackType]
  let result = 1
  for (const type of [...new Set(defenderTypes)].slice(0, 2)) {
    result *= isAttackType(type) ? (row[type] ?? 1) : 1
  }
  return result as Effectiveness
}

/** Texto corto de un multiplicador, tal y como se pinta en las celdas. */
export function formatMultiplier(value: Effectiveness): string {
  switch (value) {
    case 4: return '×4'
    case 2: return '×2'
    case 0.5: return '½'
    case 0.25: return '¼'
    case 0: return '0'
    default: return '×1'
  }
}

/** Lo mismo, pero para leerlo en voz alta: "½" se pronuncia fatal. */
export function describeMultiplier(value: Effectiveness): string {
  switch (value) {
    case 4: return 'recibe el cuádruple'
    case 2: return 'recibe el doble'
    case 0.5: return 'recibe la mitad'
    case 0.25: return 'recibe la cuarta parte'
    case 0: return 'es inmune'
    default: return 'recibe daño normal'
  }
}

export interface TypeMatchupRow {
  type: AttackType
  /** Un multiplicador por miembro, en el mismo orden en que se pasaron. */
  cells: Effectiveness[]
  /** Miembros que reciben ×2 o ×4. */
  weak: number
  /** Miembros que reciben ½, ¼ o nada (las inmunidades cuentan como resistencia). */
  resist: number
  immune: number
  quadWeak: number
  /** Tres o más débiles y como mucho uno que lo aguante: un agujero en el equipo. */
  critical: boolean
}

/** Tabla defensiva completa: una fila por tipo de ataque. */
export function teamMatchups(teamTypes: readonly (readonly string[])[]): TypeMatchupRow[] {
  return ATTACK_TYPES.map((type) => {
    const cells = teamTypes.map((types) => effectiveness(type, types))
    const weak = cells.filter((m) => m > 1).length
    const resist = cells.filter((m) => m < 1).length
    return {
      type,
      cells,
      weak,
      resist,
      immune: cells.filter((m) => m === 0).length,
      quadWeak: cells.filter((m) => m === 4).length,
      critical: weak >= 3 && resist <= 1,
    }
  })
}

export interface MatchupSummary {
  /** Tipos que golpean a varios miembros y que el resto no compensa, de peor a menos malo. */
  weaknesses: TypeMatchupRow[]
  /** Tipos que el equipo aguanta bien, de mejor a menos bueno. */
  resistances: TypeMatchupRow[]
  /** Tipos que ningún miembro resiste. */
  uncovered: TypeMatchupRow[]
  critical: TypeMatchupRow[]
}

/**
 * Resumen legible de la tabla. El umbral de "varios" se adapta al tamaño: en
 * un equipo de tres, dos débiles al mismo tipo ya es mucho.
 */
export function summarizeMatchups(rows: TypeMatchupRow[], teamSize: number): MatchupSummary {
  if (teamSize === 0) return { weaknesses: [], resistances: [], uncovered: [], critical: [] }
  const threshold = teamSize >= 4 ? 2 : 1

  const weaknesses = rows
    .filter((r) => r.weak >= threshold && r.weak > r.resist)
    .sort((a, b) => b.weak - b.resist - (a.weak - a.resist) || b.weak - a.weak || b.quadWeak - a.quadWeak)

  const resistances = rows
    .filter((r) => r.resist >= threshold && r.resist > r.weak)
    .sort((a, b) => b.resist - b.weak - (a.resist - a.weak) || b.immune - a.immune || b.resist - a.resist)

  return {
    weaknesses,
    resistances,
    uncovered: rows.filter((r) => r.resist === 0),
    critical: rows.filter((r) => r.critical),
  }
}
