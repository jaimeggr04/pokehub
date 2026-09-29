'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useMounted } from '@/lib/hooks'

/*
 * Pequeños recuerdos del asistente en el navegador: qué lado eres en cada
 * sala y qué explicaciones de jerga ya has visto. Se leen con
 * useSyncExternalStore para no pintar dos veces al hidratar y para que una
 * pestaña se entere de lo que cambia otra.
 */

const EVENT = 'pokehub:battle-storage'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Navegación privada estricta o almacenamiento bloqueado: se trabaja sin recordar.
    return null
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento sólo se pierde el recuerdo; la interfaz sigue funcionando.
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

export function useStored(key: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null,
  )
}

/* ------------------------------------------------------------------ */
/* Explicaciones de jerga que se enseñan sólo la primera vez           */
/* ------------------------------------------------------------------ */

const HINTS_KEY = 'pokehub:battle:hints-seen'

// Las que ya se han enseñado en esta visita siguen visibles hasta recargar:
// si desaparecieran al marcarlas como vistas, no daría tiempo a leerlas.
const shownThisVisit = new Set<string>()

/**
 * De `keys`, las explicaciones que hay que enseñar ahora. Al mostrarse se
 * dan por vistas (para la próxima partida), y `dismiss` las quita ya.
 */
export function useFirstTimeHints(keys: string[]) {
  const mounted = useMounted()
  const raw = useStored(HINTS_KEY)
  const seen = new Set<string>(raw ? raw.split(',') : [])
  // Hasta montar no se sabe qué has visto: mejor no enseñar nada que enseñarlo y quitarlo.
  const visible = mounted ? keys.filter((k) => !seen.has(k) || shownThisVisit.has(k)) : []
  const pendingKey = mounted ? keys.filter((k) => !seen.has(k)).join(',') : ''

  useEffect(() => {
    if (!pendingKey) return
    for (const k of pendingKey.split(',')) shownThisVisit.add(k)
    const current = new Set((read(HINTS_KEY) ?? '').split(',').filter(Boolean))
    for (const k of pendingKey.split(',')) current.add(k)
    writeStored(HINTS_KEY, [...current].join(','))
  }, [pendingKey])

  const dismiss = (key: string) => {
    shownThisVisit.delete(key)
    // Vuelve a escribir para que los componentes se repinten sin ella.
    writeStored(HINTS_KEY, read(HINTS_KEY) ?? key)
  }

  return { visible, dismiss }
}
