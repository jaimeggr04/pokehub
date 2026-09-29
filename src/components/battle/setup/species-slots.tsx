'use client'

import { useCallback, useMemo } from 'react'
import { EntityPicker, type PickerOption } from '@/components/entity-picker'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { allSpecies, genFor, toID } from '@/lib/battle/dex'
import type { BattleFormat } from '@/lib/battle/formats'
import type { UsageData } from '@/lib/battle/usage'

export const TEAM_SIZE = 6

/** Seis huecos vacíos. */
export function emptySlots(): string[] {
  return Array.from({ length: TEAM_SIZE }, () => '')
}

/** Rellena o recorta a seis huecos. */
export function toSlots(species: string[]): string[] {
  return [...species, ...emptySlots()].slice(0, TEAM_SIZE)
}

/**
 * Las ~360 especies del formato, de más a menos usadas (las que no salen en
 * las estadísticas, después y por orden alfabético). El valor es el id de
 * Showdown: así el buscador del selector encuentra "charizardmegay" y
 * "Charizard-Mega-Y" por igual.
 */
export function useSpeciesOptions(format: BattleFormat, usage: UsageData | null) {
  return useMemo(() => {
    const names = allSpecies(genFor(format))
    const share = (name: string) => usage?.species[toID(name)]?.usage ?? -1
    const sorted = usage ? [...names].sort((a, b) => share(b) - share(a) || a.localeCompare(b)) : names
    const byId = new Map<string, string>()
    const options: PickerOption[] = sorted.map((name) => {
      const id = toID(name)
      byId.set(id, name)
      const pct = share(name)
      return {
        value: id,
        label: name,
        iconNode: <ShowdownSprite species={name} size={32} className="shrink-0" />,
        hint: pct >= 0 ? `${pct < 10 ? pct.toFixed(1) : Math.round(pct)} %` : undefined,
      }
    })
    return { options, byId }
  }, [format, usage])
}

/**
 * Seis selectores de especie para un lado. Cada hueco ofrece sólo lo que no
 * está ya en otro (la cláusula de especie no deja repetir).
 */
export function SpeciesSlots({
  side,
  value,
  onChange,
  options,
  byId,
  loading,
}: {
  side: 'mine' | 'theirs'
  value: string[]
  onChange: (next: string[]) => void
  options: PickerOption[]
  byId: Map<string, string>
  loading: boolean
}) {
  const unknownOption = useCallback(
    (id: string): PickerOption => {
      const name = byId.get(id) ?? id
      return { value: id, label: name, iconNode: <ShowdownSprite species={name} size={32} className="shrink-0" /> }
    },
    [byId],
  )

  return (
    <div className="battle-s-slots">
      {value.map((species, i) => {
        const taken = new Set<string>(value.filter((s, j) => s && j !== i).map((s) => toID(s)))
        const slotOptions = taken.size ? options.filter((o) => !taken.has(o.value)) : options
        return (
          <EntityPicker
            key={i}
            label={`${side === 'mine' ? 'Tu Pokémon' : 'Rival'} ${i + 1}`}
            value={species ? toID(species) : ''}
            options={slotOptions}
            onSelect={(id) => {
              const next = [...value]
              next[i] = id ? (byId.get(id) ?? id) : ''
              onChange(next)
            }}
            placeholder="Busca un Pokémon…"
            emptyText="Ningún Pokémon coincide"
            loading={loading && options.length === 0}
            pixelated
            unknownOption={unknownOption}
          />
        )
      })}
    </div>
  )
}
