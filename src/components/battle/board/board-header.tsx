'use client'

import clsx from 'clsx'
import { CloudSun, Mountain, RefreshCw, Shield, Hourglass, Wind } from 'lucide-react'
import { turnsLeft } from '@/lib/battle/advice'
import type { BattleFormat } from '@/lib/battle/formats'
import { foe, type BattleState, type SideConditionId, type SideId } from '@/lib/battle/live'
import type { ConnectionStatus } from '@/lib/battle/use-showdown-battle'
import { JargonHints, TERRAIN_LABEL, WEATHER_LABEL } from '@/components/battle/board/parts'

/*
 * Cabecera compacta del tablero: quién juega, en qué turno va y si seguimos
 * conectados, más una fila de chips con lo que afecta a todo el campo.
 */

type Mode = 'live' | 'replay' | 'manual'

export type BoardConnection = { status: ConnectionStatus; error: string | null; retry: () => void }

type Chip = {
  key: string
  tone?: 'good' | 'warning' | 'danger'
  icon: React.ReactNode
  label: string
  /** Turnos que quedan (se pinta en un círculo). */
  left?: number
  /** Descripción completa para lectores de pantalla y el title. */
  title: string
  jargon?: string
}

const SCREENS: { id: SideConditionId; label: string }[] = [
  { id: 'reflect', label: 'Reflejo' },
  { id: 'lightscreen', label: 'Pantalla de Luz' },
  { id: 'auroraveil', label: 'Velo Aurora' },
]

/** Lo que hay en el campo ahora mismo, como chips ordenados por importancia. */
export function fieldChips(state: BattleState, me: SideId): Chip[] {
  const chips: Chip[] = []
  const turn = state.turn
  const them = foe(me)
  const left = (n: number) => (n === 1 ? 'último turno' : `quedan ${n} turnos`)

  if (state.field.trickRoom !== null) {
    const n = turnsLeft(state.field.trickRoom, 5, turn)
    chips.push({
      key: 'tr', tone: 'warning', icon: <Hourglass size={14} aria-hidden />, label: 'Espacio Raro', left: n,
      title: `Espacio Raro: los lentos van primero, ${left(n)}`, jargon: 'trickroom',
    })
  }
  for (const [side, whose] of [[me, 'Tu'], [them, 'Su']] as const) {
    const since = state.sides[side].conditions.tailwind
    if (since === undefined) continue
    const n = turnsLeft(since, 4, turn)
    chips.push({
      key: `tw-${side}`, tone: side === me ? 'good' : 'danger', icon: <Wind size={14} aria-hidden />,
      label: `${whose} Viento Afín`, left: n,
      title: `${whose} Viento Afín: velocidad doble, ${left(n)}`, jargon: 'tailwind',
    })
  }
  if (state.field.weather) {
    const name = WEATHER_LABEL[state.field.weather] ?? state.field.weather
    chips.push({ key: 'weather', icon: <CloudSun size={14} aria-hidden />, label: name, title: `Clima: ${name}` })
  }
  if (state.field.terrain) {
    const name = TERRAIN_LABEL[state.field.terrain] ?? `Campo ${state.field.terrain}`
    chips.push({ key: 'terrain', icon: <Mountain size={14} aria-hidden />, label: name, title: name })
  }
  for (const [side, whose] of [[me, 'tuyo'], [them, 'suyo']] as const) {
    for (const screen of SCREENS) {
      const since = state.sides[side].conditions[screen.id]
      if (since === undefined) continue
      // 5 turnos, salvo con Light Clay, que las alarga a 8: por eso el "aprox." del title.
      const n = turnsLeft(since, 5, turn)
      chips.push({
        key: `${screen.id}-${side}`, tone: side === me ? 'good' : 'warning', icon: <Shield size={14} aria-hidden />,
        label: `${screen.label} (${whose})`, left: n,
        title: `${screen.label} del lado ${whose}: reduce el daño que recibe, ${left(n)} aprox.`, jargon: 'screens',
      })
    }
  }
  return chips
}

