'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { BuildRow } from '@/lib/database.types'

interface Ctx {
  build: BuildRow | null
  teamName: string | null
  select: (build: BuildRow, teamName: string) => void
  clear: () => void
}

const SelectedPokemonContext = createContext<Ctx | null>(null)

export function SelectedPokemonProvider({ children }: { children: React.ReactNode }) {
  const [build, setBuild] = useState<BuildRow | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)

  const value = useMemo<Ctx>(
    () => ({
      build,
      teamName,
      select: (b, t) => {
        setBuild((prev) => (prev?.id === b.id ? null : b))
        setTeamName(t)
      },
      clear: () => setBuild(null),
    }),
    [build, teamName],
  )

  return <SelectedPokemonContext.Provider value={value}>{children}</SelectedPokemonContext.Provider>
}

export function useSelectedPokemon() {
  const ctx = useContext(SelectedPokemonContext)
  if (!ctx) throw new Error('useSelectedPokemon debe usarse dentro de SelectedPokemonProvider')
  return ctx
}
