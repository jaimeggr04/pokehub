'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'pokehub-theme'

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

function applyPreference(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {}
  // Permite que varios controles de tema en la misma página se sincronicen.
  window.dispatchEvent(new CustomEvent('pokehub:theme', { detail: pref }))
}

/** Suscripción compartida por el interruptor de la cabecera y el de ajustes. */
function useThemePreference(): [ThemePreference, (p: ThemePreference) => void, boolean] {
  const [pref, setPref] = useState<ThemePreference>('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPref(readPreference())
    setReady(true)

    const onExternal = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail)
    window.addEventListener('pokehub:theme', onExternal)

    // Con la preferencia en "sistema" hay que seguir los cambios del SO en vivo.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      if (readPreference() === 'system') {
        document.documentElement.classList.toggle('dark', media.matches)
      }
    }
    media.addEventListener('change', onSystem)

    return () => {
      window.removeEventListener('pokehub:theme', onExternal)
      media.removeEventListener('change', onSystem)
    }
  }, [])

  function update(next: ThemePreference) {
    setPref(next)
    applyPreference(next)
  }

  return [pref, update, ready]
}

/** Interruptor compacto de la cabecera: alterna claro/oscuro de forma explícita. */
export function ThemeToggle() {
  const [pref, setPref, ready] = useThemePreference()
  const [dark, setDark] = useState(false)

  // El estado visual sigue a la clase real del <html>, que en "sistema" la fija
  // el SO y no la preferencia guardada.
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [pref, ready])

  return (
    <button
      type="button"
      onClick={() => setPref(dark ? 'light' : 'dark')}
      role="switch"
      aria-checked={ready ? dark : undefined}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro (Master Ball)'}
      title={dark ? 'Modo claro · Pokéball' : 'Modo oscuro · Master Ball'}
      className="relative h-9 w-16 shrink-0 rounded-full border-2 border-black/25 bg-white/25 backdrop-blur transition-colors hover:bg-white/35"
    >
      <span
        className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] shadow-md transition-[left] duration-300"
        style={{ left: dark ? 'calc(100% - 1.875rem)' : '0.125rem' }}
      >
        {dark ? <Moon size={15} /> : <Sun size={15} />}
      </span>
    </button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Claro', hint: 'Pokéball', icon: Sun },
  { value: 'dark', label: 'Oscuro', hint: 'Master Ball', icon: Moon },
  { value: 'system', label: 'Sistema', hint: 'Automático', icon: Monitor },
]

/** Selector de tres estados para la pantalla de Configuración. */
export function ThemeSelector() {
  const [pref, setPref, ready] = useThemePreference()

  return (
    // Tres columnas siempre: en el panel lateral del móvil, apiladas ocupaban
    // tanto que empujaban el botón de cerrar sesión fuera de la pantalla.
    <div role="radiogroup" aria-label="Tema de la interfaz" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
        const active = ready && pref === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPref(value)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-semibold transition sm:px-3 sm:py-4 sm:text-sm ${
              active
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-line bg-surface-2 text-muted hover:border-brand/50 hover:text-ink'
            }`}
          >
            <Icon size={20} />
            {label}
            <span className="text-[10px] font-normal leading-tight opacity-80">{hint}</span>
          </button>
        )
      })}
    </div>
  )
}
