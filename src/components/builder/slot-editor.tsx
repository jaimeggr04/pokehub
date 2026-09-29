'use client'

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronsUp, RotateCcw, Sparkles, Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import { EntityPicker, type PickerOption } from '@/components/entity-picker'
import { TypeBadge } from '@/components/type-badge'
import { BuildMeter, FieldLabel, NumberField, Segmented, type SegmentOption } from '@/components/builder/fields'
import {
  MAX_SLOTS, NO_MOVES, buildProgress, natureLabel, slotIssues, slotName, slotSummary,
  type Slot, type SlotPatch,
} from '@/components/builder/model'
import { StatEditor } from '@/components/builder/stat-editor'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { toast } from '@/components/ui/toast'
import { getMoves, resolvePokemon, type MoveDetail, type PokemonDetail } from '@/lib/pokeapi'
import { NATURE_NAMES, POKEMON_TYPES, itemSpriteUrl, prettify, spriteUrl } from '@/lib/pokemon'
import type { Gender } from '@/lib/database.types'

/** Listas grandes que comparten todos los huecos; el creador las carga una vez. */
export type Catalog = {
  dexOptions: PickerOption[]
  itemOptions: PickerOption[]
  dexLoading: boolean
  itemsLoading: boolean
  dexFailed: boolean
  itemsFailed: boolean
}

export type SlotEditorProps = {
  slot: Slot
  index: number
  count: number
  open: boolean
  duplicate: boolean
  /** El hueco se acaba de añadir: se abre el selector de especie al montarse. */
  autoPick: boolean
  /**
   * Entra animado. Sólo los que se añaden después de cargar: los que vienen
   * del servidor no deben salir invisibles en el HTML a la espera de hidratar.
   */
  appear: boolean
  catalog: Catalog
  onToggle: (key: string) => void
  onPatch: (key: string, changes: SlotPatch) => void
  onMove: (key: string, dir: -1 | 1, card: HTMLElement | null) => void
  onRemove: (key: string) => void
  onNext: (key: string) => void
  registerCard: (key: string, el: HTMLElement | null) => void
}

// Opciones fijas: iguales para todos los huecos, se crean una sola vez.
const TERA_OPTIONS: PickerOption[] = POKEMON_TYPES.map((t) => ({
  value: t,
  label: prettify(t),
  iconNode: <TypeBadge type={t} size="sm" className="w-16 shrink-0 justify-center" />,
}))

const NATURE_OPTIONS: PickerOption[] = NATURE_NAMES.map((n) => ({
  value: n,
  label: natureLabel(n),
  iconNode: <span className="h-8 w-2 shrink-0" aria-hidden />,
}))

const GENDER_OPTIONS: SegmentOption<Gender>[] = [
  { value: 'male', label: '♂', srLabel: 'Macho' },
  { value: 'female', label: '♀', srLabel: 'Hembra' },
  { value: 'unknown', label: '—', srLabel: 'Sin especificar' },
]

// Valores que aún no están entre las opciones (lista cargando o importados
// que no encajan): se pintan con su nombre en vez de dejar el campo en blanco.
const plainOption = (value: string): PickerOption => ({
  value,
  label: prettify(value),
  iconNode: <span className="h-8 w-2 shrink-0" aria-hidden />,
})
const itemOption = (value: string): PickerOption => ({ value, label: prettify(value), icon: itemSpriteUrl(value) })
const moveOption = (value: string): PickerOption => ({
  value,
  label: prettify(value),
  iconNode: <span className="h-8 w-16 shrink-0" aria-hidden />,
})
const typeOption = (value: string): PickerOption => ({
  value,
  label: prettify(value),
  iconNode: <TypeBadge type={value} size="sm" className="w-16 shrink-0 justify-center" />,
})

/**
 * Un hueco del equipo en acordeón. Plegado enseña lo esencial (sprite, tipos,
 * avisos y un resumen de una línea) y se puede reordenar; desplegado monta el
 * editor completo. Los datos de la especie se piden aunque esté plegado: los
 * tipos de la cabecera y el análisis del equipo los necesitan.
 */
