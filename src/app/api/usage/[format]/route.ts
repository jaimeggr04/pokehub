import { NextResponse } from 'next/server'
import { Generations, toID } from '@smogon/calc'
import { formatFromId } from '@/lib/battle/formats'
import type { Share, UsageData, UsageEntry } from '@/lib/battle/usage'

/*
 * Estadísticas de uso de Smogon (fichero "chaos" del último mes publicado),
 * condensadas a lo que usa el asistente. El original pesa varios MB; esto se
 * queda en unos cientos de KB y lo guarda la CDN un día entero.
 */

const STATS = 'https://www.smogon.com/stats'
// Del más exigente al más abierto: con 1760 se ve lo que juega la gente buena,
// pero hay formatos que sólo publican otros cortes.
const CUTOFFS = [1760, 1695, 1630, 1500, 0]

type Chaos = {
  info: { metagame: string; cutoff: number; 'number of battles': number }
  data: Record<
    string,
    {
      usage: number
      Abilities: Record<string, number>
      Items: Record<string, number>
      Moves: Record<string, number>
      Spreads: Record<string, number>
      'Tera Types'?: Record<string, number>
      Teammates: Record<string, number>
    }
  >
}

// Mientras la función siga viva, no se vuelve a descargar.
const memory = new Map<string, { at: number; data: UsageData }>()
const TTL = 6 * 60 * 60 * 1000

async function text(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  return res.ok ? res.text() : null
}

/** Meses publicados, del más reciente al más antiguo ("2026-08"). */
async function months(): Promise<string[]> {
  const index = await text(`${STATS}/`)
  if (!index) return []
  return [...new Set([...index.matchAll(/href="(\d{4}-\d{2})\/"/g)].map((m) => m[1]))].sort().reverse()
}

async function locate(format: string): Promise<{ month: string; url: string } | null> {
  for (const month of (await months()).slice(0, 3)) {
    const listing = await text(`${STATS}/${month}/chaos/`)
    if (!listing) continue
    const available = new Set(
      [...listing.matchAll(new RegExp(`href="${format}-(\\d+)\\.json"`, 'g'))].map((m) => Number(m[1])),
    )
    const cutoff = CUTOFFS.find((c) => available.has(c)) ?? [...available].sort((a, b) => b - a)[0]
    if (cutoff !== undefined) return { month, url: `${STATS}/${month}/chaos/${format}-${cutoff}.json` }
  }
  return null
}

function shares(record: Record<string, number> | undefined, total: number, limit: number, name?: (id: string) => string): Share[] {
  if (!record || total <= 0) return []
  return Object.entries(record)
    .filter(([key]) => key !== '' && key !== 'nothing')
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => [name ? name(key) : key, Math.round((value / total) * 1000) / 10] as Share)
    .filter(([, pct]) => pct >= 0.5)
}

function condense(chaos: Chaos, format: string, month: string): UsageData {
  const gen = Generations.get(formatFromId(format).calcGen)
  const moveName = (id: string) => gen.moves.get(toID(id))?.name ?? id
  const itemName = (id: string) => gen.items.get(toID(id))?.name ?? id
  const abilityName = (id: string) => gen.abilities.get(toID(id))?.name ?? id

  const species: Record<string, UsageEntry> = {}
  for (const [name, entry] of Object.entries(chaos.data)) {
    // Peso total de la especie: la suma de habilidades cuenta cada set una vez.
    const total = Object.values(entry.Abilities).reduce((a, b) => a + b, 0)
    if (total <= 0 || entry.usage < 0.001) continue
    species[toID(name)] = {
      name,
      usage: Math.round(entry.usage * 1000) / 10,
      moves: shares(entry.Moves, total, 10, moveName),
      items: shares(entry.Items, total, 6, itemName),
      abilities: shares(entry.Abilities, total, 3, abilityName),
      spreads: shares(entry.Spreads, total, 5),
      tera: shares(entry['Tera Types'], total, 4, (t) => t.charAt(0).toUpperCase() + t.slice(1)),
      teammates: shares(entry.Teammates, total, 8),
    }
  }

  return {
    format,
    month,
    battles: chaos.info['number of battles'],
    cutoff: chaos.info.cutoff,
    species,
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  // Sólo ids de formato: nada que pueda cambiar la URL de Smogon.
  if (!/^[a-z0-9]{3,60}$/.test(format)) {
    return NextResponse.json({ error: 'Formato no válido' }, { status: 400 })
  }

  const cached = memory.get(format)
  let data = cached && Date.now() - cached.at < TTL ? cached.data : null

  if (!data) {
    const source = await locate(format).catch(() => null)
    if (!source) return NextResponse.json({ error: 'Sin estadísticas para este formato' }, { status: 404 })
    const res = await fetch(source.url, { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return NextResponse.json({ error: 'Smogon no responde' }, { status: 502 })
    data = condense((await res.json()) as Chaos, format, source.month)
    memory.set(format, { at: Date.now(), data })
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
