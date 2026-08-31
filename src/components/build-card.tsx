'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { TypeBadge } from '@/components/type-badge'
import { getMoves, getPokemon, type MoveDetail, type PokemonDetail } from '@/lib/pokeapi'
import {
  STAT_KEYS, STAT_LABELS, TYPE_COLORS, computeStat, natureModifier,
  prettify, spriteUrl, statBarPercent, statColor, type StatKey,
} from '@/lib/pokemon'
import type { BuildRow } from '@/lib/database.types'

const GENDER_MARK: Record<string, string> = { male: '♂', female: '♀', unknown: '' }

export function BuildCard({ build }: { build: BuildRow }) {
  const [species, setSpecies] = useState<PokemonDetail | null>(null)
  const [moves, setMoves] = useState<MoveDetail[] | null>(null)

  useEffect(() => {
    let alive = true
    getPokemon(build.pokemon_id).then((p) => alive && setSpecies(p)).catch(() => {})
    getMoves(build.moves).then((m) => alive && setMoves(m)).catch(() => {})
    return () => { alive = false }
  }, [build.pokemon_id, build.moves])

  const ivs: Record<StatKey, number> = {
    hp: build.hp_ivs, atk: build.atk_ivs, def: build.def_ivs,
    spa: build.spa_ivs, spd: build.spd_ivs, spe: build.spe_ivs,
  }
  const evs: Record<StatKey, number> = {
    hp: build.hp_evs, atk: build.atk_evs, def: build.def_evs,
    spa: build.spa_evs, spd: build.spd_evs, spe: build.spe_evs,
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-card transition hover:shadow-float">
      <div className="flex gap-4">
        <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-xl border-t border-line bg-surface-2 shadow-card">
          <Image
            src={spriteUrl(build.pokemon_id, build.shiny)}
            alt={build.pokemon_name}
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 [image-rendering:pixelated] object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="truncate text-base font-extrabold">
              {build.nickname ?? prettify(build.pokemon_name)}
            </h3>
            <span className="text-sm text-muted">{GENDER_MARK[build.gender]}</span>
            <span className="text-xs text-muted">Nv. {build.level}</span>
            {build.shiny && <span title="Variocolor" className="text-xs">✨</span>}
          </div>
          {build.nickname && (
            <p className="text-xs text-muted">{prettify(build.pokemon_name)}</p>
          )}

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {species?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
            {build.tera_type && (
              <span className="rounded-md border border-dashed border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Tera {prettify(build.tera_type)}
              </span>
            )}
          </div>

          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13px] sm:grid-cols-2">
            <Pair label="Objeto" value={prettify(build.item)} />
            <Pair label="Habilidad" value={prettify(build.ability)} />
            <Pair label="Naturaleza" value={prettify(build.nature)} />
          </dl>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ul className="space-y-1.5">
          {(moves ?? build.moves.map(() => null)).map((m, i) =>
            m ? (
              <li
                key={m.name + i}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: (TYPE_COLORS[m.type] ?? TYPE_COLORS.unknown).bg,
                  color: (TYPE_COLORS[m.type] ?? TYPE_COLORS.unknown).fg,
                }}
              >
                <span className="truncate">{prettify(m.name)}</span>
                <span className="shrink-0 tabular-nums opacity-90">
                  {m.power ?? '—'} · {m.accuracy ? `${m.accuracy}%` : '—'}
                </span>
              </li>
            ) : (
              <li key={i} className="h-[30px] animate-pulse rounded-lg bg-line" />
            ),
          )}
        </ul>

        <div className="rounded-lg bg-surface-2 p-2.5 shadow-pressed">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-semibold">Stat</th>
                <th className="text-right font-semibold">IV</th>
                <th className="text-right font-semibold">EV</th>
                <th className="pl-1.5 text-right font-semibold">Total</th>
                <th className="w-[30%]" />
              </tr>
            </thead>
            <tbody>
              {STAT_KEYS.map((k) => {
                const total = species
                  ? computeStat(k, species.baseStats[k], ivs[k], evs[k], build.level, build.nature)
                  : null
                const mod = natureModifier(build.nature, k)
                return (
                  <tr key={k}>
                    <td
                      className="font-semibold"
                      style={{ color: mod > 1 ? '#e11d48' : mod < 1 ? '#2563eb' : undefined }}
                    >
                      {STAT_LABELS[k]}
                    </td>
                    <td className="text-right tabular-nums text-muted">{ivs[k]}</td>
                    <td className="text-right tabular-nums text-muted">{evs[k]}</td>
                    <td className="pl-1.5 text-right font-bold tabular-nums">{total ?? '—'}</td>
                    <td className="pl-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                        {total !== null && (
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${statBarPercent(total, 260)}%`, backgroundColor: statColor(total) }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  )
}
