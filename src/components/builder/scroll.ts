/*
 * Desplazamientos del creador. Los acordeones y las reordenaciones mueven los
 * huecos mientras se anima el scroll, así que el destino se recalcula en cada
 * frame en vez de fijarse al empezar (scrollIntoView acabaría desviado).
 */

const MD_QUERY = '(min-width: 48rem)'

/** Altura que tapa la parte de arriba: cabecera fija y, en md+, la pokéball que sobresale. */
export function topObstruction() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h')
  const header = parseFloat(raw) || 92
  return header + (window.matchMedia(MD_QUERY).matches ? 52 : 14)
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4)
}

/** Si el usuario toca la rueda o la pantalla, el scroll programado se rinde. */
function onUserScroll(cancel: () => void) {
  const opts = { passive: true, once: true } as const
  window.addEventListener('wheel', cancel, opts)
  window.addEventListener('touchstart', cancel, opts)
  window.addEventListener('keydown', cancel, opts)
  return () => {
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
    window.removeEventListener('keydown', cancel)
  }
}

/**
 * Lleva `el` justo debajo de la cabecera siguiéndolo aunque se mueva mientras
 * tanto. Con movimiento reducido salta directamente. Devuelve cómo cancelarlo.
 */
export function scrollToElement(el: HTMLElement, { reduce = false, duration = 620 } = {}) {
  let frame = 0
  let stopListening = () => {}
  const cancel = () => {
    cancelAnimationFrame(frame)
    stopListening()
  }

  const target = () => Math.max(0, el.getBoundingClientRect().top + window.scrollY - topObstruction())

  // Un frame de espera: el acordeón tiene que haber montado su panel para medir.
  frame = requestAnimationFrame(() => {
    if (reduce) {
      window.scrollTo({ top: target(), behavior: 'instant' })
      return
    }
    const from = window.scrollY
    const start = performance.now()
    stopListening = onUserScroll(cancel)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      window.scrollTo({ top: from + (target() - from) * easeOutQuart(t), behavior: 'instant' })
      if (t < 1) frame = requestAnimationFrame(tick)
      else stopListening()
    }
    frame = requestAnimationFrame(tick)
  })

  return cancel
}

/**
 * Mantiene `el` quieto en la pantalla durante `duration` ms compensando con
 * el scroll. Al subir o bajar un hueco, la tarjeta que se ha pulsado se queda
 * bajo el dedo y es la vecina la que da la vuelta alrededor. Hay que llamarlo
 * ANTES de reordenar, para medir la posición de partida.
 */
export function pinElement(el: HTMLElement, duration = 650) {
  const anchor = el.getBoundingClientRect().top
  const start = performance.now()
  let frame = 0
  let stopListening = () => {}
  const cancel = () => {
    cancelAnimationFrame(frame)
    stopListening()
  }
  stopListening = onUserScroll(cancel)

  const tick = (now: number) => {
    const delta = el.getBoundingClientRect().top - anchor
    if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: 'instant' })
    if (now - start < duration && el.isConnected) frame = requestAnimationFrame(tick)
    else stopListening()
  }
  frame = requestAnimationFrame(tick)
  return cancel
}