function ConnectionPill({ mode, connection, ended }: { mode: Mode; connection?: BoardConnection; ended: boolean }) {
  const base = 'inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-bold'
  if (mode === 'replay') return <span className={clsx(base, 'bg-surface-2 text-muted')}>Repetición</span>
  if (mode === 'manual') return <span className={clsx(base, 'bg-surface-2 text-muted')}>Modo manual</span>
  if (!connection) return null
  const { status, error, retry } = connection

  if (status === 'live' && !ended) {
    return (
      <span className={clsx(base, 'bg-danger-soft text-danger')}>
        <span className="battle-live-dot" aria-hidden />
        En directo
      </span>
    )
  }
  if (status === 'connecting' || status === 'reconnecting') {
    return (
      <span role="status" className={clsx(base, 'bg-warning-soft text-warning')}>
        <RefreshCw size={13} aria-hidden className="animate-spin motion-reduce:animate-none" />
        {status === 'connecting' ? 'Conectando…' : 'Reconectando…'}
      </span>
    )
  }
  if (error || status === 'unavailable') {
    return (
      <button
        type="button"
        onClick={retry}
        className={clsx(base, 'min-h-11 bg-danger-soft text-danger transition-colors hover:bg-danger hover:text-white')}
      >
        <RefreshCw size={13} aria-hidden />
        Sin conexión · Reintentar
      </button>
    )
  }
  return <span className={clsx(base, 'bg-surface-2 text-muted')}>{ended ? 'Terminado' : 'Desconectado'}</span>
}

export function BoardHeader({
  state,
  format,
  me,
  mySide,
  mode,
  connection,
  teamName,
}: {
  state: BattleState
  format: BattleFormat
  me: SideId
  mySide: SideId | null
  mode: Mode
  connection?: BoardConnection
  teamName?: string
}) {
  const chips = state.phase === 'battle' ? fieldChips(state, me) : []
  const them = foe(me)
  const turnLabel =
    state.phase === 'preview'
      ? 'Vista previa'
      : state.phase === 'ended'
        ? 'Final'
        : state.phase === 'battle'
          ? state.turn > 0
            ? `Turno ${state.turn}`
            : 'Salida'
          : '—'

  const player = (side: SideId) => {
    const s = state.sides[side]
    const isMe = mySide === side
    const role = isMe ? 'Tú' : mySide ? 'Rival' : side === 'p1' ? 'Jugador 1' : 'Jugador 2'
    return (
      <div className={clsx('min-w-0', side === them && 'text-right')}>
        {/* En modo manual los nombres ya son «Tú» y «Rival»: no se repiten. */}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.name === role ? '\u00a0' : role}</p>
        <p className={clsx('truncate text-[15px] font-bold leading-tight', isMe && 'text-brand')}>
          {s.name || '…'}
          {s.rating ? <span className="ml-1 text-xs font-semibold text-muted">({s.rating})</span> : null}
        </p>
      </div>
    )
  }

  return (
    <header className="card p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">
          {format.short}
          {teamName && (
            <>
              <span aria-hidden> · </span>
              <span className="sr-only">, equipo: </span>
              {teamName}
            </>
          )}
        </p>
        <ConnectionPill mode={mode} connection={connection} ended={state.phase === 'ended'} />
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        {player(me)}
        <p
          className="rounded-full bg-surface-2 px-3 py-1.5 text-center text-sm font-bold tabular-nums shadow-card"
          aria-live="polite"
        >
          {turnLabel}
        </p>
        {player(them)}
      </div>

      {chips.length > 0 && (
        <ul
          aria-label="Efectos en el campo"
          className="no-scrollbar -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 sm:-mx-4 sm:px-4"
        >
          {chips.map((chip) => (
            <li key={chip.key} className="battle-chip" data-tone={chip.tone} title={chip.title}>
              {chip.icon}
              <span aria-hidden>{chip.label}</span>
              {chip.left !== undefined && (
                <span className="battle-chip-count" aria-hidden>
                  <span>{chip.left}</span>
                </span>
              )}
              <span className="sr-only">{chip.title}</span>
            </li>
          ))}
        </ul>
      )}
      {chips.length > 0 && (
        <JargonHints
          className="mt-2"
          keys={[...new Set(chips.map((c) => c.jargon).filter((k): k is string => Boolean(k)))]}
        />
      )}
    </header>
  )
}
