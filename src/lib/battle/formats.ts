/*
 * Formatos que entiende el asistente de partida. Cada uno sabe con qué
 * mecánica calcula el daño (@smogon/calc cuenta Pokémon Champions como la
 * "generación 0") y de qué fichero salen sus estadísticas de uso en Smogon.
 */

export type BattleFormat = {
  /** Id de Showdown, tal cual aparece en la URL del combate. */
  id: string
  label: string
  short: string
  gameType: 'doubles' | 'singles'
  /** Generación para @smogon/calc (0 = Pokémon Champions). */
  calcGen: 0 | 9
  /** Nivel al que se juega: Champions y VGC van a 50. */
  level: 50 | 100
  /** Champions reparte "puntos de estadística" (0-32) en vez de EVs (0-252). */
  statPoints: boolean
  tera: boolean
}

export const FORMATS: BattleFormat[] = [
  {
    id: 'gen9championsvgc2026regmb',
    label: 'Champions VGC 2026 · Reg M-B',
    short: 'VGC Champions',
    gameType: 'doubles',
    calcGen: 0,
    level: 50,
    statPoints: true,
    tera: false,
  },
  {
    id: 'gen9championsvgc2026regmbbo3',
    label: 'Champions VGC 2026 · Reg M-B (Bo3)',
    short: 'VGC Champions Bo3',
    gameType: 'doubles',
    calcGen: 0,
    level: 50,
    statPoints: true,
    tera: false,
  },
  {
    id: 'gen9championsbssregmb',
    label: 'Champions Battle Stadium Singles · Reg M-B',
    short: 'BSS Champions',
    gameType: 'singles',
    calcGen: 0,
    level: 50,
    statPoints: true,
    tera: false,
  },
  {
    id: 'gen9doublesou',
    label: 'Doubles OU (Escarlata y Púrpura)',
    short: 'Doubles OU',
    gameType: 'doubles',
    calcGen: 9,
    level: 100,
    statPoints: false,
    tera: true,
  },
  {
    id: 'gen9ou',
    label: 'OU (Escarlata y Púrpura)',
    short: 'OU',
    gameType: 'singles',
    calcGen: 9,
    level: 100,
    statPoints: false,
    tera: true,
  },
]

export const DEFAULT_FORMAT = FORMATS[0]

export function getFormat(id: string | null | undefined): BattleFormat | null {
  if (!id) return null
  return FORMATS.find((f) => f.id === id) ?? null
}

/**
 * Formato de un combate desconocido para la lista: se deduce lo que se pueda
 * del id (Champions, dobles…) para que el asistente funcione igualmente.
 */
export function formatFromId(id: string): BattleFormat {
  const known = getFormat(id)
  if (known) return known
  const champions = id.includes('champions')
  const doubles = /vgc|doubles|2v2/.test(id)
  return {
    id,
    label: id,
    short: id,
    gameType: doubles ? 'doubles' : 'singles',
    calcGen: champions ? 0 : 9,
    level: champions || id.includes('vgc') || id.includes('bss') ? 50 : 100,
    statPoints: champions,
    tera: !champions && id.startsWith('gen9'),
  }
}

/**
 * Saca el id del combate de lo que pegue el usuario: la URL completa
 * (play.pokemonshowdown.com/battle-gen9…-123), la de una repetición o sólo
 * el id. Devuelve null si no hay nada reconocible.
 */
export function parseBattleLink(input: string): { roomId: string; formatId: string } | null {
  const match = input.trim().match(/battle-([a-z0-9]+)-(\d+)(-[a-z0-9]+pw)?/i)
  if (!match) return null
  const [, formatId, num, password = ''] = match
  return { roomId: `battle-${formatId.toLowerCase()}-${num}${password.toLowerCase()}`, formatId: formatId.toLowerCase() }
}
