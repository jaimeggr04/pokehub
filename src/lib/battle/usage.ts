/*
 * Estadísticas de uso de Smogon condensadas: para cada Pokémon, qué
 * movimientos, objetos, habilidades, repartos y compañeros lleva la gente y
 * con qué frecuencia. Es la base para adivinar el set del rival.
 */

/** [nombre, porcentaje 0-100] ordenado de más a menos frecuente. */
export type Share = [string, number]

export type UsageEntry = {
  name: string
  /** Porcentaje de equipos que lo llevan (0-100). */
  usage: number
  moves: Share[]
  items: Share[]
  abilities: Share[]
  /** "Adamant:32/32/0/0/1/1" (naturaleza:HP/Atk/Def/SpA/SpD/Spe). */
  spreads: Share[]
  tera: Share[]
  teammates: Share[]
}

export type UsageData = {
  format: string
  /** Mes de los datos, "2026-08". */
  month: string
  battles: number
  cutoff: number
  /** Por id de especie de Showdown. */
  species: Record<string, UsageEntry>
}

export type Spread = {
  nature: string
  invest: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
}

export function parseSpread(spread: string): Spread | null {
  const [nature, values] = spread.split(':')
  const n = values?.split('/').map(Number)
  if (!nature || !n || n.length !== 6 || n.some(Number.isNaN)) return null
  return { nature, invest: { hp: n[0], atk: n[1], def: n[2], spa: n[3], spd: n[4], spe: n[5] } }
}

// Caché por formato en el navegador: una partida pide las mismas estadísticas
// muchas veces y no cambian hasta el mes siguiente.
const clientCache = new Map<string, Promise<UsageData | null>>()

export function loadUsage(formatId: string): Promise<UsageData | null> {
  let pending = clientCache.get(formatId)
  if (!pending) {
    pending = fetch(`/api/usage/${encodeURIComponent(formatId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<UsageData>) : null))
      .catch(() => null)
    clientCache.set(formatId, pending)
    // Si falla, que el próximo intento vuelva a pedirlo.
    void pending.then((data) => {
      if (!data) clientCache.delete(formatId)
    })
  }
  return pending
}
