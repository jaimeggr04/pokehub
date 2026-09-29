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

export { parseReplayLink } from '@/lib/battle/formats'

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
    if (line.startsWith('|turn|')) {
      // El estado al decidir el turno N ya dice N, como en directo (Fake Out y
      // las cuentas atrás dependen de ello).
      const snap = structuredClone(tracker.state)
      snap.turn = Number(line.split('|')[2]) || snap.turn + 1
      snap.phase = 'battle'
      snapshots.push(snap)
    } else if (line.startsWith('|start')) {
      snapshots.push(structuredClone(tracker.state))
    }
    tracker.line(line)
  }
  snapshots.push(structuredClone(tracker.state))
  // La primera instantánea útil es la vista previa, aunque el log empiece antes.
  return snapshots.filter((s, i) => i === snapshots.length - 1 || s.sides.p1.team.length > 0)
}
