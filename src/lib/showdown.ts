import type { BuildRow } from '@/lib/database.types'
import { STAT_KEYS, STAT_LABELS, type StatKey } from '@/lib/pokemon'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "swampert-mega" -> "Swampert-Mega" (formato de especie de Pokémon Showdown) */
export function speciesLabel(slug: string) {
  return slug.split('-').map(cap).join('-')
}

/** "leech-seed" -> "Leech Seed" */
export function wordsLabel(slug: string | null | undefined) {
  if (!slug) return ''
  return slug.split('-').map(cap).join(' ')
}

const GENDER_TAG: Record<string, string> = { male: ' (M)', female: ' (F)', unknown: '' }

/** Exporta una build al formato de texto de Pokémon Showdown. */
export function buildToShowdown(b: BuildRow): string {
  const lines: string[] = []

  const species = speciesLabel(b.pokemon_name)
  const head = b.nickname ? `${b.nickname} (${species})` : species
  lines.push(`${head}${GENDER_TAG[b.gender] ?? ''}${b.item ? ` @ ${wordsLabel(b.item)}` : ''}`)

  if (b.ability) lines.push(`Ability: ${wordsLabel(b.ability)}`)
  if (b.level !== 100) lines.push(`Level: ${b.level}`)
  if (b.shiny) lines.push('Shiny: Yes')
  if (b.tera_type) lines.push(`Tera Type: ${wordsLabel(b.tera_type)}`)

  const evs = statList(b, 'evs', 0)
  if (evs) lines.push(`EVs: ${evs}`)
  if (b.nature) lines.push(`${cap(b.nature)} Nature`)
  const ivs = statList(b, 'ivs', 31)
  if (ivs) lines.push(`IVs: ${ivs}`)

  for (const m of b.moves) if (m) lines.push(`- ${wordsLabel(m)}`)

  return lines.join('\n')
}

function statList(b: BuildRow, kind: 'evs' | 'ivs', skip: number) {
  return STAT_KEYS.map((k) => {
    const v = b[`${k}_${kind}` as keyof BuildRow] as number
    return v === skip ? null : `${v} ${STAT_LABELS[k]}`
  })
    .filter(Boolean)
    .join(' / ')
}

export function teamToShowdown(builds: BuildRow[]): string {
  return [...builds]
    .sort((a, b) => a.slot - b.slot)
    .map(buildToShowdown)
    .join('\n\n')
}

/* ------------------------------- Importación ------------------------------- */

export interface ParsedBuild {
  pokemon_name: string
  nickname: string | null
  gender: 'male' | 'female' | 'unknown'
  item: string | null
  ability: string | null
  nature: string | null
  tera_type: string | null
  level: number
  shiny: boolean
  moves: string[]
  ivs: Record<StatKey, number>
  evs: Record<StatKey, number>
}

/**
 * Normaliza cualquier texto de Showdown al formato de slug de la PokéAPI.
 * Showdown escribe "Flabébé", "Farfetch'd", "Type: Null", "Nidoran♀" o
 * "Zygarde-10%", y la PokéAPI espera "flabebe", "farfetchd", "type-null",
 * "nidoran-f" y "zygarde-10".
 */
