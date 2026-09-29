'use client'

import clsx from 'clsx'
import { ItemIcon } from '@/components/pokemon-details'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import type { MonProfile } from '@/lib/battle/advice'
import { HpBar, StatusChip, hpOf, itemSlug } from './shared'

/*
 * Los seis de un lado en una rejilla compacta. Cada casilla es un botón que
 * abre la ficha: sprite, vida y lo que se ha revelado (objeto y cuántos
 * ataques). Se distingue de un vistazo quién está en el campo, quién ha caído
 * y quién no ha salido todavía.
 */

export function TeamRoster({
  profiles,
  side,
  activeIndexes,
  onSelect,
}: {
  profiles: MonProfile[]
  side: 'mine' | 'theirs'
  activeIndexes: number[]
  onSelect: (index: number) => void
}) {
  const theirs = side === 'theirs'
  return (
    <ul className="grid grid-cols-3 gap-1.5" aria-label={theirs ? 'Equipo rival' : 'Tu equipo'}>
      {profiles.map((p, i) => {
        const state = p.state
        const fainted = Boolean(state?.fainted)
        const active = activeIndexes.includes(i)
        // Sólo tiene sentido marcar "sin salir" cuando ya ha salido alguno (en la vista previa, ninguno ha salido).
        const unseen = Boolean(state) && !state?.brought && !active && profiles.some((x) => x.state?.brought)
        const hp = hpOf(p)
        const item = typeof state?.item === 'string' ? state.item : null
        const seenMoves = state?.moves.length ?? 0
        const statusText = fainted ? 'debilitado' : active ? 'en el campo' : unseen ? 'aún no ha salido' : `${Math.round(hp)} % de vida`

        return (
          <li key={`${p.species}-${i}`}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              className="battle-d-roster pressable"
              data-active={active || undefined}
              data-fainted={fainted || undefined}
              data-unseen={unseen || undefined}
              data-side={side}
              aria-label={`${p.species}, ${statusText}${item ? `, lleva ${item}` : ''}${
                seenMoves ? `, ${seenMoves} ${seenMoves === 1 ? 'ataque visto' : 'ataques vistos'}` : ''
              }. Abrir ficha`}
            >
              {active && <span className="battle-d-roster-live">En campo</span>}
              {fainted && <span className="battle-d-roster-ko">KO</span>}
              <span className="relative">
                <ShowdownSprite species={p.species} size={44} flip={theirs} className={clsx(fainted && 'grayscale')} />
                {(item || state?.lostItem) && (
                  <span className={clsx('battle-d-roster-item', !item && 'opacity-50')}>
                    <ItemIcon item={itemSlug(item ?? state?.lostItem)} size="sm" />
                  </span>
                )}
              </span>
              <span className="block w-full truncate text-[11px] font-semibold leading-tight">{p.species}</span>
              <HpBar hp={hp} thin className="w-full" label={`Vida de ${p.species}`} />
              <span className="flex h-4 items-center gap-1" aria-hidden>
                <StatusChip status={state?.status} className="!h-4 !px-1 !text-[9px]" />
                {theirs &&
                  !unseen &&
                  Array.from({ length: 4 }, (_, k) => (
                    <span key={k} className="battle-d-roster-pip" data-on={k < seenMoves || undefined} />
                  ))}
                {unseen && <span className="text-[10px] text-muted">Sin salir</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
