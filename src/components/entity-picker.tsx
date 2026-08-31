'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Search, X } from 'lucide-react'

export interface PickerOption {
  /** Valor que se guarda (slug de la PokéAPI). */
  value: string
  /** Texto visible ya formateado. */
  label: string
  /** URL del sprite. `null` pinta un hueco neutro en su lugar. */
  icon?: string | null
  /** Alternativa a `icon` para iconos vectoriales (insignias de tipo, etc.). */
  iconNode?: React.ReactNode
  /** Texto secundario a la derecha: número de Pokédex, tipo… */
  hint?: string
  /** Se pinta debajo de la etiqueta (tipos, categoría del objeto…). */
  badge?: React.ReactNode
}

const PAGE_SIZE = 20

/**
 * Combobox con sprites. Sustituye a los `<datalist>` nativos, que no permiten
 * pintar imágenes ni paginar: la lista carga de 20 en 20 para no montar miles
 * de nodos con la Pokédex completa.
 */
export function EntityPicker({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled,
  disabledHint,
  pixelated = false,
  allowClear = true,
  compact = false,
}: {
  label: string
  value: string
  options: PickerOption[]
  onSelect: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  disabledHint?: string
  /** Los sprites de Pokémon son pixel art y no deben suavizarse al escalar. */
  pixelated?: boolean
  allowClear?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [active, setActive] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  )

  // Coincidencias: primero las que empiezan por la búsqueda, luego las que la
  // contienen. Así "char" ofrece Charmander antes que Fire Charm.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    const starts: PickerOption[] = []
    const contains: PickerOption[] = []
    for (const o of options) {
      const hay = `${o.value} ${o.label}`.toLowerCase()
      if (o.value.startsWith(q) || o.label.toLowerCase().startsWith(q)) starts.push(o)
      else if (hay.includes(q)) contains.push(o)
    }
    return [...starts, ...contains]
  }, [options, query])

  const visible = matches.slice(0, shown)
  const remaining = matches.length - visible.length

  useEffect(() => {
    setShown(PAGE_SIZE)
    setActive(0)
  }, [query])

  // Cierre al pulsar fuera o con Escape a nivel de documento.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  // Mantiene la opción activa dentro de la zona visible al navegar con teclado.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function choose(option: PickerOption) {
    onSelect(option.value)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => {
        const next = i + delta
        // Al llegar al final se despliega la siguiente página automáticamente.
        if (next >= visible.length && remaining > 0) setShown((s) => s + PAGE_SIZE)
        return Math.max(0, Math.min(next, visible.length - 1 + (remaining > 0 ? 1 : 0)))
      })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const option = visible[active]
      if (option) choose(option)
    }
  }

  const size = compact ? 'h-9 text-xs' : 'h-11 text-sm'

  return (
    <div className="block" ref={rootRef}>
      <span className="mb-1 block text-xs font-semibold">{label}</span>

      <div className="relative">
        {/* Estado cerrado: muestra la selección con su sprite. */}
        {!open && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className={`flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 text-left outline-none transition hover:border-brand/60 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 ${size}`}
          >
            {selected ? (
              <>
                {selected.iconNode ?? (
                  <Sprite src={selected.icon} alt="" pixelated={pixelated} compact={compact} />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{selected.label}</span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted">
                {disabled ? (disabledHint ?? placeholder) : placeholder}
              </span>
            )}
            {allowClear && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Quitar ${label.toLowerCase()}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect('')
                }}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted transition hover:bg-line hover:text-ink"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown size={15} className="shrink-0 text-muted" />
          </button>
        )}

        {/* Estado abierto: campo de búsqueda. */}
        {open && (
          <div className={`flex w-full items-center gap-2 rounded-xl border border-brand bg-surface-2 px-2.5 ${size}`}>
            <Search size={15} className="shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={selected ? selected.label : placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted transition hover:bg-line hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-line bg-bg-elevated shadow-float">
            <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto overscroll-contain py-1">
              {visible.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted">{emptyText}</li>
              )}

              {visible.map((o, i) => (
                <li key={o.value} data-index={i}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition ${
                      i === active ? 'bg-brand/15' : ''
                    } ${o.value === value ? 'font-bold text-brand' : ''}`}
                  >
                    {o.iconNode ?? <Sprite src={o.icon} alt="" pixelated={pixelated} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.badge && <span className="mt-0.5 flex gap-1">{o.badge}</span>}
                    </span>
                    {o.hint && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">{o.hint}</span>
                    )}
                  </button>
                </li>
              ))}

              {remaining > 0 && (
                <li className="p-1.5">
                  <button
                    type="button"
                    onClick={() => setShown((s) => s + PAGE_SIZE)}
                    className="w-full rounded-lg bg-surface-2 py-2 text-xs font-semibold text-muted transition hover:bg-line hover:text-ink"
                  >
                    Mostrar {Math.min(PAGE_SIZE, remaining)} más ({remaining} restantes)
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Sprite con hueco de reserva. Muchos objetos de la PokéAPI no tienen imagen, y
 * sin este control la lista daría saltos al fallar la carga.
 */
function Sprite({
  src,
  alt,
  pixelated,
  compact,
}: {
  src?: string | null
  alt: string
  pixelated?: boolean
  compact?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const box = compact ? 'h-6 w-6' : 'h-8 w-8'

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return <span className={`${box} shrink-0 rounded-md bg-line/50`} aria-hidden />
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      unoptimized
      onError={() => setFailed(true)}
      className={`${box} shrink-0 object-contain ${pixelated ? '[image-rendering:pixelated]' : ''}`}
    />
  )
}