export function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // quita tildes y diéresis
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .trim()
    .toLowerCase()
    .replace(/[’'’´`]/g, '')
    // "As One (Spectrier)" -> "as-one-spectrier"; los paréntesis se pierden.
    .replace(/[:.%,()[\]]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Formas cuyo nombre en Showdown no coincide con el slug de la PokéAPI.
 * Para el resto de casos el importador recorta sufijos progresivamente, así que
 * aquí sólo hacen falta las que no se resuelven recortando.
 */
export const SPECIES_ALIASES: Record<string, string> = {
  'necrozma-dusk-mane': 'necrozma-dusk',
  'necrozma-dawn-wings': 'necrozma-dawn',
  'darmanitan-galar': 'darmanitan-galar-standard',
  'darmanitan-galar-zen': 'darmanitan-galar-zen',
  'indeedee-f': 'indeedee-female',
  'meowstic-f': 'meowstic-female',
  'basculegion-f': 'basculegion-female',
  'oinkologne-f': 'oinkologne-female',
  'maushold-four': 'maushold-family-of-four',
  'maushold-three': 'maushold-family-of-three',
  'squawkabilly-blue': 'squawkabilly-blue-plumage',
  'squawkabilly-yellow': 'squawkabilly-yellow-plumage',
  'squawkabilly-white': 'squawkabilly-white-plumage',
  'ogerpon-wellspring': 'ogerpon-wellspring-mask',
  'ogerpon-hearthflame': 'ogerpon-hearthflame-mask',
  'ogerpon-cornerstone': 'ogerpon-cornerstone-mask',
}

/**
 * Candidatos de slug para una especie, del más específico al más genérico.
 * "necrozma-dusk-mane" -> alias, luego "necrozma-dusk-mane", "necrozma-dusk",
 * "necrozma". Así las formas nuevas que aún no estén en el mapa siguen
 * resolviéndose al Pokémon base en lugar de fallar.
 */
export function speciesCandidates(name: string): string[] {
  const base = slug(name)
  const out: string[] = []
  const push = (v: string) => { if (v && !out.includes(v)) out.push(v) }

  if (SPECIES_ALIASES[base]) push(SPECIES_ALIASES[base])
  push(base)

  const parts = base.split('-')
  for (let i = parts.length - 1; i >= 1; i--) {
    const trimmed = parts.slice(0, i).join('-')
    if (SPECIES_ALIASES[trimmed]) push(SPECIES_ALIASES[trimmed])
    push(trimmed)
  }
  return out
}

/**
 * Empareja la habilidad pegada con la lista real de la especie. Showdown y la
 * PokéAPI difieren en guiones y espacios ("Sand Stream" / "sand-stream"), y
 * algunos equipos traen la habilidad de otra forma del mismo Pokémon; sin este
 * ajuste el desplegable se quedaba en blanco.
 */
export function matchAbility(parsed: string | null, available: string[]): string {
  if (!parsed) return ''
  if (available.length === 0) return parsed
  if (available.includes(parsed)) return parsed

  const flat = (s: string) => s.replace(/-/g, '')
  const target = flat(parsed)

  const exact = available.find((a) => flat(a) === target)
  if (exact) return exact

  const partial = available.find((a) => flat(a).startsWith(target) || target.startsWith(flat(a)))
  if (partial) return partial

  // Habilidades con sufijo de forma: Showdown exporta "As One (Spectrier)" y la
  // PokéAPI la llama "as-one-shadow-rider". Si los primeros segmentos coinciden
  // con una sola habilidad de la especie, es esa.
  const head = parsed.split('-').slice(0, 2).join('-')
  const byPrefix = available.filter((a) => a.startsWith(head + '-') || a === head)
  if (byPrefix.length === 1) return byPrefix[0]

  // Último recurso: si la especie sólo tiene una habilidad posible, no hay
  // ambigüedad y es mejor dejarla puesta que dejar el campo en blanco.
  if (available.length === 1) return available[0]

  return parsed
}


/* ------------------------------ Etiquetas bilingües ----------------------------- */

/**
 * Claves de campo en inglés y en español. Se comparan ya normalizadas (sin
 * tildes y con guiones), así que "Teratipo", "tera type" y "Tipo Teracristal"
 * caen todas en el mismo sitio.
 */
const FIELD_ALIASES: Record<string, string> = {
  ability: 'ability', habilidad: 'ability',
  item: 'item', objeto: 'item',
  level: 'level', nivel: 'level',
  shiny: 'shiny', variocolor: 'shiny', brillante: 'shiny', 'shiny-yes': 'shiny',
  'tera-type': 'tera', teratipo: 'tera', 'tipo-teracristal': 'tera', teracristal: 'tera',
  gender: 'gender', genero: 'gender', sexo: 'gender',
  nature: 'nature', naturaleza: 'nature',
  evs: 'evs', ev: 'evs', 'puntos-de-esfuerzo': 'evs', esfuerzo: 'evs',
  ivs: 'ivs', iv: 'ivs', 'puntos-de-interes': 'ivs', genes: 'ivs',
  happiness: 'ignore', felicidad: 'ignore', amistad: 'ignore', friendship: 'ignore',
  'dynamax-level': 'ignore', 'nivel-dinamax': 'ignore',
  gigantamax: 'ignore', gigamax: 'ignore',
  'hidden-power': 'ignore', 'poder-oculto': 'ignore',
}

/**
 * Nombres de estadística. El orden importa al buscar: las variantes
 * "especial" tienen que probarse antes que "ataque"/"defensa" a secas.
 */
const STAT_ALIASES: [RegExp, StatKey][] = [
  [/^(ps|hp|salud|puntos-de-salud)$/, 'hp'],
  [/^(spa|sp-?a|satk|sp-?atk|sp-?attack|special-?attack|ataque-especial|at-?-?esp|ata-?esp)$/, 'spa'],
  [/^(spd|sp-?d|sdef|sp-?def|sp-?defense|special-?defense|defensa-especial|def-?esp)$/, 'spd'],
  [/^(spe|speed|velocidad|vel)$/, 'spe'],
  [/^(atk|at|attack|ataque)$/, 'atk'],
  [/^(def|defense|defence|defensa)$/, 'def'],
]

function statFromLabel(label: string): StatKey | null {
  const key = slug(label)
  for (const [re, stat] of STAT_ALIASES) if (re.test(key)) return stat
  return null
}

function emptyStats(v: number): Record<StatKey, number> {
  return { hp: v, atk: v, def: v, spa: v, spd: v, spe: v }
}

/**
 * Cabecera opcional que Showdown pone al exportar un equipo con nombre:
 * "=== [gen9vgc2024regh] Mi equipo ===". Si se cuela como un bloque más, ocupa
 * un hueco y el sexto Pokémon se pierde al recortar a seis.
 */
const TEAM_HEADER_RE = /^===\s*(?:\[([^\]]*)\])?\s*(.*?)\s*===$/

export interface ParsedTeam {
  /** Nombre del equipo, si el export traía cabecera. */
  name: string | null
  /** Formato entre corchetes de la cabecera ("gen9vgc2024regh"). */
  format: string | null
  builds: ParsedBuild[]
}

export interface ParseOptions {
  /**
   * Comprueba si un slug es una especie conocida. Sirve para desambiguar una
   * línea suelta: sin esto no se puede saber si "Tapu Bulu" es el quinto
   * movimiento del Pokémon anterior o el principio del siguiente.
   */
  isSpecies?: (slug: string) => boolean
}

/** Qué es cada línea dentro de un bloque. */
type LineKind =
  | { kind: 'header' }
  | { kind: 'field'; field: string; value: string }
  | { kind: 'nature'; value: string }
  | { kind: 'move'; value: string }
  | { kind: 'bare'; value: string }

function classify(line: string): LineKind {
  // Un movimiento con guion es inequívoco.
  if (/^[-–—•*]\s*/.test(line)) {
    return { kind: 'move', value: line.replace(/^[-–—•*]\s*/, '') }
  }

  // La línea de especie es la única que puede llevar " @ objeto".
  if (/\s@\s/.test(line)) return { kind: 'header' }

  const colon = line.indexOf(':')
  if (colon > 0) {
    const rawKey = line.slice(0, colon).trim()
    const field = FIELD_ALIASES[slug(rawKey)]
    if (field) return { kind: 'field', field, value: line.slice(colon + 1).trim() }
  }

  // "Jolly Nature" / "Naturaleza Alegre" (sin dos puntos).
  const natEn = line.match(/^([A-Za-zÀ-ÿ]+)\s+nature$/i)
  if (natEn) return { kind: 'nature', value: natEn[1] }
  const natEs = line.match(/^naturaleza\s+([A-Za-zÀ-ÿ]+)$/i)
  if (natEs) return { kind: 'nature', value: natEs[1] }

  return { kind: 'bare', value: line }
}

/**
 * Parsea un equipo pegado desde Pokémon Showdown.
 *
 * No se puede trocear por líneas en blanco: hay exports con una línea en blanco
 * entre CADA línea, y entonces cada línea sería un Pokémon. En su lugar se
 * ignoran todas las líneas vacías y los bloques se detectan por estructura.
 */
export function parseShowdownTeam(text: string, opts: ParseOptions = {}): ParsedTeam {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let name: string | null = null
  let format: string | null = null
  const blocks: string[][] = []
  let current: string[] = []
  let moveCount = 0

  const push = () => {
    if (current.length) blocks.push(current)
    current = []
    moveCount = 0
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const header = line.match(TEAM_HEADER_RE)
    if (header) {
      format = header[1]?.trim() || null
      name = header[2]?.trim() || null
      continue
    }

    const info = classify(line)

    if (info.kind === 'header') {
      push()
      current.push(line)
      continue
    }

    if (current.length === 0) {
      // Primera línea del primer bloque: es la especie aunque no lleve objeto.
      current.push(line)
      continue
    }

    if (info.kind === 'bare') {
      // Una línea suelta puede ser un movimiento sin guion o el siguiente
      // Pokémon sin objeto. Tres señales, de más a menos fiable:
      //  1. La línea siguiente es un campo ("Ability:", "EVs:"…): entonces ésta
      //     es la cabecera de un Pokémon nuevo. No depende de ningún diccionario.
      //  2. El nombre está en la Pokédex.
      //  3. El bloque ya tiene cuatro movimientos, así que no caben más.
      const next = lines[i + 1]
      const nextKind = next ? classify(next).kind : null
      const startsBlock =
        nextKind === 'field' ||
        nextKind === 'nature' ||
        (opts.isSpecies?.(slug(info.value)) ?? false) ||
        moveCount >= 4

      if (startsBlock) {
        push()
        current.push(line)
        continue
      }
      moveCount++
      current.push(line)
      continue
    }

    if (info.kind === 'move') moveCount++
    current.push(line)
  }
  push()

  const builds: ParsedBuild[] = []
  for (const block of blocks) {
    const parsed = parseBlock(block)
    if (parsed) builds.push(parsed)
  }

  return { name, format, builds }
}

/** Igual que `parseShowdownTeam` pero devolviendo sólo los Pokémon. */
export function parseShowdown(text: string, opts: ParseOptions = {}): ParsedBuild[] {
  return parseShowdownTeam(text, opts).builds
}

function parseBlock(lines: string[]): ParsedBuild | null {
  if (lines.length === 0) return null

  const out: ParsedBuild = {
    pokemon_name: '', nickname: null, gender: 'unknown', item: null, ability: null,
    nature: null, tera_type: null, level: 50, shiny: false, moves: [],
    ivs: emptyStats(31), evs: emptyStats(0),
  }

  // Primera línea: "Mote (Especie) (M) @ Objeto"
  let head = lines[0]
  const atIndex = head.lastIndexOf(' @ ')
  if (atIndex !== -1) {
    out.item = slug(head.slice(atIndex + 3)) || null
    head = head.slice(0, atIndex)
  }
  const genderMatch = head.match(/\s\((M|F|H)\)\s*$/i)
  if (genderMatch) {
    // En los exports en español la hembra sigue siendo (F) y el macho (M),
    // pero algunos traductores ponen (H) de "hembra".
    const g = genderMatch[1].toUpperCase()
    out.gender = g === 'M' ? 'male' : 'female'
    head = head.slice(0, genderMatch.index)
  }
  // La especie es el ÚLTIMO paréntesis: un mote puede llevar paréntesis dentro
  // ("Big (Boy) (Pelipper)"), y con un cuantificador perezoso se partía mal.
  const speciesMatch = head.match(/^(.*\S)\s+\(([^()]+)\)$/)
  if (speciesMatch) {
    out.nickname = speciesMatch[1].trim()
    out.pokemon_name = slug(speciesMatch[2])
  } else {
    out.pokemon_name = slug(head)
  }

  for (const line of lines.slice(1)) {
    const info = classify(line)

    if (info.kind === 'header') continue // no debería pasar: ya se separó antes

    if (info.kind === 'move' || info.kind === 'bare') {
      // "Hidden Power [Fire]" y "Return / Frustration" -> primer movimiento.
      const raw = info.value.split('/')[0].replace(/\[[^\]]*\]/g, '')
      const move = slug(raw)
      if (move && out.moves.length < 4) out.moves.push(move)
      continue
    }

    if (info.kind === 'nature') {
      out.nature = slug(info.value)
      continue
    }

    const { field, value } = info
    switch (field) {
      case 'ability': out.ability = slug(value) || null; break
      case 'item': out.item = slug(value) || out.item; break
      case 'level': out.level = clamp(Math.round(Number(value)) || 50, 1, 100); break
      case 'shiny': out.shiny = /^(yes|s[íi]|true|verdadero)$/i.test(value.trim()); break
      case 'tera': out.tera_type = slug(value) || null; break
      case 'nature': out.nature = slug(value) || null; break
      case 'gender':
        if (/^m/i.test(value)) out.gender = 'male'
        else if (/^[fh]/i.test(value)) out.gender = 'female'
        break
      case 'evs': assignStats(out.evs, value, 0, 252); break
      case 'ivs': assignStats(out.ivs, value, 0, 31); break
      default: break // 'ignore'
    }
  }

  return out.pokemon_name ? out : null
}

/** "252 Ataque Especial / 4 Defensa / 252 Velocidad" */
function assignStats(target: Record<StatKey, number>, value: string, min: number, max: number) {
  for (const part of value.split('/')) {
    // El número va delante; la etiqueta puede ser de varias palabras.
    const m = part.trim().match(/^(\d+)\s+(.+)$/)
    if (!m) continue
    const stat = statFromLabel(m[2])
    if (stat) target[stat] = clamp(Number(m[1]), min, max)
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
