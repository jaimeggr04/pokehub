'use client'

import { Eye } from 'lucide-react'
import type { BattleState, SideId } from '@/lib/battle/live'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'

/*
 * «¿Cuál eres tú?»: sin saber tu lado no hay consejos que valgan, así que la
 * pregunta va arriba del todo, con los nombres tal como salen en Showdown y
 * parte de cada equipo para reconocerse de un vistazo.
 */
export function SidePicker({ state, onChoose }: { state: BattleState; onChoose: (side: SideId) => void }) {
  const option = (side: SideId) => {
    const s = state.sides[side]
    return (
      <button
        type="button"
        onClick={() => onChoose(side)}
        className="pressable flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-line bg-bg-elevated px-3 py-2 text-left shadow-card transition-colors hover:border-brand focus-visible:border-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted">Soy</span>
          <span className="block truncate text-base font-bold">{s.name || (side === 'p1' ? 'Jugador 1' : 'Jugador 2')}</span>
        </span>
        <span aria-hidden className="flex shrink-0 -space-x-4">
          {s.team.slice(0, 3).map((m, i) => (
            <ShowdownSprite key={`${m.species}-${i}`} species={m.species} size={40} />
          ))}
        </span>
      </button>
    )
  }

  return (
    <section
      aria-labelledby="side-picker-title"
      className="animate-fade-up rounded-card border-2 border-brand bg-brand-soft p-4 shadow-card"
    >
      <h2 id="side-picker-title" className="text-lg font-bold leading-tight">
        ¿Cuál eres tú?
      </h2>
      <p className="mt-1 text-sm text-muted">Así sabremos qué equipo es el tuyo y a quién dar los consejos.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {option('p1')}
        {option('p2')}
      </div>
      <button type="button" onClick={() => onChoose('p1')} className="btn btn-ghost mt-2 w-full">
        <Eye aria-hidden size={16} />
        Sólo miro: ver como espectador
      </button>
    </section>
  )
}
