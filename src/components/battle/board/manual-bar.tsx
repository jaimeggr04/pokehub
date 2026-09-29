'use client'

import clsx from 'clsx'
import { ChevronRight, Hourglass, Wind } from 'lucide-react'
import { foe, type BattleState, type SideId } from '@/lib/battle/live'
import { nextTurn, setField, toggleSideCondition } from '@/lib/battle/manual'

/*
 * Controles del modo manual: lo que el usuario ve en su pantalla y el
 * asistente no puede leer solo. Botones grandes y pocos, porque se tocan
 * entre turno y turno con el reloj corriendo.
 */
export function ManualBar({
  state,
  me,
  setState,
}: {
  state: BattleState
  me: SideId
  setState: (update: (s: BattleState) => BattleState) => void
}) {
  const them = foe(me)
  const toggles = [
    {
      key: 'tr',
      label: 'Espacio Raro',
      icon: <Hourglass aria-hidden size={15} />,
      on: state.field.trickRoom !== null,
      toggle: (on: boolean) => setState((s) => setField(s, { trickRoom: on })),
    },
    {
      key: 'tw-me',
      label: 'Tu Viento Afín',
      icon: <Wind aria-hidden size={15} />,
      on: state.sides[me].conditions.tailwind !== undefined,
      toggle: (on: boolean) => setState((s) => toggleSideCondition(s, me, 'tailwind', on)),
    },
    {
      key: 'tw-them',
      label: 'Su Viento Afín',
      icon: <Wind aria-hidden size={15} />,
      on: state.sides[them].conditions.tailwind !== undefined,
      toggle: (on: boolean) => setState((s) => toggleSideCondition(s, them, 'tailwind', on)),
    },
  ]

  return (
    <section aria-label="Controles del modo manual" className="card p-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Cuando acabe el turno en Showdown, pasa al siguiente aquí.
        </p>
        <button type="button" onClick={() => setState(nextTurn)} className="btn btn-primary shrink-0">
          Turno {state.turn + 1}
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>
      <ul className="no-scrollbar -mx-3 mt-2 flex gap-2 overflow-x-auto px-3">
        {toggles.map((t) => (
          <li key={t.key} className="shrink-0">
            <button
              type="button"
              aria-pressed={t.on}
              onClick={() => t.toggle(!t.on)}
              className={clsx(
                'pressable inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                t.on ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-surface-2 text-ink hover:border-brand',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
