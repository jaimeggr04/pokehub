'use client'

import { useState } from 'react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PokemonDetails } from '@/components/pokemon-details'
import { prettify } from '@/lib/pokemon'
import type { BuildRow } from '@/lib/database.types'

/**
 * Detalle del Pokémon en una hoja inferior: lo que en escritorio hace el panel
 * lateral de la portada. Recuerda el último Pokémon mostrado para que, al
 * cerrarse (build pasa a null), la hoja salga animada con su contenido y no vacía.
 */
export function PokemonSheet({
  build,
  teamName,
  open,
  onClose,
}: {
  build: BuildRow | null
  teamName: string | null
  open: boolean
  onClose: () => void
}) {
  const [shown, setShown] = useState<{ build: BuildRow; teamName: string | null } | null>(
    build ? { build, teamName } : null,
  )
  if (build && build !== shown?.build) setShown({ build, teamName })

  const name = shown ? shown.build.nickname || prettify(shown.build.pokemon_name) : 'Pokémon'

  return (
    <BottomSheet open={open && shown !== null} onClose={onClose} title={`Detalle de ${name}`} className="lg:max-w-xl">
      {shown && <PokemonDetails key={shown.build.id} build={shown.build} teamName={shown.teamName} onClose={onClose} />}
    </BottomSheet>
  )
}
