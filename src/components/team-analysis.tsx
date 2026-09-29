'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useInView } from 'motion/react'
import {
  ChartColumn, Hourglass, Info, RotateCcw, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert, Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { TypeBadge } from '@/components/type-badge'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { getPokemon, type PokemonDetail } from '@/lib/pokeapi'
import { STAT_KEYS, STAT_LABELS, STAT_NAMES_ES, computeStat, spriteUrl, statColor, type StatKey } from '@/lib/pokemon'
import {
  describeMultiplier, formatMultiplier, summarizeMatchups, teamMatchups, typeNameEs,
  type Effectiveness, type TypeMatchupRow,
} from '@/lib/type-chart'

type Member = { pokemonId: number; name: string }
type Analyzed = Member & { key: string; types: string[]; stats: PokemonDetail['baseStats'] }
type Entry = { status: 'ok'; detail: PokemonDetail } | { status: 'error' }

/**
 * Fichas de todos los miembros. Cada una se guarda por id en cuanto llega, así
 * que al cambiar el equipo (en el creador) sólo se pide lo nuevo y lo que ya
 * estaba no parpadea. La caché y la deduplicación viven en lib/pokeapi.
 */
function useMembers(members: Member[]) {
  const [entries, setEntries] = useState<Record<number, Entry>>({})
  const [attempt, setAttempt] = useState(0)
  const idsKey = [...new Set(members.map((m) => m.pokemonId).filter((id) => id > 0))].join(',')

  useEffect(() => {
    let alive = true
    for (const id of idsKey ? idsKey.split(',').map(Number) : []) {
      getPokemon(id).then(
        (detail) => {
          if (alive) setEntries((prev) => ({ ...prev, [id]: { status: 'ok', detail } }))
        },
        () => {
          if (alive) setEntries((prev) => ({ ...prev, [id]: { status: 'error' } }))
        },
      )
    }
    return () => {
      alive = false
    }
  }, [idsKey, attempt])

  const valid = members.filter((m) => m.pokemonId > 0)
  const ready: Analyzed[] = []
  const failed: Member[] = []
  let loading = 0
  valid.forEach((member, i) => {
    const entry = entries[member.pokemonId]
    if (!entry) loading += 1
    else if (entry.status === 'error') failed.push(member)
    else ready.push({ ...member, key: `${i}-${member.pokemonId}`, types: entry.detail.types, stats: entry.detail.baseStats })
  })

  function retry() {
    setEntries((prev) => {
      const next = { ...prev }
      for (const member of failed) delete next[member.pokemonId]
      return next
    })
    setAttempt((n) => n + 1)
  }

  return { ready, failed, loading, total: valid.length, retry }
}

/**
 * Análisis defensivo y de velocidad de un equipo. `compact` pinta sólo una
 * tira con las debilidades y resistencias, pensada para el creador de equipos.
 * No tiene en cuenta habilidades (Levitación…) ni teratipos.
 */
export function TeamAnalysis({ members, compact = false }: { members: Member[]; compact?: boolean }) {
  const { ready, failed, loading, total, retry } = useMembers(members)
  const typesKey = ready.map((m) => m.types.join('/')).join('|')
  const rows = useMemo(
    () => teamMatchups(typesKey ? typesKey.split('|').map((t) => t.split('/')) : []),
    [typesKey],
  )
  const summary = useMemo(() => summarizeMatchups(rows, ready.length), [rows, ready.length])

  if (compact) {
    return <CompactStrip summary={summary} total={total} loading={loading > 0 && ready.length === 0} />
  }

  if (total === 0) {
    return (
      <p className="card flex items-center gap-3 p-5 text-sm text-muted">
        <Info size={18} aria-hidden className="shrink-0" />
        Añade Pokémon al equipo para ver sus debilidades, resistencias y velocidad.
      </p>
    )
  }

  // Primera carga: esqueleto con la forma final para que nada salte al llegar los datos.
  if (ready.length === 0 && loading > 0) return <AnalysisSkeleton columns={total} />

  if (ready.length === 0) {
    return (
      <div role="alert" className="card flex flex-col items-center gap-3 p-8 text-center">
        <TriangleAlert size={26} aria-hidden className="text-warning" />
        <p className="font-semibold">No se pudo cargar el análisis</p>
        <p className="max-w-sm text-sm text-muted">La PokéAPI no ha respondido. Comprueba tu conexión.</p>
        <button type="button" onClick={retry} className="btn btn-soft btn-sm mt-1">
          <RotateCcw size={15} aria-hidden /> Reintentar
        </button>
      </div>
    )
  }

  return (
    <FullAnalysis
      ready={ready}
      rows={rows}
      summary={summary}
      failed={failed}
      loading={loading}
      onRetry={retry}
    />
  )
}

/* ---------- Vista completa ---------- */

function FullAnalysis({
  ready,
  rows,
  summary,
  failed,
  loading,
  onRetry,
}: {
  ready: Analyzed[]
  rows: TypeMatchupRow[]
  summary: ReturnType<typeof summarizeMatchups>
  failed: Member[]
  loading: number
  onRetry: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Las barras y las celdas se animan cuando se ven, no al montarse fuera de pantalla.
  const inView = useInView(rootRef, { once: true, amount: 0.12 })

  return (
    <div ref={rootRef} data-inview={inView || undefined} className="flex flex-col gap-4">
      {(failed.length > 0 || loading > 0) && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-warning-soft px-4 py-2.5 text-sm">
          <TriangleAlert size={16} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            {loading > 0
              ? `Cargando ${loading === 1 ? 'un Pokémon más' : `${loading} Pokémon más`}…`
              : `Sin datos de ${failed.map((m) => m.name).join(', ')}: el análisis no los incluye.`}
          </span>
          {failed.length > 0 && loading === 0 && (
            <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm -my-1 text-warning">
              <RotateCcw size={14} aria-hidden /> Reintentar
            </button>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <SummaryCard summary={summary} size={ready.length} className="lg:col-start-2 lg:row-start-1" />
        <MatrixCard ready={ready} rows={rows} inView={inView} className="lg:col-start-1 lg:row-span-3 lg:row-start-1" />
        <SpeedCard ready={ready} className="lg:col-start-2 lg:row-start-2" />
        <StatsCard ready={ready} className="lg:col-start-2 lg:row-start-3" />
      </div>

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
        Sólo se tienen en cuenta los tipos: habilidades como Levitación o Absorbe Agua y los teratipos
        pueden cambiar estas cuentas.
      </p>
    </div>
  )
}

function CardTitle({ icon, children, aside }: { icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden className="text-brand">
          {icon}
        </span>
        {children}
      </h3>
      {aside}
    </div>
  )
}

/* ---------- Resumen ---------- */

function SummaryCard({
  summary,
  size,
  className,
}: {
  summary: ReturnType<typeof summarizeMatchups>
  size: number
  className?: string
}) {
  const critical = summary.critical.length
  const verdict =
    critical > 0
      ? { tone: 'danger', text: critical === 1 ? '1 debilidad crítica' : `${critical} debilidades críticas` }
      : summary.weaknesses.length > 0
        ? { tone: 'warning', text: 'Sin agujeros graves' }
        : { tone: 'success', text: 'Defensa muy equilibrada' }

  return (
    <section aria-label="Resumen defensivo" className={clsx('card p-4 sm:p-5', className)}>
      <CardTitle
        icon={<ShieldQuestion size={18} />}
        aside={
          <span
            className={clsx(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold',
              verdict.tone === 'danger' && 'bg-danger-soft text-danger',
              verdict.tone === 'warning' && 'bg-warning-soft text-warning',
              verdict.tone === 'success' && 'bg-success-soft text-success',
            )}
          >
            {verdict.tone === 'danger' ? <TriangleAlert size={13} aria-hidden /> : <ShieldCheck size={13} aria-hidden />}
            {verdict.text}
          </span>
        }
      >
        Resumen
      </CardTitle>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        <ChipGroup
          title="Debilidades principales"
          icon={<ShieldAlert size={15} aria-hidden />}
          tone="danger"
          rows={summary.weaknesses.slice(0, 6)}
          count={(row) => row.weak}
          describe={(row) =>
            `${typeNameEs(row.type)}: ${row.weak} de ${size} débiles${row.quadWeak ? ` (${row.quadWeak} a ×4)` : ''}, ${row.resist} lo aguantan`
          }
          empty="Ningún tipo pone en apuros a varios a la vez."
        />
        <ChipGroup
          title="Resistencias destacadas"
          icon={<ShieldCheck size={15} aria-hidden />}
          tone="success"
          rows={summary.resistances.slice(0, 6)}
          count={(row) => row.resist}
          describe={(row) =>
            `${typeNameEs(row.type)}: ${row.resist} de ${size} lo resisten${row.immune ? ` (${row.immune} inmunes)` : ''}`
          }
          empty="Pocas resistencias compartidas: cada miembro va por libre."
        />
      </div>

      {summary.uncovered.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Nadie lo resiste</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Tipos que ningún miembro resiste">
            {summary.uncovered.map((row) => (
              <li key={row.type} title={typeNameEs(row.type)}>
                <TypeBadge type={row.type} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ChipGroup({
  title,
  icon,
  tone,
  rows,
  count,
  describe,
  empty,
}: {
  title: string
  icon: React.ReactNode
  tone: 'danger' | 'success'
  rows: TypeMatchupRow[]
  count: (row: TypeMatchupRow) => number
  describe: (row: TypeMatchupRow) => string
  empty: string
}) {
  return (
    <div>
      <p className={clsx('mb-2 flex items-center gap-1.5 text-sm font-semibold', tone === 'danger' ? 'text-danger' : 'text-success')}>
        {icon}
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {rows.map((row, i) => (
            <li
              key={row.type}
              title={describe(row)}
              style={{ '--i': i } as React.CSSProperties}
              className={clsx(
                'stagger-item inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-1',
                tone === 'danger' ? 'bg-danger-soft' : 'bg-success-soft',
              )}
            >
              <TypeBadge type={row.type} size="sm" />
              <span
                aria-hidden
                className={clsx(
                  'grid size-6 place-items-center rounded-full text-xs font-extrabold tabular-nums',
                  tone === 'danger' ? 'text-danger' : 'text-success',
                )}
              >
                {count(row)}
              </span>
              <span className="sr-only">{describe(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Tabla defensiva ---------- */

const LEGEND: { value: Effectiveness; label: string }[] = [
  { value: 4, label: 'Muy débil' },
  { value: 2, label: 'Débil' },
  { value: 0.5, label: 'Resiste' },
  { value: 0.25, label: 'Resiste mucho' },
  { value: 0, label: 'Inmune' },
]

function MatrixCard({
  ready,
  rows,
  inView,
  className,
}: {
  ready: Analyzed[]
  rows: TypeMatchupRow[]
  inView: boolean
  className?: string
}) {
  const captionId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const critical = rows.filter((r) => r.critical).length

  return (
    <section aria-labelledby={captionId} className={clsx('card overflow-hidden', className)}>
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <CardTitle
          icon={<ShieldAlert size={18} />}
          aside={
            critical > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
                <TriangleAlert size={13} aria-hidden /> Fila marcada: debilidad crítica
              </span>
            ) : undefined
          }
        >
          <span id={captionId}>Tabla defensiva</span>
        </CardTitle>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => e.currentTarget.toggleAttribute('data-scrolled', e.currentTarget.scrollLeft > 2)}
        className="team-matrix-scroll overflow-x-auto overscroll-x-contain"
        // Región desplazable: tiene que poder enfocarse para moverla con el teclado.
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
      >
        <table
          data-inview={inView || undefined}
          className="team-matrix w-full min-w-max border-separate border-spacing-0 text-center"
          onPointerLeave={() => setHoverCol(null)}
        >
          <caption className="sr-only">
            Multiplicador de daño que recibe cada Pokémon según el tipo del ataque. Débiles cuenta los que reciben
            el doble o más; resisten, los que reciben la mitad o menos, inmunes incluidos.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="team-matrix-sticky sticky left-0 z-10 border-b border-line px-3 pb-2 text-left text-[11px] font-bold uppercase tracking-wider text-muted sm:pl-5"
              >
                Ataque
              </th>
              {ready.map((member, j) => (
                <th
                  key={member.key}
                  scope="col"
                  title={member.name}
                  data-col-hover={hoverCol === j || undefined}
                  onPointerEnter={() => setHoverCol(j)}
                  className="border-b border-line px-0.5 pb-1"
                >
                  <Image
                    src={spriteUrl(member.pokemonId)}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    draggable={false}
                    className="mx-auto size-10 object-contain [image-rendering:pixelated]"
                  />
                  <span className="sr-only">{member.name}</span>
                </th>
              ))}
              <th scope="col" className="border-b border-l border-line px-2 pb-2 align-bottom text-[11px] font-bold uppercase tracking-wider text-danger">
                Débiles
              </th>
              <th scope="col" className="border-b border-line px-2 pb-2 align-bottom text-[11px] font-bold uppercase tracking-wider text-success sm:pr-5">
                Resisten
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.type} data-critical={row.critical || undefined}>
                <th
                  scope="row"
                  className="team-matrix-sticky sticky left-0 z-10 py-1 pl-3 pr-2 text-left sm:pl-5"
                >
                  <span className="flex items-center gap-1.5">
                    <TypeBadge type={row.type} size="sm" className="w-[4.5rem]" />
                    {row.critical && (
                      <>
                        <TriangleAlert size={13} aria-hidden className="text-danger" />
                        <span className="sr-only">(debilidad crítica)</span>
                      </>
                    )}
                  </span>
                </th>
                {row.cells.map((value, j) => (
                  <td
                    key={ready[j].key}
                    data-col-hover={hoverCol === j || undefined}
                    onPointerEnter={() => setHoverCol(j)}
                    title={`${ready[j].name} ${describeMultiplier(value)} de ${typeNameEs(row.type)}`}
                    className="px-0.5 py-1"
                  >
                    <span
                      className="team-cell"
                      data-m={value}
                      style={{ '--r': r, '--c': j } as React.CSSProperties}
                    >
                      <span aria-hidden>{value === 1 ? '·' : formatMultiplier(value)}</span>
                      <span className="sr-only">{describeMultiplier(value)}</span>
                    </span>
                  </td>
                ))}
                <td className="border-l border-line px-2 py-1">
                  <Count value={row.weak} tone="danger" />
                </td>
                <td className="px-2 py-1 sm:pr-5">
                  <Count value={row.resist} tone="success" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label="Leyenda" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
        {LEGEND.map((item) => (
          <li key={item.value} className="flex items-center gap-1.5">
            <span aria-hidden className="team-cell !m-0 !h-5 !w-7 !text-[10px]" data-m={item.value}>
              {formatMultiplier(item.value)}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Count({ value, tone }: { value: number; tone: 'danger' | 'success' }) {
  if (value === 0) return <span className="text-sm text-muted/50">–</span>
  return (
    <span className={clsx('text-sm font-extrabold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-success')}>
      {value}
    </span>
  )
}

/* ---------- Velocidad ---------- */

// Referencias habituales para leer la velocidad de un vistazo.
function speedVerdict(average: number) {
  if (average >= 95) return { icon: <Zap size={13} aria-hidden />, text: 'Equipo rápido' }
  if (average <= 62) return { icon: <Hourglass size={13} aria-hidden />, text: 'Ideal para Espacio Raro' }
  return { icon: <Zap size={13} aria-hidden />, text: 'Velocidad media' }
}

function SpeedCard({ ready, className }: { ready: Analyzed[]; className?: string }) {
  const sorted = [...ready].sort((a, b) => b.stats.spe - a.stats.spe)
  const fastest = Math.max(150, ...sorted.map((m) => m.stats.spe))
  const average = sorted.reduce((sum, m) => sum + m.stats.spe, 0) / Math.max(1, sorted.length)
  const verdict = speedVerdict(average)

  return (
    <section aria-label="Velocidad" className={clsx('card p-4 sm:p-5', className)}>
      <CardTitle
        icon={<Zap size={18} />}
        aside={
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted shadow-card">
            {verdict.icon}
            {verdict.text}
          </span>
        }
      >
        Velocidad
      </CardTitle>

      <ol className="flex flex-col gap-3">
        {sorted.map((member, i) => {
          // Máxima a nivel 50 con naturaleza que la sube: la referencia de VGC.
          const max50 = computeStat('spe', member.stats.spe, 31, 252, 50, 'jolly')
          return (
            <li key={member.key} className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.5rem] items-center gap-2.5">
              <Image
                src={spriteUrl(member.pokemonId)}
                alt=""
                width={96}
                height={96}
                unoptimized
                draggable={false}
                className="size-9 object-contain [image-rendering:pixelated]"
              />
              <div className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-semibold">{member.name}</span>
                  <span className="shrink-0 text-muted" title="Velocidad máxima a nivel 50 (252 EV y naturaleza que la sube)">
                    máx. {max50} <span className="max-[400px]:hidden">a Nv. 50</span>
                  </span>
                </div>
                <div aria-hidden className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                  <div
                    className="team-bar h-full rounded-full"
                    style={
                      {
                        width: `${Math.round((member.stats.spe / fastest) * 100)}%`,
                        backgroundColor: statColor(member.stats.spe),
                        '--i': i,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
              <span className="text-right text-sm font-extrabold tabular-nums">
                <span className="sr-only">Velocidad base </span>
                {member.stats.spe}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ---------- Media de estadísticas ---------- */

function lean(a: number, b: number, [first, second, both]: [string, string, string]) {
  if (a - b >= 12) return first
  if (b - a >= 12) return second
  return both
}

function StatsCard({ ready, className }: { ready: Analyzed[]; className?: string }) {
  const averages = Object.fromEntries(
    STAT_KEYS.map((k) => [k, ready.reduce((sum, m) => sum + m.stats[k], 0) / Math.max(1, ready.length)]),
  ) as Record<StatKey, number>
  const total = STAT_KEYS.reduce((sum, k) => sum + averages[k], 0)

  const tags = [
    lean(averages.atk, averages.spa, ['Ataque físico', 'Ataque especial', 'Ataque mixto']),
    lean(averages.def, averages.spd, ['Aguante físico', 'Aguante especial', 'Defensas parejas']),
  ]

  return (
    <section aria-label="Media de estadísticas base" className={clsx('card p-4 sm:p-5', className)}>
      <CardTitle
        icon={<ChartColumn size={18} />}
        aside={
          <span className="text-xs text-muted">
            Total medio{' '}
            <AnimatedNumber value={Math.round(total)} compact={false} countUp className="font-extrabold text-ink" />
          </span>
        }
      >
        Media del equipo
      </CardTitle>

      <ul className="flex flex-col gap-2">
        {STAT_KEYS.map((k, i) => {
          const value = Math.round(averages[k])
          return (
            <li key={k} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2.5 text-xs">
              <abbr title={STAT_NAMES_ES[k]} className="font-semibold text-muted no-underline">
                {STAT_LABELS[k]}
              </abbr>
              <span aria-hidden className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                <span
                  className="team-bar block h-full rounded-full"
                  style={
                    {
                      width: `${Math.min(100, Math.round((value / 160) * 100))}%`,
                      backgroundColor: statColor(value),
                      '--i': i,
                    } as React.CSSProperties
                  }
                />
              </span>
              <span className="text-right text-sm font-extrabold tabular-nums">{value}</span>
            </li>
          )
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Perfil del equipo">
        {tags.map((tag) => (
          <li key={tag} className="inline-flex h-7 items-center rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand">
            {tag}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- Estados de carga ---------- */

function AnalysisSkeleton({ columns }: { columns: number }) {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
      <span className="sr-only">Analizando el equipo…</span>
      <div aria-hidden className="card p-4 sm:p-5 lg:col-start-2 lg:row-start-1">
        <Skeleton className="mb-4 h-5 w-32 rounded-md" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div aria-hidden className="card p-4 sm:p-5 lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <Skeleton className="mb-4 h-5 w-40 rounded-md" />
        <div className="flex flex-col gap-2 overflow-hidden">
          {Array.from({ length: 9 }, (_, r) => (
            <div key={r} className="flex gap-1.5">
              <Skeleton className="h-7 w-[4.5rem] shrink-0 rounded-md" />
              {Array.from({ length: Math.min(columns, 6) }, (_, c) => (
                <Skeleton key={c} className="h-7 w-9 shrink-0 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="card flex flex-col gap-3 p-4 sm:p-5 lg:col-start-2 lg:row-start-2">
        <Skeleton className="mb-1 h-5 w-28 rounded-md" />
        {Array.from({ length: Math.min(columns, 6) }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-2.5 flex-1 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Tira compacta (creador de equipos) ---------- */

function CompactStrip({
  summary,
  total,
  loading,
}: {
  summary: ReturnType<typeof summarizeMatchups>
  total: number
  loading: boolean
}) {
  if (total === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ShieldQuestion size={16} aria-hidden className="shrink-0" />
        Añade Pokémon para ver sus debilidades de tipo.
      </p>
    )
  }

  if (loading) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-1.5">
        <span className="sr-only">Analizando tipos…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
    )
  }

  const weak = summary.weaknesses.slice(0, 5)
  const strong = summary.resistances.slice(0, 4)
  const critical = new Set(summary.critical.map((r) => r.type))

  return (
    <div role="group" aria-label="Resumen de tipos del equipo" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="mr-0.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-danger">
          <ShieldAlert size={14} aria-hidden /> Débil a
        </span>
        {weak.length === 0 ? (
          <span className="text-sm text-muted">nada grave</span>
        ) : (
          weak.map((row) => (
            <span
              key={row.type}
              title={`${typeNameEs(row.type)}: ${row.weak} débiles, ${row.resist} lo aguantan`}
              className={clsx(
                'inline-flex h-7 items-center gap-1 rounded-full bg-danger-soft pl-1 pr-2 text-xs font-extrabold tabular-nums text-danger',
                critical.has(row.type) && 'ring-2 ring-danger/60',
              )}
            >
              <TypeBadge type={row.type} size="sm" />
              {row.weak}
              <span className="sr-only">
                {' '}débiles{critical.has(row.type) ? ', debilidad crítica' : ''}
              </span>
            </span>
          ))
        )}
      </div>
      {strong.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-0.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-success">
            <ShieldCheck size={14} aria-hidden /> Resiste
          </span>
          {strong.map((row) => (
            <span
              key={row.type}
              title={`${typeNameEs(row.type)}: ${row.resist} lo resisten`}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-success-soft pl-1 pr-2 text-xs font-extrabold tabular-nums text-success"
            >
              <TypeBadge type={row.type} size="sm" />
              {row.resist}
              <span className="sr-only"> lo resisten</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
