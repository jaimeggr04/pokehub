'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import clsx from 'clsx'
import { PokeballIcon } from '@/components/pokeball'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/lib/hooks'

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
// Con pocas opciones no hace falta buscador: en móvil, además, abrir el
// teclado para elegir entre tres habilidades sería un estorbo.
const SEARCH_THRESHOLD = 8
// Si la opción elegida está muy abajo no se pinta todo hasta ella.
const MAX_REVEAL = 400

/** Minúsculas y sin tildes: "Flabébé" y "flabebe" deben coincidir. */
function fold(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Combobox con sprites. Sustituye a los `<datalist>` nativos, que no permiten
 * pintar imágenes ni paginar: la lista carga de 20 en 20 para no montar miles
 * de nodos con la Pokédex completa. En pantallas estrechas se abre en una hoja
 * inferior, donde hay sitio para el dedo y para el teclado.
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
  loading = false,
  autoOpen = false,
  unknownOption,
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
  /** Las opciones aún se están descargando: esqueletos en vez de "sin resultados". */
  loading?: boolean
  /**
   * Al montarse: en la hoja (móvil) la abre ya; en escritorio sólo enfoca el
   * campo, porque el desplegable se coloca según la posición del campo y la
   * página puede estar aún desplazándose hasta él.
   */
  autoOpen?: boolean
  /**
   * Cómo pintar un valor que no está entre las opciones: la lista aún no ha
   * llegado, o viene de una importación y no encaja con ninguna. Sin esto el
   * campo parecería vacío teniendo un valor.
   */
  unknownOption?: (value: string) => PickerOption
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [active, setActive] = useState(0)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')

  const wide = useMediaQuery('(min-width: 640px)')
  const sheet = !wide
  const searchable = options.length > SEARCH_THRESHOLD || loading

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const refocusTrigger = useRef(false)

  const baseId = useId()
  const labelId = `${baseId}-label`
  const valueId = `${baseId}-value`
  const listId = `${baseId}-list`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const selected = useMemo(() => {
    if (!value) return null
    return options.find((o) => o.value === value) ?? unknownOption?.(value) ?? { value, label: value }
  }, [options, value, unknownOption])

  // Coincidencias: primero las que empiezan por la búsqueda, luego las que la
  // contienen. Así "char" ofrece Charmander antes que Fire Charm. Un número
  // busca por Pokédex: "25" encuentra a Pikachu (#0025).
  const needle = fold(query.trim())
  const matches = useMemo(() => {
    if (!needle) return options
    const exact: PickerOption[] = []
    const starts: PickerOption[] = []
    const contains: PickerOption[] = []
    const numeric = /^\d+$/.test(needle) ? String(Number(needle)) : null
    for (const o of options) {
      if (numeric && o.hint && o.hint.replace(/\D/g, '').replace(/^0+/, '') === numeric) {
        exact.push(o)
        continue
      }
      const labelText = fold(o.label)
      if (o.value.startsWith(needle) || labelText.startsWith(needle)) starts.push(o)
      else if (o.value.includes(needle) || labelText.includes(needle)) contains.push(o)
    }
    return [...exact, ...starts, ...contains]
  }, [options, needle])

  const visible = matches.slice(0, shown)
  const remaining = matches.length - visible.length
  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0))

  // Devuelve el foco al disparador cuando el campo de búsqueda desaparece.
  useEffect(() => {
    if (open || !refocusTrigger.current) return
    refocusTrigger.current = false
    triggerRef.current?.focus()
  }, [open])

  // Cierre al pulsar fuera (sólo el desplegable: la hoja tiene su fondo).
  useEffect(() => {
    if (!open || sheet) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, sheet])

  // Foco al buscador al abrir, con el cursor al final (si se abrió tecleando,
  // la primera letra ya está escrita). En la hoja se espera a que ella enfoque
  // su panel, o se lo quitaría.
  useEffect(() => {
    if (!open || (sheet && !searchable)) return
    const focusInput = () => {
      const input = inputRef.current
      if (!input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(input.value.length, input.value.length)
    }
    if (!sheet) {
      focusInput()
      return
    }
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(focusInput)
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [open, sheet, searchable])

  // Mantiene la opción activa a la vista al navegar con teclado.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  // Carga la página siguiente al asomar el final de la lista.
  useEffect(() => {
    const node = moreRef.current
    if (!open || !node || remaining <= 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setShown((s) => s + PAGE_SIZE)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [open, remaining, shown])

  function openPicker(initialQuery = '') {
    if (disabled) return
    const index = initialQuery ? -1 : options.findIndex((o) => o.value === value)
    if (index >= 0 && index < MAX_REVEAL) {
      setShown(Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE)
      setActive(index)
    } else {
      setShown(PAGE_SIZE)
      setActive(0)
    }
    setQuery(initialQuery)

    // Si debajo no cabe la lista y arriba sí, se abre hacia arriba.
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setPlacement(below < 320 && rect.top > below ? 'top' : 'bottom')
    }
    setOpen(true)
  }

  // Sólo al montarse: el creador lo pide al añadir un hueco nuevo.
  const autoOpenRef = useRef(autoOpen)
  const openRef = useRef(openPicker)
  useEffect(() => {
    openRef.current = openPicker
  })
  useEffect(() => {
    if (!autoOpenRef.current) return
    autoOpenRef.current = false
    if (window.matchMedia('(min-width: 640px)').matches) triggerRef.current?.focus({ preventScroll: true })
    else openRef.current()
  }, [])

  function close(returnFocus: boolean) {
    setOpen(false)
    setQuery('')
    refocusTrigger.current = returnFocus && !sheet
  }

  function choose(option: PickerOption) {
    onSelect(option.value)
    close(true)
  }

  function changeQuery(next: string) {
    setQuery(next)
    setShown(PAGE_SIZE)
    setActive(0)
  }

  function move(delta: number) {
    const last = visible.length - 1
    const next = Math.max(0, activeIndex + delta)
    // Al pasar del final se despliega la página siguiente automáticamente.
    if (next > last && remaining > 0) setShown((s) => s + PAGE_SIZE)
    setActive(Math.min(next, last + (remaining > 0 ? Math.min(delta, PAGE_SIZE) : 0)))
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'PageDown':
        e.preventDefault()
        move(8)
        break
      case 'PageUp':
        e.preventDefault()
        move(-8)
        break
      case 'Enter': {
        e.preventDefault()
        const option = visible[activeIndex]
        if (option) choose(option)
        break
      }
      case 'Escape':
        // En la hoja se encarga ella (cierra y devuelve el foco).
        if (sheet) return
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openPicker()
      return
    }
    // Escribir sobre el campo cerrado lo abre ya buscando esa letra.
    if (searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      e.preventDefault()
      openPicker(e.key)
    }
  }

  const height = compact ? 'h-9 text-xs' : 'h-11 text-sm'
  const showClear = allowClear && Boolean(selected) && !disabled
  const activeDescendant = open && visible[activeIndex] ? optionId(activeIndex) : undefined

  const searchField = (
    <div
      className={clsx(
        'flex w-full items-center gap-2 rounded-xl border border-brand bg-surface-2 px-2.5 ring-4 ring-brand-soft',
        sheet ? 'h-12' : height,
      )}
    >
      <Search size={16} className="shrink-0 text-muted" aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => changeQuery(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder={selected ? selected.label : placeholder}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-labelledby={labelId}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted focus-visible:outline-none sm:text-sm"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            changeQuery('')
            inputRef.current?.focus()
          }}
          aria-label="Borrar búsqueda"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      )}
      {!sheet && !query && (
        <button
          type="button"
          onClick={() => close(true)}
          aria-label="Cerrar"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  )

  const list = (
    <OptionList
      listRef={listRef}
      moreRef={moreRef}
      listId={listId}
      labelId={labelId}
      optionId={optionId}
      visible={visible}
      remaining={remaining}
      activeIndex={activeIndex}
      value={value}
      needle={needle}
      query={query}
      loading={loading && options.length === 0}
      emptyText={emptyText}
      pixelated={pixelated}
      roomy={sheet}
      onHover={setActive}
      onChoose={choose}
      onMore={() => setShown((s) => s + PAGE_SIZE)}
    />
  )

  return (
    <div className="block" ref={rootRef} data-picker-open={open && !sheet ? '' : undefined}>
      <span id={labelId} className="mb-1 block text-xs font-semibold">
        {label}
      </span>

      <div
        className="relative"
        onBlur={(e) => {
          // Tabular fuera del buscador cierra el desplegable. Sin destino (el
          // campo se desmonta, la ventana pierde el foco) no se hace nada: de
          // los clics fuera ya se encarga el oyente de pointerdown.
          const next = e.relatedTarget
          if (open && !sheet && next && !e.currentTarget.contains(next)) close(false)
        }}
      >
        {open && !sheet ? (
          searchField
        ) : (
          <>
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={() => (open ? close(false) : openPicker())}
              onKeyDown={onTriggerKeyDown}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-labelledby={`${labelId} ${valueId}`}
              className={clsx(
                'group flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 pl-2.5 text-left transition-[border-color,box-shadow,background-color] duration-(--dur) ease-(--ease-out-expo)',
                'hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line',
                showClear ? 'pr-16' : 'pr-9',
                height,
              )}
            >
              {selected ? (
                <>
                  {selected.iconNode ?? <Sprite src={selected.icon} pixelated={pixelated} compact={compact} />}
                  <span id={valueId} className="min-w-0 flex-1 truncate font-medium">
                    {selected.label}
                  </span>
                </>
              ) : (
                <span id={valueId} className="min-w-0 flex-1 truncate text-muted">
                  {disabled ? (disabledHint ?? placeholder) : placeholder}
                </span>
              )}
            </button>
            <ChevronDown
              size={16}
              aria-hidden
              className={clsx(
                'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-transform duration-(--dur) ease-(--ease-out-expo)',
                open && 'rotate-180',
              )}
            />
            {showClear && (
              <button
                type="button"
                onClick={() => {
                  onSelect('')
                  triggerRef.current?.focus()
                }}
                aria-label={`Quitar ${label.toLowerCase()}`}
                className="absolute right-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </>
        )}

        <AnimatePresence>
          {open && !sheet && (
            <motion.div
              key="dropdown"
              initial={{ opacity: 0, scale: 0.97, y: placement === 'bottom' ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: 'easeIn' } }}
              transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
              style={{ transformOrigin: placement === 'bottom' ? 'top center' : 'bottom center' }}
              // Pulsar en la lista no debe quitarle el foco al buscador.
              onMouseDown={(e) => e.preventDefault()}
              className={clsx(
                'absolute inset-x-0 z-50 overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-float',
                placement === 'bottom' ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]',
              )}
            >
              <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">{list}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomSheet
        open={open && sheet}
        onClose={() => close(false)}
        title={label}
        showTitle
        className={searchable ? 'h-[85dvh]' : undefined}
      >
        {searchable && (
          <div className="sticky top-0 z-10 -mx-1 flex items-center gap-1 bg-bg-elevated px-1 pb-2">
            <div className="min-w-0 flex-1">{searchField}</div>
            <button
              type="button"
              onClick={() => close(false)}
              className="h-12 shrink-0 rounded-xl px-2.5 text-sm font-semibold text-brand"
            >
              Cancelar
            </button>
          </div>
        )}
        {list}
        {!searchable && (
          <button type="button" onClick={() => close(false)} className="btn btn-soft mt-3 w-full">
            Cancelar
          </button>
        )}
      </BottomSheet>
    </div>
  )
}

function OptionList({
  listRef,
  moreRef,
  listId,
  labelId,
  optionId,
  visible,
  remaining,
  activeIndex,
  value,
  needle,
  query,
  loading,
  emptyText,
  pixelated,
  roomy,
  onHover,
  onChoose,
  onMore,
}: {
  listRef: React.RefObject<HTMLUListElement | null>
  moreRef: React.RefObject<HTMLButtonElement | null>
  listId: string
  labelId: string
  optionId: (i: number) => string
  visible: PickerOption[]
  remaining: number
  activeIndex: number
  value: string
  needle: string
  query: string
  loading: boolean
  emptyText: string
  pixelated: boolean
  roomy: boolean
  onHover: (i: number) => void
  onChoose: (o: PickerOption) => void
  onMore: () => void
}) {
  if (loading) {
    return (
      <div role="status" className="space-y-1.5 p-1">
        <span className="sr-only">Cargando opciones…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-1.5 py-1">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-3.5 rounded-md" style={{ width: `${70 - i * 9}%` }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelId}>
        {visible.map((o, i) => {
          const current = o.value === value
          const isActive = i === activeIndex
          return (
            <li
              key={o.value}
              id={optionId(i)}
              data-index={i}
              role="option"
              aria-selected={isActive}
              onPointerMove={() => {
                if (!isActive) onHover(i)
              }}
              onClick={() => onChoose(o)}
              className={clsx(
                'relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2 text-left text-sm transition-colors duration-100',
                roomy ? 'min-h-12 scroll-mt-16 py-1.5' : 'min-h-10 py-1',
                isActive ? 'bg-brand-soft' : 'hover:bg-surface-2',
                current && 'font-semibold',
              )}
            >
              {isActive && (
                <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" />
              )}
              {o.iconNode ?? <Sprite src={o.icon} pixelated={pixelated} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{highlight(o.label, needle)}</span>
                {o.badge && <span className="mt-0.5 flex gap-1">{o.badge}</span>}
              </span>
              {o.hint && <span className="shrink-0 text-[11px] font-normal tabular-nums text-muted">{o.hint}</span>}
              {current && (
                <>
                  <Check size={16} strokeWidth={2.6} aria-hidden className="shrink-0 text-brand" />
                  <span className="sr-only">(elegido)</span>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <PokeballIcon className="h-9 w-9 opacity-40 grayscale" />
          <p className="text-sm font-semibold">{emptyText}</p>
          {query.trim() && <p className="text-xs text-muted">No hay nada con «{query.trim()}».</p>}
        </div>
      )}

      {remaining > 0 && (
        <button
          ref={moreRef}
          type="button"
          tabIndex={-1}
          onClick={onMore}
          className="mt-1 w-full rounded-xl bg-surface-2 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-line hover:text-ink"
        >
          Mostrar {Math.min(PAGE_SIZE, remaining)} más ({remaining} restantes)
        </button>
      )}
    </>
  )
}

/** Resalta el trozo de la etiqueta que coincide con la búsqueda. */
function highlight(label: string, needle: string): React.ReactNode {
  if (!needle) return label
  const plain = fold(label)
  // Si al quitar tildes cambia la longitud, los índices ya no casan: sin resaltado.
  if (plain.length !== label.length) return label
  const at = plain.indexOf(needle)
  if (at < 0) return label
  return (
    <>
      {label.slice(0, at)}
      <mark className="builder-picker-mark">{label.slice(at, at + needle.length)}</mark>
      {label.slice(at + needle.length)}
    </>
  )
}

/**
 * Sprite con hueco de reserva. Muchos objetos de la PokéAPI no tienen imagen, y
 * sin este control la lista daría saltos al fallar la carga.
 */
function Sprite({
  src,
  pixelated,
  compact,
}: {
  src?: string | null
  pixelated?: boolean
  compact?: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const box = compact ? 'h-6 w-6' : 'h-8 w-8'

  if (!src || failedSrc === src) {
    return <span className={clsx(box, 'shrink-0 rounded-lg bg-line/50')} aria-hidden />
  }

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      onError={() => setFailedSrc(src)}
      className={clsx(box, 'shrink-0 object-contain', pixelated && '[image-rendering:pixelated]')}
    />
  )
}
