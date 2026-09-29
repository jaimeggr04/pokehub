'use client'

import clsx from 'clsx'
import { ChevronDown, ScrollText } from 'lucide-react'
import type { LogEntry, SideId } from '@/lib/battle/live'

/*
 * Registro de lo que ha pasado, plegado por defecto: casi nunca hace falta,
 * pero cuando algo no cuadra ("¿quién ha usado eso?") está a un toque. Lo
 * más reciente arriba y agrupado por turnos.
 */
export function BattleLog({ log, me }: { log: LogEntry[]; me: SideId }) {
  const byTurn = new Map<number, LogEntry[]>()
  for (const entry of log) {
    const list = byTurn.get(entry.turn) ?? []
    list.push(entry)
    byTurn.set(entry.turn, list)
  }
  const turns = [...byTurn.entries()].sort((a, b) => b[0] - a[0])

  return (
    <details className="battle-fold card">
      <summary>
        <ScrollText aria-hidden size={18} className="text-brand" />
        Registro del combate
        <span className="text-sm font-normal text-muted">({log.length})</span>
        <ChevronDown aria-hidden size={18} className="battle-fold-chevron" />
      </summary>
      <div className="max-h-80 overflow-y-auto overscroll-contain px-4 pb-4">
        {turns.length === 0 && <p className="text-sm text-muted">Aún no ha pasado nada.</p>}
        {turns.map(([turn, entries]) => (
          <section key={turn} className="border-t border-line py-2 first:border-t-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              {turn === 0 ? 'Inicio' : `Turno ${turn}`}
            </h3>
            <ul className="mt-1 space-y-0.5">
              {entries.map((entry, i) => (
                <li
                  key={i}
                  className={clsx(
                    'border-l-2 pl-2 text-sm leading-snug',
                    !entry.side ? 'border-transparent font-semibold' : entry.side === me ? 'border-brand' : 'border-danger',
                  )}
                >
                  {entry.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  )
}
