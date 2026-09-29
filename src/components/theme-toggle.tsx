'use client'

import { useId, useRef, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { useMounted } from '@/lib/hooks'

const STORAGE_KEY = 'pokehub-theme'
const THEME_EVENT = 'pokehub:theme'

export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * Script inline: evita el parpadeo de tema antes de hidratar. Se ejecuta en
 * <head>, así que no puede depender de nada del bundle de React.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var dark = stored === 'dark' || (stored !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return 'system'
}

function resolvesDark(pref: ThemePreference) {
  return pref === 'dark' || (pref === 'system' && systemPrefersDark())
}

function applyPreference(pref: ThemePreference) {
  document.documentElement.classList.toggle('dark', resolvesDark(pref))
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {}
  // Permite que varios controles de tema en la misma página se sincronicen.
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: pref }))
}

// Preferencia guardada como almacén externo: cambios de esta pestaña (evento
// propio), de otras pestañas (storage) y del sistema cuando está en "sistema".
function subscribePreference(onChange: () => void) {
  const root = document.documentElement
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => {
    if (readPreference() === 'system') root.classList.toggle('dark', media.matches)
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    root.classList.toggle('dark', resolvesDark(readPreference()))
    onChange()
  }
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  media.addEventListener('change', onSystem)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    media.removeEventListener('change', onSystem)
  }
}

function usePreference(): ThemePreference {
  return useSyncExternalStore(subscribePreference, readPreference, () => 'system')
}

function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/**
 * Si el tema que se ve es el oscuro. Sigue la clase real de <html>, que en
 * "sistema" decide el SO y no la preferencia guardada. `false` al hidratar.
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeDark,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

export type RevealOrigin = { x: number; y: number }

/** Centro de un elemento en coordenadas de viewport: el origen del revelado. */
export function revealOriginOf(el: Element): RevealOrigin {
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

let switchToken = 0

/**
 * Cambia el tema. Con `origin`, el nuevo se revela en un círculo que crece
 * desde ese punto (View Transitions). Sin soporte, con movimiento reducido o
 * si el tema visible no cambia, se aplica al instante.
 */
export function switchTheme(pref: ThemePreference, origin?: RevealOrigin) {
  const root = document.documentElement
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (
    !origin ||
    reduce ||
    typeof document.startViewTransition !== 'function' ||
    resolvesDark(pref) === root.classList.contains('dark')
  ) {
    applyPreference(pref)
    return
  }

  // Radio hasta la esquina más lejana: el círculo acaba cubriendo toda la pantalla.
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  )
  root.style.setProperty('--vt-x', `${Math.round(origin.x)}px`)
  root.style.setProperty('--vt-y', `${Math.round(origin.y)}px`)
  root.style.setProperty('--vt-r', `${Math.ceil(radius)}px`)
  root.setAttribute('data-theme-switching', '')

  // Si se encadenan dos cambios, sólo el último limpia al terminar.
  const token = ++switchToken
  const cleanup = () => {
    if (token === switchToken) root.removeAttribute('data-theme-switching')
  }
  const transition = document.startViewTransition(() => applyPreference(pref))
  transition.finished.then(cleanup, cleanup)
}

/**
 * Interruptor compacto de la cabecera: alterna claro/oscuro de forma explícita.
 * La posición del pomo y el icono salen de CSS (clase .dark), así se pintan
 * bien desde el primer frame sin esperar a hidratar.
 */
export function ThemeToggle() {
  const dark = useIsDark()
  const mounted = useMounted()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mounted ? dark : undefined}
      aria-label="Tema oscuro (Master Ball)"
      title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      data-theme-toggle=""
      onClick={(e) => switchTheme(dark ? 'light' : 'dark', revealOriginOf(e.currentTarget))}
      className="shell-theme-toggle relative h-9 w-16 shrink-0 rounded-full border-2 border-black/25 bg-white/25 backdrop-blur transition-colors hover:bg-white/35"
    >
      {/* Estrellas del modo noche: sólo asoman con el pomo a la derecha. */}
      <span aria-hidden className="shell-theme-star left-[9px] top-[8px] h-[3px] w-[3px]" />
      <span aria-hidden className="shell-theme-star left-[17px] top-[17px] h-[2px] w-[2px] [transition-delay:60ms]" />
      <span aria-hidden className="shell-theme-knob">
        <Sun size={15} strokeWidth={2.4} className="shell-theme-sun" />
        <Moon size={14} strokeWidth={2.4} className="shell-theme-moon" />
      </span>
    </button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Claro', hint: 'Pokéball', icon: Sun },
  { value: 'dark', label: 'Oscuro', hint: 'Master Ball', icon: Moon },
  { value: 'system', label: 'Sistema', hint: 'Automático', icon: Monitor },
]

/** Selector de tres estados para Configuración y el menú móvil. */
export function ThemeSelector() {
  const pref = usePreference()
  const mounted = useMounted()
  // Único por instancia: el menú móvil y Configuración no comparten la píldora.
  const pillId = `theme-pill-${useId()}`
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const selectedIndex = mounted ? OPTIONS.findIndex((o) => o.value === pref) : -1

  function choose(index: number) {
    const option = OPTIONS[index]
    const button = refs.current[index]
    button?.focus()
    switchTheme(option.value, button ? revealOriginOf(button) : undefined)
  }

  // Patrón radiogroup: las flechas mueven y seleccionan; el Tab entra y sale del grupo.
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const backward = e.key === 'ArrowLeft' || e.key === 'ArrowUp'
    if (!forward && !backward) return
    const step = forward ? 1 : -1
    e.preventDefault()
    choose((index + step + OPTIONS.length) % OPTIONS.length)
  }

  return (
    // Tres columnas siempre: en el panel lateral del móvil, apiladas ocupaban
    // tanto que empujaban el botón de cerrar sesión fuera de la pantalla.
    <div role="radiogroup" aria-label="Tema de la interfaz" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, hint, icon: Icon }, index) => {
        const active = index === selectedIndex
        return (
          <button
            key={value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => choose(index)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={clsx(
              'pressable relative flex flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 px-2 py-3 text-xs font-semibold sm:px-3 sm:py-4 sm:text-sm',
              active ? 'border-transparent text-brand' : 'border-line text-muted hover:border-brand/50 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                aria-hidden
                className="absolute -inset-0.5 rounded-xl border-2 border-brand bg-brand-soft"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <Icon aria-hidden size={20} className={clsx('relative', active && 'animate-pop')} />
            <span className="relative">{label}</span>
            <span className="relative text-[10px] font-normal leading-tight opacity-80">{hint}</span>
          </button>
        )
      })}
    </div>
  )
}
