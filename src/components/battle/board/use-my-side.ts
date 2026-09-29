'use client'

import { useCallback, useMemo } from 'react'
import type { BuildRow } from '@/lib/database.types'
import { setFromBuild, type MonSet } from '@/lib/battle/calc'
import type { BattleFormat } from '@/lib/battle/formats'
import type { BattleState, SideId } from '@/lib/battle/live'
import { detectMySide } from '@/lib/battle/use-battle-profiles'
import { useStored, writeStored } from '@/components/battle/board/storage'

/** Tus builds de PokeHub como sets de la calculadora (los que no se reconocen se descartan). */
export function useMyTeam(format: BattleFormat, builds: BuildRow[] | null): MonSet[] | null {
  return useMemo(() => {
    if (!builds?.length) return null
    const sets = builds.map((b) => setFromBuild(format, b)).filter((s): s is MonSet => s !== null)
    return sets.length ? sets : null
  }, [format, builds])
}

/**
 * Qué lado eres: lo que elegiste a mano en esta sala (se recuerda por si
 * recargas a mitad de partida) o, si no, el que encaja con tu equipo.
 */
export function useMySide(roomId: string, state: BattleState, myTeam: MonSet[] | null) {
  const key = `pokehub:battle-side:${roomId}`
  const stored = useStored(key)
  const chosen: SideId | null = stored === 'p1' || stored === 'p2' ? stored : null
  const mySide = chosen ?? detectMySide(state, myTeam)
  const choose = useCallback((side: SideId) => writeStored(key, side), [key])
  return { mySide, choose }
}