export const SlotEditor = memo(function SlotEditor({
  slot,
  index,
  count,
  open,
  duplicate,
  autoPick,
  appear,
  catalog,
  onToggle,
  onPatch,
  onMove,
  onRemove,
  onNext,
  registerCard,
}: SlotEditorProps) {
  const reduceMotion = useReducedMotion()
  const baseId = useId()
  const headId = `${baseId}-head`
  const panelId = `${baseId}-panel`
  const cardRef = useRef<HTMLElement | null>(null)

  const [species, setSpecies] = useState<PokemonDetail | null>(null)
  const [failedId, setFailedId] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [picking, setPicking] = useState(false)
  // Especie ya descargada al elegirla en el selector: no hace falta pedirla otra vez por número.
  const known = useRef<PokemonDetail | null>(null)

  useEffect(() => {
    if (!slot.pokemon_id || known.current?.id === slot.pokemon_id) return
    let alive = true
    resolvePokemon([String(slot.pokemon_id)])
      .then((p) => {
        if (!alive) return
        if (p) setSpecies(p)
        else setFailedId(slot.pokemon_id)
      })
      .catch(() => {
        if (alive) setFailedId(slot.pokemon_id)
      })
    return () => {
      alive = false
    }
  }, [slot.pokemon_id, attempt])

  // Mientras llega la especie nueva no se usa la anterior: sus movimientos y
  // estadísticas ya no valen.
  const current = species && species.id === slot.pokemon_id ? species : null
  const speciesFailed = slot.pokemon_id > 0 && !current && failedId === slot.pokemon_id
  const speciesLoading = slot.pokemon_id > 0 && !current && !speciesFailed

  const patch = useCallback((changes: SlotPatch) => onPatch(slot.key, changes), [onPatch, slot.key])
  const setCard = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el
      registerCard(slot.key, el)
    },
    [registerCard, slot.key],
  )

  function pickSpecies(value: string) {
    if (!value) {
      patch({ pokemon_id: 0, pokemon_name: '', ability: '', moves: [...NO_MOVES] })
      return
    }
    const found = catalog.dexOptions.find((d) => d.value === value)
    if (!found) return
    setPicking(true)
    // Al cambiar de especie, habilidad y movimientos dejan de ser válidos.
    const failed = () =>
      toast('No se pudo cargar ese Pokémon', {
        tone: 'error',
        description: 'La PokéAPI no ha respondido. Inténtalo otra vez.',
      })
    resolvePokemon([value])
      .then((p) => {
        if (!p) {
          failed()
          return
        }
        known.current = p
        setSpecies(p)
        patch({ pokemon_id: p.id, pokemon_name: p.name, ability: '', moves: [...NO_MOVES] })
      }, failed)
      .finally(() => setPicking(false))
  }

  const name = slotName(slot, index)
  const issues = slotIssues(slot, duplicate)
  const progress = buildProgress(slot)
  const types = current?.types ?? []
  const isFirst = index === 0
  const isLast = index === count - 1

  return (
    <motion.article
      ref={setCard}
      layout="position"
      initial={appear ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      data-open={open || undefined}
      aria-labelledby={headId}
      className="card builder-slot"
    >
      <div className="flex items-start gap-1 p-2 sm:gap-2 sm:p-2.5">
        <h3 className="min-w-0 flex-1">
          <button
            id={headId}
            type="button"
            data-slot-toggle
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => onToggle(slot.key)}
            className="builder-slot-toggle flex w-full items-center gap-3 p-1 text-left"
          >
            <SlotSprite slot={slot} index={index} busy={picking} progress={progress} />

            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[15px] font-extrabold leading-tight">{name}</span>
                {slot.shiny && slot.pokemon_id > 0 && (
                  <>
                    <Sparkles size={13} aria-hidden className="shrink-0 text-[#e0a100] dark:text-[#ffd23f]" />
                    <span className="sr-only">, variocolor</span>
                  </>
                )}
              </span>
              {slot.nickname.trim() && slot.pokemon_id > 0 && (
                <span className="block truncate text-xs text-muted">{prettify(slot.pokemon_name)}</span>
              )}
              {(types.length > 0 || issues.length > 0) && (
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                  {issues.map((issue) => (
                    <span
                      key={issue.label}
                      className={clsx(
                        'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold',
                        issue.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                      )}
                    >
                      <AlertTriangle size={11} aria-hidden /> {issue.label}
                    </span>
                  ))}
                </span>
              )}
              {!open && (
                <span className="mt-1 block truncate text-xs text-muted">{slotSummary(slot)}</span>
              )}
              {slot.pokemon_id > 0 && (
                <span className="sr-only">
                  {progress.missing.length ? `. Falta: ${progress.missing.join(', ')}` : '. Build completo'}
                </span>
              )}
            </span>

            <ChevronDown size={18} aria-hidden className="builder-slot-chevron shrink-0 text-muted max-[400px]:hidden" />
          </button>
        </h3>

        <div className="flex shrink-0 items-center gap-0.5 pt-1.5">
          <button
            type="button"
            title="Subir"
            aria-label={`Subir a ${name}`}
            aria-disabled={isFirst}
            onClick={() => !isFirst && onMove(slot.key, -1, cardRef.current)}
            className="builder-icon-btn"
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            title="Bajar"
            aria-label={`Bajar a ${name}`}
            aria-disabled={isLast}
            onClick={() => !isLast && onMove(slot.key, 1, cardRef.current)}
            className="builder-icon-btn"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
          {count > 1 && (
            <button
              type="button"
              title="Quitar del equipo"
              aria-label={`Quitar a ${name} del equipo`}
              onClick={() => onRemove(slot.key)}
              className="builder-icon-btn builder-icon-btn-danger"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={headId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { height: { type: 'spring', stiffness: 360, damping: 40 }, opacity: { duration: 0.2 } }
            }
            className="builder-slot-panel"
          >
            <SlotFields
              slot={slot}
              index={index}
              count={count}
              species={current}
              speciesLoading={speciesLoading}
              speciesFailed={speciesFailed}
              onRetrySpecies={() => {
                setFailedId(0)
                setAttempt((n) => n + 1)
              }}
              picking={picking}
              autoPick={autoPick}
              catalog={catalog}
              progressMissing={progress.missing}
              onPatch={patch}
              onPickSpecies={pickSpecies}
              onCollapse={() => onToggle(slot.key)}
              onNext={() => onNext(slot.key)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
})

/* ------------------------------------------------------------------ */

function SlotSprite({
  slot,
  index,
  busy,
  progress,
}: {
  slot: Slot
  index: number
  busy: boolean
  progress: ReturnType<typeof buildProgress>
}) {
  return (
    <span className="builder-slot-sprite size-14 shrink-0 rounded-2xl sm:size-16">
      <span
        aria-hidden
        className="absolute -left-1 -top-1 z-10 grid size-5 place-items-center rounded-full bg-band text-[10px] font-extrabold text-white shadow-card"
      >
        {index + 1}
      </span>
      {busy ? (
        <PokeballSpinner size={26} label="Cargando Pokémon…" className="relative" />
      ) : slot.pokemon_id ? (
        <Image
          key={`${slot.pokemon_id}-${slot.shiny}`}
          src={spriteUrl(slot.pokemon_id, slot.shiny)}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="builder-sprite-in relative size-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        <span aria-hidden className="relative text-lg font-bold text-muted">?</span>
      )}
      {slot.pokemon_id > 0 && (
        <BuildMeter done={progress.done} total={progress.total} className="absolute inset-x-2 bottom-1" />
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */

function SlotFields({
  slot,
  index,
  count,
  species,
  speciesLoading,
  speciesFailed,
  onRetrySpecies,
  picking,
  autoPick,
  catalog,
  progressMissing,
  onPatch,
  onPickSpecies,
  onCollapse,
  onNext,
}: {
  slot: Slot
  index: number
  count: number
  species: PokemonDetail | null
  speciesLoading: boolean
  speciesFailed: boolean
  onRetrySpecies: () => void
  picking: boolean
  autoPick: boolean
  catalog: Catalog
  progressMissing: string[]
  onPatch: (changes: SlotPatch) => void
  onPickSpecies: (value: string) => void
  onCollapse: () => void
  onNext: () => void
}) {
  const [moveInfo, setMoveInfo] = useState<Record<string, MoveDetail>>({})
  const fieldId = useId()
  const shinyLabelId = `${fieldId}-shiny`

  // Detalles de los movimientos elegidos, para pintar tipo y categoría.
  const chosenMoves = slot.moves.filter(Boolean).join(',')
  useEffect(() => {
    const names = chosenMoves ? chosenMoves.split(',') : []
    if (names.length === 0) return
    let alive = true
    getMoves(names)
      .then((list) => {
        if (!alive) return
        setMoveInfo((prev) => {
          const next = { ...prev }
          for (const m of list) next[m.name] = m
          return next
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [chosenMoves])

  const abilityOptions = useMemo<PickerOption[]>(
    () =>
      (species?.abilityDetails ?? []).map((a) => ({
        value: a.name,
        label: prettify(a.name),
        iconNode: <span className="h-8 w-8 shrink-0" aria-hidden />,
        hint: a.hidden ? 'Oculta' : undefined,
      })),
    [species],
  )

  // Acotar los movimientos al learnset real es lo que hace el selector usable:
  // se pasa de ~900 opciones a las que la especie puede aprender de verdad.
  const moveOptions = useMemo<PickerOption[]>(
    () =>
      (species?.moves ?? []).map((m) => {
        const info = moveInfo[m]
        return {
          value: m,
          label: prettify(m),
          iconNode: info ? (
            <TypeBadge type={info.type} size="sm" className="w-16 shrink-0 justify-center" />
          ) : (
            <span className="h-8 w-16 shrink-0" aria-hidden />
          ),
          hint: info?.power ? `${info.power}` : undefined,
        }
      }),
    [species, moveInfo],
  )

  const speciesOption = useCallback(
    (value: string): PickerOption => ({
      value,
      label: prettify(value),
      icon: slot.pokemon_id ? spriteUrl(slot.pokemon_id) : null,
    }),
    [slot.pokemon_id],
  )

  const noSpecies = !species
  const lockedHint = slot.pokemon_id ? 'Cargando la especie…' : 'Elige antes el Pokémon'
  const hasNext = index < count - 1 || count < MAX_SLOTS

  return (
    <div className="space-y-5 border-t border-line px-3 pb-4 pt-4 sm:px-4">
      {speciesFailed && (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-warning-soft px-3 py-2 text-sm">
          <AlertTriangle size={15} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1">No se han podido cargar los datos de esta especie.</span>
          <button type="button" onClick={onRetrySpecies} className="btn btn-ghost btn-sm -my-1 text-warning">
            <RotateCcw size={14} aria-hidden /> Reintentar
          </button>
        </p>
      )}

      {species && progressMissing.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-semibold text-ink">Para completarlo:</span> {progressMissing.join(', ')}.
        </p>
      )}

      <section aria-labelledby={`${fieldId}-who`}>
        <h4 id={`${fieldId}-who`} className="builder-subhead">
          Pokémon
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <EntityPicker
            label="Especie"
            value={slot.pokemon_name}
            options={catalog.dexOptions}
            onSelect={onPickSpecies}
            placeholder={picking ? 'Cargando…' : 'Busca un Pokémon…'}
            emptyText={catalog.dexFailed ? 'No se pudo cargar la Pokédex' : 'Ningún Pokémon coincide'}
            loading={catalog.dexLoading}
            disabled={picking}
            pixelated
            autoOpen={autoPick}
            unknownOption={speciesOption}
          />

          <div>
            <FieldLabel htmlFor={`${fieldId}-nick`} counter={{ value: slot.nickname.length, max: 20 }}>
              Mote
            </FieldLabel>
            <input
              id={`${fieldId}-nick`}
              value={slot.nickname}
              maxLength={20}
              onChange={(e) => onPatch({ nickname: e.target.value })}
              placeholder="Opcional"
              autoComplete="off"
              className="builder-input h-11 px-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 sm:col-span-2 sm:grid-cols-[5.5rem_minmax(0,14rem)_minmax(0,11rem)]">
            <div>
              <FieldLabel htmlFor={`${fieldId}-level`}>Nivel</FieldLabel>
              <NumberField
                id={`${fieldId}-level`}
                value={slot.level}
                min={1}
                max={100}
                fallback={50}
                onCommit={(level) => onPatch({ level })}
                className="h-11 px-2 text-sm"
              />
            </div>

            <Segmented
              legend="Género"
              value={slot.gender}
              options={GENDER_OPTIONS}
              onChange={(gender) => onPatch({ gender })}
              className="[&_.builder-seg-option>span]:text-lg"
            />

            <div className="col-span-2 sm:col-span-1">
              <span id={shinyLabelId} className="mb-1 block text-xs font-semibold">
                Variocolor
              </span>
              <button
                type="button"
                aria-labelledby={shinyLabelId}
                aria-pressed={slot.shiny}
                onClick={() => onPatch({ shiny: !slot.shiny })}
                className="builder-input builder-shiny flex h-11 items-center justify-center gap-2 px-3 text-sm font-semibold text-muted"
              >
                <Sparkles size={16} aria-hidden fill={slot.shiny ? 'currentColor' : 'none'} />
                <span aria-hidden>{slot.shiny ? 'Sí, variocolor' : 'Normal'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby={`${fieldId}-battle`}>
        <h4 id={`${fieldId}-battle`} className="builder-subhead">
          Combate
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <EntityPicker
            label="Habilidad"
            value={slot.ability}
            options={abilityOptions}
            onSelect={(v) => onPatch({ ability: v })}
            placeholder="Elige una habilidad"
            disabled={noSpecies}
            disabledHint={lockedHint}
            emptyText="Esta especie no tiene más habilidades"
            unknownOption={plainOption}
          />
          <EntityPicker
            label="Objeto"
            value={slot.item}
            options={catalog.itemOptions}
            onSelect={(v) => onPatch({ item: v })}
            placeholder="Sin objeto"
            emptyText={catalog.itemsFailed ? 'No se pudo cargar la lista de objetos' : 'Ningún objeto coincide'}
            loading={catalog.itemsLoading}
            unknownOption={itemOption}
          />
          <EntityPicker
            label="Naturaleza"
            value={slot.nature}
            options={NATURE_OPTIONS}
            onSelect={(v) => onPatch({ nature: v || 'hardy' })}
            placeholder="Elige naturaleza"
            allowClear={false}
            unknownOption={plainOption}
          />
          <EntityPicker
            label="Teratipo"
            value={slot.tera_type}
            options={TERA_OPTIONS}
            onSelect={(v) => onPatch({ tera_type: v })}
            placeholder="Sin teratipo"
            unknownOption={typeOption}
          />
        </div>
      </section>

      <section aria-labelledby={`${fieldId}-moves`}>
        <h4 id={`${fieldId}-moves`} className="builder-subhead">
          Movimientos
          <span className="font-semibold normal-case tracking-normal">
            · {slot.moves.filter(Boolean).length}/4
          </span>
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {slot.moves.map((m, i) => (
            <EntityPicker
              key={i}
              label={`Movimiento ${i + 1}`}
              value={m}
              options={moveOptions}
              onSelect={(v) => {
                const moves = [...slot.moves] as Slot['moves']
                moves[i] = v
                onPatch({ moves })
              }}
              placeholder="Busca un movimiento…"
              disabled={noSpecies}
              disabledHint={lockedHint}
              emptyText="Este Pokémon no aprende ese movimiento"
              unknownOption={moveOption}
            />
          ))}
        </div>
      </section>

      <StatEditor slot={slot} species={species} loading={speciesLoading} onChange={onPatch} />

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCollapse} className="btn btn-ghost btn-sm">
          <ChevronsUp size={15} aria-hidden /> Plegar
        </button>
        {hasNext && (
          <button type="button" onClick={onNext} className="btn btn-soft btn-sm">
            {index < count - 1 ? 'Siguiente Pokémon' : 'Añadir otro Pokémon'}
            <ArrowRight size={15} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
