'use client'

import { use, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check, Plus, Sparkles } from 'lucide-react'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { Skeleton } from '@/components/ui/skeleton'
import type { TeamOption } from '@/components/battle/setup/link'

type PickerProps = {
  value: string | null
  onChange: (id: string | null) => void
  /** Id del texto que nombra el grupo (la leyenda del fieldset). */
  labelledBy: string
  /** Primera opción, la de «ninguno». */
  noneLabel?: string
  noneHint?: string
}

/**
 * Versión para la portada: los equipos llegan como promesa, así la página se
 * pinta ya y la fila aparece en cuanto responde la base de datos.
 */
export function TeamPickerAsync({ teams, ...props }: PickerProps & { teams: Promise<TeamOption[]> }) {
  return <TeamPicker teams={use(teams)} {...props} />
}

/**
 * «¿Con qué equipo juegas?»: fila deslizante de tarjetas con radios nativos
 * (flechas para moverse, espacio para elegir). La opción de «ninguno» va
 * primero y es la que hay por defecto.
 */
export function TeamPicker({
  teams,
  value,
  onChange,
  labelledBy,
  noneLabel = 'Sin equipo',
  noneHint = 'Tus sets se estiman por uso',
}: PickerProps & { teams: TeamOption[] }) {
  const rowRef = useRef<HTMLDivElement>(null)

  // El recordado puede ser un equipo que ya no existe.
  useEffect(() => {
    if (value && !teams.some((t) => t.id === value)) onChange(null)
  }, [value, teams, onChange])

  // Que el elegido se vea sin mover la página en vertical.
  useEffect(() => {
    const row = rowRef.current
    const card = row?.querySelector<HTMLElement>('label:has(input:checked)')
    if (!row || !card) return
    const left = card.offsetLeft - row.offsetLeft
    if (left + card.offsetWidth > row.scrollLeft + row.clientWidth || left < row.scrollLeft) {
      row.scrollLeft = left - 16
    }
    // Al elegir con el dedo ya está a la vista y no se mueve; sí al restaurar el recordado.
  }, [value])

  return (
    <div ref={rowRef} role="radiogroup" aria-labelledby={labelledBy} className="battle-s-teams">
      <label className="battle-s-team">
        <input
          type="radio"
          name="battle-team"
          value=""
          checked={!value}
          onChange={() => onChange(null)}
          className="sr-only"
        />
        <span aria-hidden className="battle-s-team-check">
          <Check size={13} strokeWidth={3} />
        </span>
        <span className="flex items-center gap-1.5 pr-5 text-sm font-semibold">
          <Sparkles aria-hidden size={15} className="text-brand" />
          {noneLabel}
        </span>
        <span className="text-xs leading-snug text-muted">{noneHint}</span>
      </label>

      {teams.map((team) => (
        <label key={team.id} className="battle-s-team">
          <input
            type="radio"
            name="battle-team"
            value={team.id}
            checked={value === team.id}
            onChange={() => onChange(team.id)}
            className="sr-only"
          />
          <span aria-hidden className="battle-s-team-check">
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="truncate pr-5 text-sm font-semibold">{team.name}</span>
          {team.species.length > 0 ? (
            <span role="img" className="battle-s-sprites" aria-label={team.species.join(', ')}>
              {team.species.slice(0, 6).map((s, i) => (
                <ShowdownSprite key={`${s}-${i}`} species={s} size={32} className="-m-1" />
              ))}
            </span>
          ) : (
            <span className="text-xs text-muted">Equipo vacío</span>
          )}
        </label>
      ))}

      {teams.length === 0 && (
        <Link
          href="/team/new"
          className="battle-s-team items-start text-sm font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Plus aria-hidden size={18} />
          Crea tu primer equipo
        </Link>
      )}
    </div>
  )
}

export function TeamPickerSkeleton() {
  return (
    <div aria-hidden className="flex gap-2 overflow-hidden py-1">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[4.75rem] w-[9.5rem] shrink-0 rounded-[0.875rem]" />
      ))}
    </div>
  )
}
