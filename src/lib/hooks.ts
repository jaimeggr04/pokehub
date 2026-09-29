import { useCallback, useEffect, useSyncExternalStore } from 'react'

// Hooks de cliente compartidos. Importar sólo desde componentes 'use client'.

const noopSubscribe = () => () => {}

/**
 * `false` en el servidor y durante la hidratación, `true` después. Con
 * useSyncExternalStore, un componente que se monta ya en el cliente (tras una
 * navegación) obtiene `true` en su primer render y no pinta dos veces.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

/** Suscripción a una media query. Devuelve `false` hasta que hay `window`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** A partir de `lg` (1024 px): donde la app pasa a varias columnas. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

// Contador a nivel de módulo: una hoja abierta sobre un menú abierto no debe
// devolver el scroll al cerrarse la primera.
let lockCount = 0
let saved: { overflow: string; paddingRight: string } | null = null

/**
 * Bloquea el scroll del documento mientras `locked` sea cierto. Compensa el
 * ancho de la barra de scroll con padding para que el contenido no salte.
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    const body = document.body

    if (lockCount === 0) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
      if (scrollbar > 0) {
        const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0
        body.style.paddingRight = `${current + scrollbar}px`
      }
      body.style.overflow = 'hidden'
    }
    lockCount += 1

    return () => {
      lockCount -= 1
      if (lockCount === 0 && saved) {
        body.style.overflow = saved.overflow
        body.style.paddingRight = saved.paddingRight
        saved = null
      }
    }
  }, [locked])
}
