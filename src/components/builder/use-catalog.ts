'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog } from '@/components/builder/slot-editor'
import type { PickerOption } from '@/components/entity-picker'
import { listItems, listPokemon } from '@/lib/pokeapi'
import { itemSpriteUrl, prettify, spriteUrl } from '@/lib/pokemon'

type Entry = { id: number; name: string }
type Status = 'loading' | 'ready' | 'error'

/**
 * Pokédex y objetos completos para los selectores. Se piden una vez al abrir
 * el creador (lib/pokeapi los cachea) y se pueden reintentar si fallan.
 */
export function useCatalog() {
  const [dex, setDex] = useState<Entry[]>([])
  const [items, setItems] = useState<Entry[]>([])
  const [dexStatus, setDexStatus] = useState<Status>('loading')
  const [itemsStatus, setItemsStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    listPokemon().then(
      (list) => {
        if (!alive) return
        setDex(list)
        setDexStatus('ready')
      },
      () => alive && setDexStatus('error'),
    )
    listItems().then(
      (list) => {
        if (!alive) return
        setItems(list)
        setItemsStatus('ready')
      },
      () => alive && setItemsStatus('error'),
    )
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setDexStatus((s) => (s === 'error' ? 'loading' : s))
    setItemsStatus((s) => (s === 'error' ? 'loading' : s))
    setAttempt((n) => n + 1)
  }, [])

  // Las listas completas (~1300 Pokémon, ~2100 objetos) sólo se transforman una
  // vez; el picker ya se encarga de filtrar y paginar sobre el resultado.
  const dexOptions = useMemo<PickerOption[]>(
    () =>
      dex.map((d) => ({
        value: d.name,
        label: prettify(d.name),
        icon: spriteUrl(d.id),
        hint: d.id <= 10000 ? `#${String(d.id).padStart(4, '0')}` : undefined,
      })),
    [dex],
  )

  const itemOptions = useMemo<PickerOption[]>(
    () => items.map((i) => ({ value: i.name, label: prettify(i.name), icon: itemSpriteUrl(i.name) })),
    [items],
  )

  const catalog = useMemo<Catalog>(
    () => ({
      dexOptions,
      itemOptions,
      dexLoading: dexStatus === 'loading',
      itemsLoading: itemsStatus === 'loading',
      dexFailed: dexStatus === 'error',
      itemsFailed: itemsStatus === 'error',
    }),
    [dexOptions, itemOptions, dexStatus, itemsStatus],
  )

  const dexByName = useMemo(() => new Map(dex.map((d) => [d.name, d.id])), [dex])
  const itemNames = useMemo(() => items.map((i) => i.name), [items])

  return { dex, catalog, dexByName, itemNames, failed: dexStatus === 'error' || itemsStatus === 'error', retry }
}
