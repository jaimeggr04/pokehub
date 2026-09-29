'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useIsDesktop } from '@/lib/hooks'
import type { BuildRow } from '@/lib/database.types'

const loadSheet = () => import('@/components/pokemon-sheet')

// Fuera del paquete inicial: se precarga en un momento ocioso y se monta al primer toque.
const PokemonSheet = dynamic(() => loadSheet().then((m) => m.PokemonSheet), { ssr: false })

interface Ctx {
  build: BuildRow | null
  teamName: string | null
  select: (build: BuildRow, teamName: string) => void
  clear: () => void
}

const SelectedPokemonContext = createContext<Ctx | null>(null)
// Aparte del contexto principal: que un panel se registre no debe re-renderizar las tarjetas.
const PanelRegistryContext = createContext<(() => () => void) | null>(null)

export function SelectedPokemonProvider({ children }: { children: React.ReactNode }) {
  const [build, setBuild] = useState<BuildRow | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [panels, setPanels] = useState(0)
  const [sheetMounted, setSheetMounted] = useState(false)
  const isDesktop = useIsDesktop()

  // La selección vive en el layout y sobreviviría a la navegación: al cambiar
  // de ruta se suelta, o la hoja seguiría abierta encima de otra página.
  const pathname = usePathname()
  const [path, setPath] = useState(pathname)
  if (pathname !== path) {
    setPath(pathname)
    setBuild(null)
  }

  useEffect(() => {
    const preload = () => void loadSheet()
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(preload, 2000)
    return () => window.clearTimeout(id)
  }, [])

  const select = useCallback((b: BuildRow, t: string) => {
    setBuild((prev) => (prev?.id === b.id ? null : b))
    setTeamName(t)
    setSheetMounted(true)
  }, [])

  const clear = useCallback(() => setBuild(null), [])

  const value = useMemo<Ctx>(() => ({ build, teamName, select, clear }), [build, teamName, select, clear])

  const registerPanel = useCallback(() => {
    setPanels((n) => n + 1)
    return () => setPanels((n) => n - 1)
  }, [])

  // En escritorio manda el panel lateral cuando la página lo tiene (portada);
  // donde no lo hay (perfil, búsqueda) la hoja hace su papel.
  const sheetOpen = build !== null && (!isDesktop || panels === 0)

  return (
    <SelectedPokemonContext.Provider value={value}>
      <PanelRegistryContext.Provider value={registerPanel}>
        {children}
        {sheetMounted && <PokemonSheet build={build} teamName={teamName} open={sheetOpen} onClose={clear} />}
      </PanelRegistryContext.Provider>
    </SelectedPokemonContext.Provider>
  )
}

export function useSelectedPokemon() {
  const ctx = useContext(SelectedPokemonContext)
  if (!ctx) throw new Error('useSelectedPokemon debe usarse dentro de SelectedPokemonProvider')
  return ctx
}

/** Para el panel lateral: mientras esté montado, en escritorio no se abre la hoja. */
export function useRegisterPokemonPanel() {
  const register = useContext(PanelRegistryContext)
  useEffect(() => register?.(), [register])
}
