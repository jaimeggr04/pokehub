'use client'

import { useEffect, useMemo, useState } from 'react'
import { toID } from '@smogon/calc'
import { profileFor, type MonProfile } from '@/lib/battle/advice'
import { loadUsage, type UsageData } from '@/lib/battle/usage'
import type { MonSet } from '@/lib/battle/calc'
import type { BattleState, SideId } from '@/lib/battle/live'
import type { BattleFormat } from '@/lib/battle/formats'

/** Estadísticas de uso del formato, cargadas una vez por sesión. */
export function useUsage(formatId: string | null) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(Boolean(formatId))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!formatId) return
    let alive = true
    setLoading(true)
    setFailed(false)
    loadUsage(formatId).then((data) => {
      if (!alive) return
      setUsage(data)
      setFailed(!data)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [formatId])

  return { usage, loading, failed }
}

/**
 * ¿Qué lado es el tuyo? El que más Pokémon comparte con tu equipo de
 * PokeHub. Sin equipo (o si no encaja con ninguno) devuelve null y la
 * interfaz pregunta.
 */
export function detectMySide(state: BattleState, myTeam: MonSet[] | null): SideId | null {
  if (!myTeam?.length) return null
  const base = (s: string) => toID(s.split('-')[0])
  const mine = new Set(myTeam.map((m) => base(m.species)))
  const score = (side: SideId) => state.sides[side].team.filter((m) => mine.has(base(m.species))).length
  const p1 = score('p1')
  const p2 = score('p2')
  if (Math.max(p1, p2) < 3 || p1 === p2) return null
  return p1 > p2 ? 'p1' : 'p2'
}

/**
 * Perfil (lo visto + lo probable) de cada Pokémon de los dos lados, en el
 * mismo orden que `state.sides[x].team`. Para tu lado, si hay equipo de
 * PokeHub, se usa tu set exacto en lugar de adivinarlo.
 */
export function useBattleProfiles(
  state: BattleState,
  format: BattleFormat,
  usage: UsageData | null,
  mySide: SideId | null,
  myTeam: MonSet[] | null,
): Record<SideId, MonProfile[]> {
  return useMemo(() => {
    const own = (species: string) => {
      const base = toID(species.split('-')[0])
      return myTeam?.find((m) => toID(m.species) === toID(species)) ?? myTeam?.find((m) => toID(m.species.split('-')[0]) === base)
    }
    const build = (side: SideId) =>
      state.sides[side].team.map((mon) => {
        const exact = side === mySide ? own(mon.species) : undefined
        // Una Mega usa el set de su forma base (mismos ataques y reparto), con la especie ya megaevolucionada.
        return profileFor(format, usage, mon.species, mon, exact ? { ...exact, species: mon.species } : undefined)
      })
    return { p1: build('p1'), p2: build('p2') }
  }, [state, format, usage, mySide, myTeam])
}
