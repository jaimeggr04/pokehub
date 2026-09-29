import { BattleTracker, type BattleState } from '@/lib/battle/live'

/*
 * Repeticiones de Showdown (replay.pokemonshowdown.com): sirven para repasar
 * una partida ya jugada con el asistente y como "partida de ejemplo" para
 * probarlo sin estar jugando. El servidor de repeticiones permite pedirlas
 * directamente desde el navegador.
 */

export type Replay = {
  id: string
  formatId: string
  players: string[]
  uploadtime: number
  log: string
}

/** "https://replay.pokemonshowdown.com/gen9…-2689618698" (o sólo el id) -> id. */
export function parseReplayLink(input: string): string | null {
  const trimmed = input.trim()
  if (!/replay\.pokemonshowdown\.com|^[a-z0-9]+-\d+(-[a-z0-9]+pw)?$/i.test(trimmed)) return null
  const match = trimmed.match(/([a-z0-9]+-\d+(?:-[a-z0-9]+pw)?)(?:\.json|\.log)?(?:[?#].*)?$/i)
  return match ? match[1].toLowerCase() : null
}

export async function fetchReplay(id: string): Promise<Replay | null> {
  try {
    const res = await fetch(`https://replay.pokemonshowdown.com/${encodeURIComponent(id)}.json`)
    if (!res.ok) return null
    const data = (await res.json()) as { id: string; formatid: string; players: string[]; uploadtime: number; log: string }
    return { id: data.id, formatId: data.formatid, players: data.players, uploadtime: data.uploadtime, log: data.log }
  } catch {
    return null
  }
}

/**
 * El estado de la partida al empezar cada turno (índice 0 = vista previa),
 * para poder avanzar y retroceder por la repetición.
 */
export function replaySnapshots(roomId: string, log: string): BattleState[] {
  const tracker = new BattleTracker(roomId)
  const snapshots: BattleState[] = []
  for (const line of log.split('\n')) {
    if (line.startsWith('|turn|') || line.startsWith('|start')) snapshots.push(structuredClone(tracker.state))
    tracker.line(line)
  }
  snapshots.push(structuredClone(tracker.state))
  // La primera instantánea útil es la vista previa, aunque el log empiece antes.
  return snapshots.filter((s, i) => i === snapshots.length - 1 || s.sides.p1.team.length > 0)
}
