'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { ArrowLeftRight, Plus } from 'lucide-react'
import type { MonProfile } from '@/lib/battle/advice'
import type { BattleState, MonState, SideId } from '@/lib/battle/live'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { BoostTags, HpBar, MegaTag, StatusTag, formatPct } from '@/components/battle/board/parts'

/*
 * El campo como en la pantalla de combate: los activos del rival arriba y
 * los tuyos abajo. Cada tarjeta se toca entera para abrir su ficha; en modo
 * manual lleva además un botón para cambiar quién ocupa el hueco.
 */

const SLOT_NAMES = ['izquierdo', 'derecho', 'central']

function knownItemLine(mon: MonState) {
  if (typeof mon.item === 'string') return mon.item
  if (mon.lostItem) return `Sin objeto (gastó ${mon.lostItem})`
  return null
}

export function MonCard({
  mon,
  profile,
  side,
  onOpen,
  compact = false,
  className,
}: {
  mon: MonState
  profile?: MonProfile
  side: 'mine' | 'theirs'
  onOpen: () => void
  compact?: boolean
  className?: string
}) {
  const item = knownItemLine(mon)
  // Del rival, lo que se ha visto; de los tuyos lo sabes tú, así que se omite.
  const guess = side === 'theirs' && !item && mon.item === undefined ? profile?.items[0] : undefined

  return (
    <button
      type="button"
      onClick={onOpen}
      data-side={side}
      data-fainted={mon.fainted}
      className={clsx('battle-mon pressable card-hover', className)}
    >
      {/* Sin aria-label: así el lector lee también la vida, el estado y los cambios. */}
      <span className="flex min-w-0 items-center gap-2">
        <ShowdownSprite
          species={mon.species}
          size={compact ? 44 : 52}
          flip={side === 'theirs'}
          className="-my-1 -ml-1 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-tight">
            {mon.species}
            <span className="sr-only">{side === 'theirs' ? ' del rival' : ' (tuyo)'}. Abrir ficha.</span>
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {mon.mega && <MegaTag />}
            <StatusTag status={mon.status} />
          </span>
        </span>
      </span>
      <HpBar hp={mon.hp} fainted={mon.fainted} />
      <BoostTags boosts={mon.boosts} />
      {!compact && (item || guess) && (
        <span className="truncate text-xs text-muted">
          {item ? (
            <>
              <span className="sr-only">Objeto: </span>
              {item}
            </>
          ) : guess ? (
            <>Objeto probable: {guess.name} ({formatPct(guess.pct)})</>
          ) : null}
        </span>
      )}
    </button>
  )
}

function SlotPicker({
  open,
  onClose,
  side,
  slot,
  state,
  whose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  side: SideId
  slot: number
  state: BattleState
  whose: string
  onPick: (index: number | null) => void
}) {
  const s = state.sides[side]
  const slots = state.gameType === 'doubles' ? 2 : 1
  const current = s.active[slot]
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      showTitle
      title={slots > 1 ? `¿Quién está en el hueco ${SLOT_NAMES[slot]} ${whose}?` : `¿Quién está en el campo ${whose}?`}
    >
      <ul className="grid grid-cols-2 gap-2">
        {s.team.map((mon, index) => {
          const elsewhere = s.active.some((a, i) => i !== slot && a === index)
          const disabled = mon.fainted || elsewhere
          return (
            <li key={index}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={current === index}
                onClick={() => onPick(index)}
                className={clsx(
                  'pressable flex min-h-16 w-full items-center gap-2 rounded-xl border p-2 text-left disabled:opacity-45',
                  current === index ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2',
                )}
              >
                <ShowdownSprite species={mon.species} size={44} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{mon.species}</span>
                  <span className="block text-xs text-muted">
                    {mon.fainted ? 'Debilitado' : elsewhere ? 'Ya está en el campo' : mon.hp !== null ? formatPct(mon.hp) : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {current !== null && current !== undefined && (
        <button type="button" onClick={() => onPick(null)} className="btn btn-ghost mt-3 w-full">
          Dejar el hueco vacío
        </button>
      )}
    </BottomSheet>
  )
}

function SideRow({
  state,
  side,
  whose,
  profiles,
  onOpen,
  manual,
}: {
  state: BattleState
  side: SideId
  whose: 'mine' | 'theirs'
  profiles: MonProfile[]
  onOpen: (index: number) => void
  manual?: { onPick: (slot: number, index: number | null) => void }
}) {
  const [picking, setPicking] = useState<number | null>(null)
  const slots = state.gameType === 'doubles' ? 2 : 1
  const s = state.sides[side]
  const whoseText = whose === 'mine' ? 'tuyo' : 'del rival'

  return (
    <ul className={clsx('grid gap-2', slots > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
      {Array.from({ length: slots }, (_, slot) => {
        const index = s.active[slot]
        const mon = index !== null && index !== undefined ? s.team[index] : undefined
        return (
          <li key={slot} className="relative min-w-0">
            {mon && index !== null && index !== undefined ? (
              <MonCard
                mon={mon}
                profile={profiles[index]}
                side={whose}
                onOpen={() => onOpen(index)}
                className={manual ? 'pr-11' : undefined}
              />
            ) : manual ? (
              <button
                type="button"
                onClick={() => setPicking(slot)}
                className="battle-slot-empty pressable hover:border-brand hover:text-brand"
              >
                <span className="flex flex-col items-center gap-1">
                  <Plus aria-hidden size={20} />
                  Elegir Pokémon
                </span>
              </button>
            ) : (
              <div className="battle-slot-empty">Hueco vacío</div>
            )}
            {manual && mon && (
              <button
                type="button"
                onClick={() => setPicking(slot)}
                aria-label={`Cambiar el Pokémon del hueco ${SLOT_NAMES[slot]} ${whoseText}`}
                className="absolute right-0 top-0 grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <ArrowLeftRight aria-hidden size={16} />
              </button>
            )}
          </li>
        )
      })}
      {manual && picking !== null && (
        <SlotPicker
          open
          onClose={() => setPicking(null)}
          side={side}
          slot={picking}
          state={state}
          whose={whoseText}
          onPick={(index) => {
            manual.onPick(picking, index)
            setPicking(null)
          }}
        />
      )}
    </ul>
  )
}

export function FieldView({
  state,
  me,
  profiles,
  onOpen,
  manual,
  names,
}: {
  state: BattleState
  me: SideId
  profiles: Record<SideId, MonProfile[]>
  onOpen: (side: SideId, index: number) => void
  manual?: { onPick: (side: SideId, slot: number, index: number | null) => void }
  names: { mine: string; theirs: string }
}) {
  const them: SideId = me === 'p1' ? 'p2' : 'p1'
  return (
    <div className="battle-arena space-y-2 p-2.5 sm:p-3">
      <p className="px-1 text-xs font-bold uppercase tracking-wide text-danger">{names.theirs}</p>
      <SideRow
        state={state}
        side={them}
        whose="theirs"
        profiles={profiles[them]}
        onOpen={(i) => onOpen(them, i)}
        manual={manual && { onPick: (slot, index) => manual.onPick(them, slot, index) }}
      />
      <p className="battle-arena-divider py-1" aria-hidden>
        vs
      </p>
      <SideRow
        state={state}
        side={me}
        whose="mine"
        profiles={profiles[me]}
        onOpen={(i) => onOpen(me, i)}
        manual={manual && { onPick: (slot, index) => manual.onPick(me, slot, index) }}
      />
      <p className="px-1 text-xs font-bold uppercase tracking-wide text-brand">{names.mine}</p>
    </div>
  )
}
