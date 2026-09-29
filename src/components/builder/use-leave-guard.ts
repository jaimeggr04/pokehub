'use client'

import { useEffect, useRef } from 'react'

/**
 * Protege un formulario con cambios sin guardar mientras `active` sea cierto.
 *
 * - Recargar, cerrar la pestaña o salir a otra web: el aviso nativo del
 *   navegador (beforeunload), que es lo único que se puede hacer ahí.
 * - Enlaces internos: con el App Router la navegación no descarga la página,
 *   así que beforeunload no salta. Se intercepta el clic en fase de captura
 *   (antes que el onClick de <Link>) y se pregunta con `onAttempt(href)`.
 */
export function useLeaveGuard(active: boolean, onAttempt: (href: string) => void) {
  const attemptRef = useRef(onAttempt)
  useEffect(() => {
    attemptRef.current = onAttempt
  })

  useEffect(() => {
    if (!active) return

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Chrome antiguo y Safari sólo muestran el aviso con returnValue.
      e.returnValue = ''
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement)) return
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      // Otra web: de eso ya se encarga beforeunload.
      if (url.origin !== window.location.origin) return
      // Anclas de la misma página (saltar al contenido…) no se van a ningún sitio.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      e.preventDefault()
      e.stopPropagation()
      attemptRef.current(url.pathname + url.search + url.hash)
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])
}
