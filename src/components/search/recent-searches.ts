import { useSyncExternalStore } from 'react'
import type { SearchTipo } from '@/lib/search'

/*
 * Búsquedas recientes del cuadro de búsqueda. Viven sólo en este navegador
 * (localStorage): son una comodidad personal, no algo que deba sincronizarse.
 * Importar sólo desde componentes de cliente.
 */

export type RecentSearch = { q: string; tipo: SearchTipo }

const STORAGE_KEY = 'pokehub:busquedas-recientes'
const MAX_RECENTS = 5
const EMPTY: RecentSearch[] = []

let snapshot: RecentSearch[] | null = null
const listeners = new Set<() => void>()

function isRecent(value: unknown): value is RecentSearch {
  if (!value || typeof value !== 'object') return false
  const { q, tipo } = value as Record<string, unknown>
  return typeof q === 'string' && q.trim() !== '' && (tipo === 'entrenadores' || tipo === 'equipos')
}

function read(): RecentSearch[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX_RECENTS) : EMPTY
  } catch {
    return EMPTY
  }
}

function write(list: RecentSearch[]) {
  snapshot = list
  try {
    if (list.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Modo privado o almacenamiento bloqueado: se recuerdan sólo en esta pestaña.
  }
  listeners.forEach((listener) => listener())
}

function getSnapshot(): RecentSearch[] {
  if (snapshot === null) snapshot = read()
  return snapshot
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Otra pestaña ha cambiado la lista: se vuelve a leer.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    snapshot = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Lista vacía en el servidor y al hidratar; la real en cuanto hay navegador. */
export function useRecentSearches(): RecentSearch[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
}

/** La pone la primera. Un mismo texto ocupa un solo hueco, con el último modo usado. */
export function rememberSearch(entry: RecentSearch) {
  const q = entry.q.trim()
  if (!q) return
  const key = q.toLowerCase()
  const current = getSnapshot()
  if (current[0]?.q.toLowerCase() === key && current[0].tipo === entry.tipo) return
  const rest = current.filter((item) => item.q.toLowerCase() !== key)
  write([{ q, tipo: entry.tipo }, ...rest].slice(0, MAX_RECENTS))
}

export function clearRecentSearches() {
  write(EMPTY)
}
