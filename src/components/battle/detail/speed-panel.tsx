'use client'

import { useMemo } from 'react'
import { Lightbulb, RefreshCcw, Wind } from 'lucide-react'
import clsx from 'clsx'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { effectiveSpeed, type MonProfile, type SpeedInsight } from '@/lib/battle/advice'
import { speedOf } from '@/lib/battle/calc'
import { toID } from '@/lib/battle/dex'
import type { BattleFormat } from '@/lib/battle/formats'
import { Term, pctText } from './shared'

/*
 * Tabla de velocidades: todos los Pokémon en pie, del que se mueve antes al
 * que se mueve después (al revés en Espacio Raro). Los tuyos con su número
 * exacto; los del rival con el típico en grande y su rango debajo, porque su
 * reparto no se sabe. Viento Afín, parálisis y cambios ya van aplicados.
 */

type Entry = {
  key: string
  side: 'mine' | 'theirs'
  profile: MonProfile
  /** Valor por el que se ordena: el exacto (tuyo) o el típico (rival). */
  value: number
  range: { min: number; max: number; scarf: number | null; scarfPct: number } | null
  tailwind: boolean
  paralyzed: boolean
  boost: number
  insights: string[]
}

export function SpeedPanel({
  format,
  mine,
  theirs,
  insights,
  field,
}: {
  format: BattleFormat
  mine: MonProfile[]
  theirs: MonProfile[]
  insights: SpeedInsight[]
  field: { trickRoom: boolean; myTailwind: boolean; theirTailwind: boolean }
}) {
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    mine.forEach((p, i) => {
      if (p.state?.fainted) return
      const boost = p.state?.boosts.spe ?? 0
      const paralyzed = p.state?.status === 'par'
      list.push({
        key: `m-${i}`,
        side: 'mine',
        profile: p,
        value: effectiveSpeed(speedOf(format, p.set), {
          tailwind: field.myTailwind,
          paralyzed,
          boost,
          scarf: toID(p.set.item ?? '') === 'choicescarf',
        }),
        range: null,
        tailwind: field.myTailwind,
        paralyzed,
        boost,
        insights: [],
      })
    })
    theirs.forEach((p, i) => {
      if (p.state?.fainted) return
      const boost = p.state?.boosts.spe ?? 0
      const paralyzed = p.state?.status === 'par'
      const knownItem = p.items.find((it) => it.known)?.name
      const scarfKnown = knownItem ? toID(knownItem) === 'choicescarf' : false
      const scarfPossible = !knownItem && p.speed.scarf >= 3
      const ctx = { tailwind: field.theirTailwind, paralyzed, boost }
      list.push({
        key: `t-${i}`,
        side: 'theirs',
        profile: p,
        value: effectiveSpeed(p.speed.typical, { ...ctx, scarf: scarfKnown }),
        range: {
          min: effectiveSpeed(p.speed.min, { ...ctx, scarf: scarfKnown }),
          max: effectiveSpeed(p.speed.max, { ...ctx, scarf: scarfKnown }),
          scarf: scarfPossible ? effectiveSpeed(p.speed.typical, { ...ctx, scarf: true }) : null,
          scarfPct: p.speed.scarf,
        },
        tailwind: field.theirTailwind,
        paralyzed,
        boost,
        insights: insights.filter((s) => toID(s.species) === toID(p.species)).map((s) => s.text),
      })
    })
    // En Espacio Raro va primero el más lento; a igualdad, los tuyos delante para leerlo fácil.
    return list.sort((a, b) => (field.trickRoom ? a.value - b.value : b.value - a.value) || (a.side === 'mine' ? -1 : 1))
  }, [format, mine, theirs, insights, field])

  const top = Math.max(1, ...entries.map((e) => Math.max(e.value, e.range?.max ?? 0, e.range?.scarf ?? 0)))
  const scale = (n: number) => `${Math.min(100, (n / top) * 100)}%`

  if (!entries.length) return <p className="battle-d-empty">Aún no hay Pokémon en pie que comparar.</p>

  return (
    <div>
      {/* Efectos activos */}
      {(field.trickRoom || field.myTailwind || field.theirTailwind) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {field.trickRoom && (
            <span className="battle-d-chip battle-d-chip--warn">
              <RefreshCcw aria-hidden size={12} /> <Term term="Espacio Raro">Espacio Raro</Term>: el más lento primero
            </span>
          )}
          {field.myTailwind && (
            <span className="battle-d-chip battle-d-chip--good">
              <Wind aria-hidden size={12} /> Tu <Term term="Viento Afín">Viento Afín</Term> ×2
            </span>
          )}
          {field.theirTailwind && (
            <span className="battle-d-chip battle-d-chip--bad">
              <Wind aria-hidden size={12} /> Su Viento Afín ×2
            </span>
          )}
        </div>
      )}

      {insights.length > 0 && (
        <ul className="mb-3 grid gap-1.5" aria-label="Deducciones de la partida">
          {insights.map((s, i) => (
            <li key={i} className="battle-d-insight">
              <Lightbulb aria-hidden size={16} className="mt-0.5 shrink-0" />
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>{field.trickRoom ? 'Se mueve antes (el más lento)' : 'Se mueve antes'}</span>
        <span className="flex items-center gap-3 normal-case tracking-normal">
          <span className="inline-flex items-center gap-1">
            <span className="battle-d-dot" data-side="mine" aria-hidden /> Tuyos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="battle-d-dot" data-side="theirs" aria-hidden /> Rival
          </span>
        </span>
      </p>

      <ol className="grid gap-1.5">
        {entries.map((e, i) => {
          const prev = entries[i - 1]
          const next = entries[i + 1]
          const tie = (prev && prev.value === e.value) || (next && next.value === e.value)
          return (
            <li
              key={e.key}
              className={clsx('battle-d-speedrow stagger-item', e.insights.length > 0 && 'battle-d-speedrow--insight')}
              data-side={e.side}
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted">{i + 1}</span>
              <ShowdownSprite species={e.profile.species} size={36} flip={e.side === 'theirs'} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold">{e.profile.species}</span>
                  <span className="sr-only">{e.side === 'mine' ? '(tuyo)' : '(rival)'}</span>
                  {e.tailwind && <Wind aria-label="con Viento Afín" size={13} className="shrink-0 text-brand" />}
                  {e.paralyzed && <span className="battle-d-chip battle-d-chip--bad !h-5 !px-1.5 text-[10px]">PAR</span>}
                  {e.boost !== 0 && (
                    <span className={clsx('battle-d-chip !h-5 !px-1.5 text-[10px]', e.boost > 0 ? 'battle-d-chip--good' : 'battle-d-chip--bad')}>
                      {e.boost > 0 ? `+${e.boost}` : `−${-e.boost}`}
                    </span>
                  )}
                  {tie && <span className="battle-d-chip battle-d-chip--warn !h-5 !px-1.5 text-[10px]">Empate</span>}
                </p>
                {/* Eje de velocidad: punto (tuyo) o banda mín.–máx. con el típico marcado (rival) */}
                <div className="battle-d-axis mt-1.5" aria-hidden>
                  {e.range ? (
                    <>
                      <span className="battle-d-axis-band" style={{ left: scale(e.range.min), width: `calc(${scale(e.range.max)} - ${scale(e.range.min)})` }} />
                      {e.range.scarf !== null && <span className="battle-d-axis-mark battle-d-axis-mark--scarf" style={{ left: scale(e.range.scarf) }} />}
                      <span className="battle-d-axis-mark" data-side="theirs" style={{ left: scale(e.value) }} />
                    </>
                  ) : (
                    <span className="battle-d-axis-mark" data-side="mine" style={{ left: scale(e.value) }} />
                  )}
                </div>
                {e.range && (
                  <p className="mt-1 text-[11px] text-muted tabular-nums">
                    {e.range.min}–{e.range.max}
                    {e.range.scarf !== null && (
                      <>
                        {' · '}
                        <Term term="Pañuelo">Pañuelo</Term> {e.range.scarf} ({pctText(e.range.scarfPct)})
                      </>
                    )}
                  </p>
                )}
                {e.insights.map((t, k) => (
                  <p key={k} className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-brand">
                    <Lightbulb aria-hidden size={12} className="mt-px shrink-0" /> {t}
                  </p>
                ))}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-extrabold leading-none tabular-nums">{e.value}</p>
                <p className="text-[10px] text-muted">{e.range ? 'típica' : 'exacta'}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
