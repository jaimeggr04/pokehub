'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { Flag, Trophy } from 'lucide-react'
import { foe, type BattleState, type SideId } from '@/lib/battle/live'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { formatPct } from '@/components/battle/board/parts'

/*
 * Fin de la partida: el resultado en grande y un resumen corto de cómo han
 * quedado los equipos, para cerrar el círculo antes de la siguiente.
 */
export function BattleResult({
  state,
  mySide,
  me,
  mode,
}: {
  state: BattleState
  mySide: SideId | null
  me: SideId
  mode: 'live' | 'replay' | 'manual'
}) {
  const them = foe(me)
  const winnerSide = (['p1', 'p2'] as const).find((s) => state.winner && state.sides[s].name === state.winner) ?? null
  const outcome = !state.winner ? 'tie' : !mySide ? 'neutral' : winnerSide === mySide ? 'win' : 'loss'

  const title =
    outcome === 'win'
      ? '¡Has ganado!'
      : outcome === 'loss'
        ? 'Has perdido'
        : outcome === 'tie'
          ? 'Empate'
          : `Gana ${state.winner}`
  const turns = state.turn === 1 ? '1 turno' : `${state.turn} turnos`
  const subtitle =
    outcome === 'win'
      ? `Contra ${state.sides[them].name || 'tu rival'}, en ${turns}.`
      : outcome === 'loss'
        ? `Gana ${state.winner} en ${turns}. ¡A por la revancha!`
        : `En ${turns}.`

  const summary = (side: SideId) => {
    const team = state.sides[side].team
    const played = team.filter((m) => m.brought)
    const list = played.length ? played : team
    const standing = list.filter((m) => !m.fainted).length
    return { list, standing }
  }

  const row = (side: SideId, label: string) => {
    const { list, standing } = summary(side)
    return (
      <div className="min-w-0">
        <p className={clsx('text-sm font-bold', side === me ? 'text-brand' : 'text-danger')}>
          {label} · {standing === 1 ? 'queda 1 en pie' : `quedan ${standing} en pie`}
        </p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {list.map((m, i) => (
            <li
              key={`${m.species}-${i}`}
              className={clsx('flex w-[4.5rem] flex-col items-center rounded-xl bg-bg-elevated py-1', m.fainted && 'opacity-50 grayscale')}
            >
              <ShowdownSprite species={m.species} size={44} flip={side !== me} />
              <span className="w-full truncate px-1 text-center text-xs font-semibold">{m.species}</span>
              <span className={clsx('text-xs tabular-nums', m.fainted ? 'text-danger' : 'text-muted')}>
                {m.fainted ? 'Fuera' : m.hp !== null ? formatPct(m.hp) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className="battle-result p-4 text-center sm:p-6" data-outcome={outcome} aria-labelledby="result-title">
      <span
        aria-hidden
        className={clsx(
          'mx-auto grid size-16 animate-pop place-items-center rounded-full',
          outcome === 'win' ? 'bg-success text-white' : outcome === 'loss' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink',
        )}
      >
        {outcome === 'win' ? <Trophy size={30} /> : <Flag size={28} />}
      </span>
      <h2 id="result-title" className="mt-3 text-2xl font-bold" aria-live="polite">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="mt-4 grid gap-4 text-left sm:grid-cols-2">
        {row(me, mySide ? 'Tu equipo' : state.sides[me].name || 'Jugador 1')}
        {row(them, mySide ? 'Su equipo' : state.sides[them].name || 'Jugador 2')}
      </div>

      {mode !== 'replay' && (
        <Link href="/battle" className="btn btn-primary mt-5">
          Seguir otra partida
        </Link>
      )}
    </section>
  )
}
