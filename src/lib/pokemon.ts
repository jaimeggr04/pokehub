/* Utilidades de dominio Pokémon: sprites, tipos, naturalezas y cálculo de estadísticas. */

export const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

export function spriteUrl(pokemonId: number, shiny = false) {
  return `${SPRITE_BASE}${shiny ? '/shiny' : ''}/${pokemonId}.png`
}

export function artworkUrl(pokemonId: number) {
  return `${SPRITE_BASE}/other/official-artwork/${pokemonId}.png`
}

export function shinyArtworkUrl(pokemonId: number) {
  return `${SPRITE_BASE}/other/official-artwork/shiny/${pokemonId}.png`
}

/** Grito del Pokémon. Es la misma URL que da la PokéAPI en `cries.latest`, sin pedir la ficha. */
export function cryUrl(pokemonId: number) {
  return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`
}

/** Nº de la Pokédex nacional con cuatro cifras, como en los juegos actuales. */
export function dexNumber(n: number) {
  return `Nº ${String(n).padStart(4, '0')}`
}

export function itemSpriteUrl(item: string | null) {
  if (!item) return null
  return `${SPRITE_BASE.replace('/pokemon', '')}/items/${item}.png`
}

/** "swampert-mega" -> "Swampert Mega"; "ogerpon-wellspring-mask" -> "Ogerpon Wellspring Mask" */
export function prettify(slug: string | null | undefined) {
  if (!slug) return '—'
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy', 'stellar',
] as const

export type PokemonType = (typeof POKEMON_TYPES)[number]

/** Paleta oficial de tipos, en pares [fondo, texto] con contraste AA. */
export const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  normal:   { bg: '#9099a1', fg: '#ffffff' },
  fire:     { bg: '#ff9d55', fg: '#402000' },
  water:    { bg: '#4d90d5', fg: '#ffffff' },
  electric: { bg: '#f4d23c', fg: '#3d3200' },
  grass:    { bg: '#63bc5a', fg: '#0d2a0a' },
  ice:      { bg: '#73cec0', fg: '#0b2f2a' },
  fighting: { bg: '#ce4069', fg: '#ffffff' },
  poison:   { bg: '#ab6ac8', fg: '#ffffff' },
  ground:   { bg: '#d97845', fg: '#ffffff' },
  flying:   { bg: '#8fa8dd', fg: '#141b30' },
  psychic:  { bg: '#f97176', fg: '#3a0a0c' },
  bug:      { bg: '#90c12c', fg: '#1b2a05' },
  rock:     { bg: '#c7b78b', fg: '#2b2311' },
  ghost:    { bg: '#5269ad', fg: '#ffffff' },
  dragon:   { bg: '#0b6dc3', fg: '#ffffff' },
  dark:     { bg: '#5a5465', fg: '#ffffff' },
  steel:    { bg: '#5a8ea2', fg: '#ffffff' },
  fairy:    { bg: '#ec8fe6', fg: '#3d1039' },
  stellar:  { bg: '#40b5a5', fg: '#062824' },
  unknown:  { bg: '#9099a1', fg: '#ffffff' },
}

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
}

/** Nombres completos en español: las abreviaturas de Showdown no se leen bien en voz alta. */
export const STAT_NAMES_ES: Record<StatKey, string> = {
  hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'Ataque Especial', spd: 'Defensa Especial', spe: 'Velocidad',
}

/** Naturaleza -> [stat que sube, stat que baja]. null = neutra. */
export const NATURES: Record<string, [StatKey, StatKey] | null> = {
  hardy: null, docile: null, serious: null, bashful: null, quirky: null,
  lonely: ['atk', 'def'], brave: ['atk', 'spe'], adamant: ['atk', 'spa'], naughty: ['atk', 'spd'],
  bold: ['def', 'atk'], relaxed: ['def', 'spe'], impish: ['def', 'spa'], lax: ['def', 'spd'],
  timid: ['spe', 'atk'], hasty: ['spe', 'def'], jolly: ['spe', 'spa'], naive: ['spe', 'spd'],
  modest: ['spa', 'atk'], mild: ['spa', 'def'], quiet: ['spa', 'spe'], rash: ['spa', 'spd'],
  calm: ['spd', 'atk'], gentle: ['spd', 'def'], sassy: ['spd', 'spe'], careful: ['spd', 'spa'],
}

export const NATURE_NAMES = Object.keys(NATURES).sort()

export function natureModifier(nature: string | null | undefined, stat: StatKey): number {
  if (!nature) return 1
  const n = NATURES[nature.toLowerCase()]
  if (!n) return 1
  if (n[0] === stat) return 1.1
  if (n[1] === stat) return 0.9
  return 1
}

/** Fórmula oficial de gen 3+. `base` son las estadísticas base de la especie. */
export function computeStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: string | null | undefined,
): number {
  const common = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100)
  if (stat === 'hp') {
    // Shedinja siempre tiene 1 PS.
    if (base === 1) return 1
    return common + level + 10
  }
  return Math.floor((common + 5) * natureModifier(nature, stat))
}

export const MAX_EVS_TOTAL = 508
export const MAX_EV = 252
export const MAX_IV = 31

export function evTotal(evs: Record<StatKey, number>) {
  return STAT_KEYS.reduce((acc, k) => acc + (evs[k] || 0), 0)
}

/** EVs en notación de Showdown ("252 Atk / 4 SpD / 252 Spe"); cadena vacía si no hay ninguno. */
export function evSpread(evs: Record<StatKey, number>) {
  return STAT_KEYS.filter((k) => evs[k] > 0)
    .map((k) => `${evs[k]} ${STAT_LABELS[k]}`)
    .join(' / ')
}

/** IVs que no son perfectos, también en notación de Showdown ("0 Atk / 0 Spe"). */
export function ivSpread(ivs: Record<StatKey, number>) {
  return STAT_KEYS.filter((k) => ivs[k] !== MAX_IV)
    .map((k) => `${ivs[k]} ${STAT_LABELS[k]}`)
    .join(' / ')
}

/** Barra de estadística: escala hasta 255 con un tope visual razonable. */
export function statBarPercent(value: number, max = 255) {
  return Math.min(100, Math.round((value / max) * 100))
}

export function statColor(value: number) {
  if (value >= 150) return '#22c55e'
  if (value >= 110) return '#84cc16'
  if (value >= 80) return '#eab308'
  if (value >= 55) return '#f97316'
  return '#ef4444'
}
