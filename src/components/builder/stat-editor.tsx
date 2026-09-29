'use client'

import { memo, useId } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { NumberField } from '@/components/builder/fields'
import { NO_EVS, STAT_TINTS, evsLeft, natureShift, type Slot, type SlotPatch } from '@/components/builder/model'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MAX_EV, MAX_EVS_TOTAL, MAX_IV, STAT_KEYS, STAT_LABELS, STAT_NAMES_ES, computeStat, evTotal, type StatKey,
} from '@/lib/pokemon'
import type { PokemonDetail } from '@/lib/pokeapi'

type Props = {
  slot: Pick<Slot, 'ivs' | 'evs' | 'level' | 'nature'>
  species: PokemonDetail | null
  /** La especie se está descargando: esqueleto en los totales en vez de "—". */
  loading: boolean
  onChange: (changes: SlotPatch) => void
}

/**
 * IVs, EVs y estadísticas finales en vivo. Cada slider va tintado con el color
 * de su estadística y marca en rojo la parte que ya no cabe en los 508 EVs: no
 * se bloquea (hay que poder redistribuir), pero se ve antes de pasarse.
 */
export const StatEditor = memo(function StatEditor({ slot, species, loading, onChange }: Props) {
  const used = evTotal(slot.evs)
  const left = evsLeft(slot)
  const over = left < 0
  const { up, down } = natureShift(slot.nature)
  const budgetId = useId()
  // Si se pasa del máximo, la barra se escala al total para que quepan todos los tramos.
  const scale = Math.max(MAX_EVS_TOTAL, used)

  return (
    <section aria-label="Estadísticas" className="rounded-2xl bg-surface-2 p-3 shadow-pressed sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h4 className="builder-subhead mb-0">Estadísticas</h4>
        <div className="flex items-center gap-2">
          <p
            id={budgetId}
            aria-live="polite"
            className={clsx('text-xs font-semibold tabular-nums', over ? 'text-danger' : 'text-muted')}
          >
            {used}/{MAX_EVS_TOTAL} EVs ·{' '}
            {over ? `sobran ${-left}` : left === 0 ? 'repartidos' : `quedan ${left}`}
          </p>
          <button
            type="button"
            onClick={() => onChange({ evs: { ...NO_EVS } })}
            disabled={used === 0}
            className="btn btn-ghost btn-sm h-8 px-2.5 text-xs text-muted"
          >
            <RotateCcw size={13} aria-hidden /> Reiniciar EVs
          </button>
        </div>
      </div>

      <div
        className="builder-ev-budget mb-4"
        data-over={over || undefined}
        role="img"
        aria-label={`Reparto de EVs: ${STAT_KEYS.filter((k) => slot.evs[k] > 0)
          .map((k) => `${slot.evs[k]} en ${STAT_NAMES_ES[k]}`)
          .join(', ') || 'ninguno'}`}
      >
        {STAT_KEYS.map((k) => (
          <span
            key={k}
            style={{ flexBasis: `${(slot.evs[k] / scale) * 100}%`, '--tint': STAT_TINTS[k] } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Cabecera sólo visual: cada campo ya lleva su propio nombre accesible. */}
      <div aria-hidden className="builder-stat-row mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        <span style={{ gridArea: 'label' }}>Estadística</span>
        <span style={{ gridArea: 'iv' }} className="text-center">IV</span>
        <span style={{ gridArea: 'range' }} className="max-sm:hidden">Reparto de EVs</span>
        <span style={{ gridArea: 'ev' }} className="text-center">EVs</span>
        <span style={{ gridArea: 'total' }} className="text-right">Total</span>
      </div>

      <ul className="space-y-2.5 sm:space-y-1.5">
        {STAT_KEYS.map((k) => (
          <StatRow
            key={k}
            stat={k}
            iv={slot.ivs[k]}
            ev={slot.evs[k]}
            left={left}
            boosted={up === k}
            lowered={down === k}
            base={species?.baseStats[k] ?? null}
            total={
              species
                ? computeStat(k, species.baseStats[k], slot.ivs[k], slot.evs[k], slot.level, slot.nature)
                : null
            }
            loading={loading}
            budgetId={budgetId}
            onIv={(v) => onChange({ ivs: { ...slot.ivs, [k]: v } })}
            onEv={(v) => onChange({ evs: { ...slot.evs, [k]: v } })}
          />
        ))}
      </ul>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <ChevronUp size={13} strokeWidth={3} aria-hidden className="builder-nature-up" /> Sube por la naturaleza
        </span>
        <span className="inline-flex items-center gap-1">
          <ChevronDown size={13} strokeWidth={3} aria-hidden className="builder-nature-down" /> Baja por la naturaleza
        </span>
      </p>
    </section>
  )
})

function StatRow({
  stat,
  iv,
  ev,
  left,
  boosted,
  lowered,
  base,
  total,
  loading,
  budgetId,
  onIv,
  onEv,
}: {
  stat: StatKey
  iv: number
  ev: number
  left: number
  boosted: boolean
  lowered: boolean
  base: number | null
  total: number | null
  loading: boolean
  budgetId: string
  onIv: (v: number) => void
  onEv: (v: number) => void
}) {
  const name = STAT_NAMES_ES[stat]
  // Hasta dónde puede subir este slider sin pasarse de 508 (en % del recorrido).
  const cap = Math.min(100, Math.max(0, ((ev + left) / MAX_EV) * 100))
  const natureNote = boosted ? ', sube por la naturaleza' : lowered ? ', baja por la naturaleza' : ''

  return (
    <li className="builder-stat-row gap-y-0.5">
      <span style={{ gridArea: 'label' }} className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STAT_TINTS[stat] }}
        />
        <span
          title={name}
          className={clsx(
            'inline-flex items-center text-xs font-extrabold',
            boosted && 'builder-nature-up',
            lowered && 'builder-nature-down',
          )}
        >
          {STAT_LABELS[stat]}
          {boosted && <ChevronUp size={13} strokeWidth={3} aria-hidden />}
          {lowered && <ChevronDown size={13} strokeWidth={3} aria-hidden />}
          <span className="sr-only">
            {' '}({name}{natureNote})
          </span>
        </span>
        {base !== null && (
          <span className="truncate text-[10px] font-semibold tabular-nums text-muted">
            <span className="sr-only">, </span>base {base}
          </span>
        )}
      </span>

      <NumberField
        value={iv}
        min={0}
        max={MAX_IV}
        fallback={MAX_IV}
        onCommit={onIv}
        aria-label={`IV de ${name}`}
        className="h-8 px-1 text-xs [grid-area:iv]"
      />

      <input
        type="range"
        min={0}
        max={MAX_EV}
        step={4}
        value={ev}
        onChange={(e) => onEv(Number(e.target.value))}
        aria-label={`EVs de ${name}`}
        aria-valuetext={`${ev} EVs`}
        aria-describedby={budgetId}
        className="builder-range [grid-area:range]"
        style={
          {
            '--tint': STAT_TINTS[stat],
            '--fill': `${(ev / MAX_EV) * 100}%`,
            '--cap': `${cap}%`,
          } as React.CSSProperties
        }
      />

      <NumberField
        value={ev}
        min={0}
        max={MAX_EV}
        fallback={0}
        step={4}
        onCommit={onEv}
        aria-label={`EVs de ${name} (número)`}
        className="h-8 px-1 text-xs [grid-area:ev]"
      />

      <span style={{ gridArea: 'total' }} className="text-right">
        {total !== null ? (
          <span
            className={clsx(
              'text-sm font-extrabold tabular-nums',
              boosted && 'builder-nature-up',
              lowered && 'builder-nature-down',
            )}
          >
            <span className="sr-only">{name} final: </span>
            {total}
          </span>
        ) : loading ? (
          <Skeleton className="ml-auto h-4 w-8 rounded-md" />
        ) : (
          <span className="text-sm font-bold text-muted" aria-label="Sin especie">
            —
          </span>
        )}
      </span>
    </li>
  )
}
