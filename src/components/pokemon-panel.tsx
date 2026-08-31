'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Sparkles, X } from 'lucide-react'
import { useSelectedPokemon } from '@/components/selected-pokemon'
import { TypeBadge } from '@/components/type-badge'
import { getMoves, getPokemon, type MoveDetail, type PokemonDetail } from '@/lib/pokeapi'
import {
  STAT_KEYS, STAT_LABELS, TYPE_COLORS, computeStat, natureModifier,
  prettify, spriteUrl, statBarPercent, statColor, type StatKey,
} from '@/lib/pokemon'
import type { BuildRow } from '@/lib/database.types'

export function PokemonPanel({ className = '' }: { className?: string }) {
  const { build, teamName, clear } = useSelectedPokemon()

  return (
    <div className={`rounded-card border border-line bg-surface shadow-card ${className}`}>
      {build ? (
        <PokemonDetails key={build.id} build={build} teamName={teamName} onClose={clear} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Sparkles size={34} className="text-brand" />
      <p className="text-base font-semibold">Detalle del Pokémon</p>
      <p className="max-w-[24ch] text-sm text-muted">
        Pulsa cualquier Pokémon del feed para ver aquí sus estadísticas, objeto y movimientos.
      </p>
    </div>
  )
}

function PokemonDetails({
  build,
  teamName,
  onClose,
}: {
  build: BuildRow
  teamName: string | null
  onClose: () => void
}) {
  const [species, setSpecies] = useState<PokemonDetail | null>(null)
  const [moves, setMoves] = useState<MoveDetail[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSpecies(null)
    setMoves(null)
    setFailed(false)

    getPokemon(build.pokemon_id)
      .then((p) => alive && setSpecies(p))
      .catch(() => alive && setFailed(true))

    getMoves(build.moves)
      .then((m) => alive && setMoves(m))
      .catch(() => alive && setMoves([]))

    return () => {
      alive = false
    }
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
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold capitalize leading-tight">
            {build.nickname || prettify(build.pokemon_name)}
          </h2>
          {teamName && <p className="text-xs text-muted">de «{teamName}»</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-4">
        <div className="grid h-28 w-28 shrink-0 place-items-center rounded-xl border-t border-line bg-surface-2 shadow-card">
          <Image
            src={spriteUrl(build.pokemon_id, build.shiny)}
            alt={build.pokemon_name}
            width={104}
            height={104}
            className="h-24 w-24 [image-rendering:pixelated] object-contain"
            unoptimized
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {species
              ? species.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)
              : !failed && <SkeletonPill />}
          </div>
          <Row label="Objeto" value={prettify(build.item)} />
          <Row label="Habilidad" value={prettify(build.ability)} />
          <Row label="Naturaleza" value={prettify(build.nature)} />
          <Row label="Nivel" value={String(build.level)} />
        </div>
      </div>

      {/* Estadísticas */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Estadísticas</h3>
        <div className="overflow-hidden rounded-xl bg-surface-2 p-3 shadow-pressed">
          {species ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted">
                  <th className="pb-1 font-semibold">Stat</th>
                  <th className="pb-1 text-right font-semibold">IV</th>
                  <th className="pb-1 text-right font-semibold">EV</th>
                  <th className="pb-1 pl-2 text-right font-semibold">Total</th>
                  <th className="w-[38%] pb-1" />
                </tr>
              </thead>
              <tbody>
                {STAT_KEYS.map((k) => {
                  const total = computeStat(k, species.baseStats[k], ivs[k], evs[k], build.level, build.nature)
                  const mod = natureModifier(build.nature, k)
                  return (
                    <tr key={k}>
                      <td
                        className="py-[3px] font-semibold"
                        style={{ color: mod > 1 ? '#e11d48' : mod < 1 ? '#2563eb' : undefined }}
                        title={mod > 1 ? 'Favorecida por la naturaleza' : mod < 1 ? 'Perjudicada por la naturaleza' : undefined}
                      >
                        {STAT_LABELS[k]}
                        {mod > 1 ? '+' : mod < 1 ? '−' : ''}
                      </td>
                      <td className="text-right tabular-nums text-muted">{ivs[k]}</td>
                      <td className="text-right tabular-nums text-muted">{evs[k]}</td>
                      <td className="pl-2 text-right font-bold tabular-nums">{total}</td>
                      <td className="pl-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${statBarPercent(total, 260)}%`, backgroundColor: statColor(total) }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : failed ? (
            <p className="py-4 text-center text-sm text-muted">
              No se pudieron cargar las estadísticas base.
            </p>
          ) : (
            <div className="space-y-2 py-1">
              {STAT_KEYS.map((k) => (
                <div key={k} className="h-3 animate-pulse rounded bg-line" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Movimientos */}
      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Movimientos</h3>
        <ul className="space-y-1.5">
          {(moves ?? build.moves.map(() => null)).map((m, i) => {
            if (!m) return <li key={i} className="h-9 animate-pulse rounded-lg bg-line" />
            const c = TYPE_COLORS[m.type] ?? TYPE_COLORS.unknown
            return (
              <li
                key={m.name + i}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-card"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                <span className="truncate">{prettify(m.name)}</span>
                <span className="flex shrink-0 items-center gap-2.5 tabular-nums opacity-90">
                  <span title="Categoría">{DAMAGE_ICON[m.damageClass]}</span>
                  <span title="Potencia">{m.power ?? '—'}</span>
                  <span title="Precisión">{m.accuracy ? `${m.accuracy}%` : '—'}</span>
                  <span title="PP">{m.pp ?? '—'}</span>
                </span>
              </li>
            )
          })}
          {build.moves.length === 0 && (
            <li className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Sin movimientos.</li>
          )}
        </ul>
      </section>
    </div>
  )
}

const DAMAGE_ICON: Record<MoveDetail['damageClass'], string> = {
  physical: '💥',
  special: '🌀',
  status: '✦',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </div>
  )
}

function SkeletonPill() {
  return <span className="inline-block h-5 w-16 animate-pulse rounded-md bg-line" />
}
