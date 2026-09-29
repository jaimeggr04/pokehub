import { formatFromId, parseBattleLink, parseReplayLink, type BattleFormat } from '@/lib/battle/formats'

/*
 * Lógica pura de la portada del asistente: qué ha pegado el usuario y
 * adónde lleva. Sin React, para poder probarla con un script.
 */

/** Repetición real que abre «Probar con una partida de ejemplo». */
export const EXAMPLE_REPLAY_ID = 'gen9championsvgc2026regmb-2689618698'

/** Enlaces de muestra para el mensaje de error (válidos, con otro número). */
export const LINK_EXAMPLES = [
  'https://play.pokemonshowdown.com/battle-gen9championsvgc2026regmc-2690000000',
  'https://replay.pokemonshowdown.com/gen9championsvgc2026regmb-2689618698',
]


export type DetectedLink =
  | { kind: 'live'; roomId: string; format: BattleFormat; known: boolean }
  | { kind: 'replay'; replayId: string; format: BattleFormat; known: boolean }

/**
 * Combate en directo o repetición. La repetición va primero si la URL es del
 * servidor de repeticiones: así nunca se confunde con una sala en directo.
 */
export function detectLink(input: string): DetectedLink | null {
  const text = input.trim()
  if (!text) return null
  const isReplayHost = /replay\.pokemonshowdown\.com/i.test(text)
  if (!isReplayHost) {
    const live = parseBattleLink(text)
    if (live) {
      const format = formatFromId(live.formatId)
      return { kind: 'live', roomId: live.roomId, format, known: format.label !== live.formatId }
    }
  }
  const replayId = parseReplayLink(text)
  if (replayId) {
    const formatId = replayId.replace(/-\d+(?:-[a-z0-9]+pw)?$/, '')
    const format = formatFromId(formatId)
    return { kind: 'replay', replayId, format, known: format.label !== formatId }
  }
  return null
}

function withTeam(path: string, teamId: string | null | undefined): string {
  if (!teamId) return path
  return `${path}${path.includes('?') ? '&' : '?'}team=${encodeURIComponent(teamId)}`
}

/** Ruta del asistente para lo detectado, con el equipo elegido si lo hay. */
export function battleHref(link: DetectedLink, teamId?: string | null): string {
  if (link.kind === 'live') return withTeam(`/battle/live?room=${encodeURIComponent(link.roomId)}`, teamId)
  return withTeam(`/battle/replay/${encodeURIComponent(link.replayId)}`, teamId)
}

export function exampleHref(): string {
  return `/battle/replay/${EXAMPLE_REPLAY_ID}`
}

export function manualHref(formatId: string, teamId?: string | null): string {
  return withTeam(`/battle/manual?format=${encodeURIComponent(formatId)}`, teamId)
}

/** Lo justo de un equipo para pintarlo en el selector (sin los sets completos). */
export type TeamOption = {
  id: string
  name: string
  format: string
  /** Especies con nombre de Showdown, para los sprites. */
  species: string[]
}

/** Clave de localStorage con el último equipo elegido. */
export const LAST_TEAM_KEY = 'pokehub-battle-team'
