'use client'

import clsx from 'clsx'
import { Flag, Play, Skull, Users } from 'lucide-react'
import type { MonProfile, PreviewPlan } from '@/lib/battle/advice'
import type { SideId } from '@/lib/battle/live'
import { toID } from '@/lib/battle/dex'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { JargonHints, SectionTitle } from '@/components/battle/board/parts'
import { TipList } from '@/components/battle/board/tip-list'

/*
 * Vista previa: antes del primer turno sólo hay una decisión, qué traer y
 * con quién abrir. El plan va primero y en grande; los equipos completos,
 * debajo, para tocar y ver la ficha de cada uno.
 */

function TeamStrip({
  title,
  profiles,
  side,
  onOpen,
  highlight,
}: {
  title: string
  profiles: MonProfile[]
  side: 'mine' | 'theirs'
  onOpen: (index: number) => void
  highlight?: Set<string>
}) {
  return (
    <section className="card p-3">
      <h3 className={clsx('mb-1 text-sm font-bold', side === 'theirs' ? 'text-danger' : 'text-brand')}>{title}</h3>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {profiles.map((p, i) => {
          const picked = highlight?.has(toID(p.species))
          return (
            <li key={`${p.species}-${i}`}>
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`${p.species}: ver ficha${picked ? ' (recomendado traerlo)' : ''}`}
                className={clsx(
                  'pressable flex min-h-11 w-full flex-col items-center rounded-xl px-1 pb-1.5 pt-0.5 transition-colors hover:bg-surface-2',
                  picked && 'bg-brand-soft',
                )}
              >
                <ShowdownSprite species={p.species} size={56} flip={side === 'theirs'} />
                <span className="w-full truncate text-center text-xs font-semibold">{p.species}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function PreviewPanel({
  plan,
  mine,
  theirs,
  me,
  onOpen,
  usageLoading,
  usageFailed,
  doubles,
  calcButton,
  onStart,
}: {
  plan: PreviewPlan
  mine: MonProfile[]
  theirs: MonProfile[]
  me: SideId
  onOpen: (side: SideId, index: number) => void
  usageLoading: boolean
  usageFailed: boolean
  doubles: boolean
  /** Botón de la calculadora, junto a los equipos. */
  calcButton?: React.ReactNode
  /** Sólo en modo manual: pasar al combate. */
  onStart?: () => void
}) {
  const them: SideId = me === 'p1' ? 'p2' : 'p1'
  const bringAll = plan.bringCount >= mine.length
  const brought = plan.picks.slice(0, plan.bringCount)
  const bench = plan.picks.slice(plan.bringCount)
  const leads = new Set(plan.leads.map(toID))
  const pickedIds = new Set(brought.map((p) => toID(p.species)))
  const leadText = plan.leads.join(' y ')

  return (
    <div className="space-y-3">
      <JargonHints keys={['preview', 'usage']} />

      {usageLoading && (
        <p role="status" className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-muted">
          Cargando estadísticas de uso para afinar el plan…
        </p>
      )}
      {usageFailed && !usageLoading && (
        <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
          No hemos podido cargar las estadísticas de uso: el plan se basa sólo en los Pokémon, sin adivinar sus sets.
        </p>
      )}

      {/* El plan: lo único que hay que decidir ahora. */}
      <section className="battle-plan p-4" aria-labelledby="plan-title">
        <p className="text-xs font-bold uppercase tracking-wide text-brand">Tu plan</p>
        <h2 id="plan-title" className="mt-1 text-xl font-bold leading-tight">
          {plan.leads.length ? <>Abre con {leadText}</> : 'Elige tu equipo'}
        </h2>
        {plan.leads.length > 0 && (
          <div className="mt-2 flex gap-1" aria-hidden>
            {plan.leads.map((s) => (
              <ShowdownSprite key={s} species={s} size={72} className="animate-scale-in" />
            ))}
          </div>
        )}

        <h3 className="mt-3 text-sm font-bold">
          {bringAll ? 'Tu orden, de mejor a peor contra este equipo' : `Trae estos ${plan.bringCount}`}
        </h3>
        <ol className="mt-2 space-y-1.5">
          {brought.map((pick, i) => {
            const index = mine.findIndex((m) => m.species === pick.species)
            const isLead = leads.has(toID(pick.species))
            return (
              <li key={pick.species}>
                <button
                  type="button"
                  onClick={() => index >= 0 && onOpen(me, index)}
                  className="pressable flex min-h-14 w-full items-center gap-3 rounded-xl bg-bg-elevated px-2.5 py-1.5 text-left shadow-card"
                >
                  <span className="battle-rank" aria-hidden>
                    {i + 1}
                  </span>
                  <ShowdownSprite species={pick.species} size={44} className="-my-1 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold">{pick.species}</span>
                      {isLead && (
                        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-brand px-2 text-xs font-bold text-brand-fg">
                          <Play aria-hidden size={11} fill="currentColor" />
                          Abre
                        </span>
                      )}
                    </span>
                    {pick.reasons.length > 0 && (
                      <span className="block text-sm leading-snug text-muted">{pick.reasons.slice(0, 2).join(' · ')}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {!bringAll && bench.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <span className="shrink-0 font-semibold">En el banquillo:</span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              {bench.map((p) => (
                <span key={p.species} className="inline-flex items-center">
                  <ShowdownSprite species={p.species} size={32} className="opacity-70" />
                  {p.species}
                </span>
              ))}
            </span>
          </div>
        )}
        {doubles && (
          <p className="mt-3 text-sm text-muted">
            En Showdown, pon a {plan.leads[0] ?? 'tus dos primeros'}
            {plan.leads[1] ? ` y ${plan.leads[1]}` : ''} en los dos primeros puestos al elegir.
          </p>
        )}
      </section>

      {plan.threats.length > 0 && (
        <section aria-labelledby="threats-title">
          <SectionTitle id="threats-title" icon={<Skull size={16} />}>
            Sus amenazas
          </SectionTitle>
          <ol className="grid gap-2 sm:grid-cols-3">
            {plan.threats.map((t, i) => {
              const index = theirs.findIndex((m) => m.species === t.species)
              return (
                <li key={t.species}>
                  <button
                    type="button"
                    onClick={() => index >= 0 && onOpen(them, index)}
                    className="battle-tip pressable flex min-h-16 w-full items-center gap-2 py-2 pl-4 pr-2 text-left"
                    data-tone={i === 0 ? 'danger' : 'warning'}
                  >
                    <ShowdownSprite species={t.species} size={48} flip className="-my-1 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold">{t.species}</span>
                      <span className="block text-sm leading-snug text-muted">
                        {t.reasons[0] ?? 'Uno de sus Pokémon más peligrosos para tu equipo'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {plan.tips.length > 0 && (
        <section aria-labelledby="notes-title">
          <SectionTitle id="notes-title" icon={<Flag size={16} />}>
            Ojo con su equipo
          </SectionTitle>
          <TipList tips={plan.tips} label="Notas del equipo rival" openFirst={false} />
        </section>
      )}

      <section aria-labelledby="teams-title">
        <SectionTitle id="teams-title" icon={<Users size={16} />} aside={calcButton}>
          Los equipos
        </SectionTitle>
        <div className="grid gap-2 lg:grid-cols-2">
          <TeamStrip title="Su equipo" profiles={theirs} side="theirs" onOpen={(i) => onOpen(them, i)} />
          <TeamStrip
            title="Tu equipo"
            profiles={mine}
            side="mine"
            onOpen={(i) => onOpen(me, i)}
            highlight={bringAll ? undefined : pickedIds}
          />
        </div>
      </section>

      {onStart && (
        <button type="button" onClick={onStart} className="btn btn-primary btn-lg w-full">
          <Play aria-hidden size={18} />
          Empezar el combate
        </button>
      )}
    </div>
  )
}
