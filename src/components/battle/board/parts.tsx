'use client'

import clsx from 'clsx'
import { Info, X } from 'lucide-react'
import type { BoostStat, MonState } from '@/lib/battle/live'
import type { StatusId } from '@/lib/battle/calc'
import { useFirstTimeHints } from '@/components/battle/board/storage'

/*
 * Piezas pequeñas del tablero que se repiten en varias zonas: vida, estado,
 * cambios de estadísticas y las explicaciones de jerga de la primera vez.
 */

/* ------------------------------------------------------------------ */
/* Textos                                                               */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<Exclude<StatusId, ''>, string> = {
  brn: 'Quemado',
  par: 'Paralizado',
  psn: 'Envenenado',
  tox: 'Muy envenenado',
  slp: 'Dormido',
  frz: 'Congelado',
}

// Lo que cada estado le hace en combate, para el lector de pantalla y el title.
const STATUS_EFFECT: Record<Exclude<StatusId, ''>, string> = {
  brn: 'hace la mitad de daño físico y pierde vida cada turno',
  par: 'va a la mitad de velocidad y a veces no se mueve',
  psn: 'pierde vida cada turno',
  tox: 'pierde cada vez más vida cada turno',
  slp: 'no puede atacar mientras duerma',
  frz: 'no puede atacar hasta descongelarse',
}

const BOOST_SHORT: Record<BoostStat, string> = {
  atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel', accuracy: 'Prec', evasion: 'Eva',
}

const BOOST_LONG: Record<BoostStat, string> = {
  atk: 'Ataque', def: 'Defensa', spa: 'Ataque Especial', spd: 'Defensa Especial',
  spe: 'Velocidad', accuracy: 'Precisión', evasion: 'Evasión',
}

const BOOST_ORDER: BoostStat[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']

export const WEATHER_LABEL: Record<string, string> = {
  Sun: 'Sol',
  'Harsh Sunshine': 'Sol abrasador',
  Rain: 'Lluvia',
  'Heavy Rain': 'Diluvio',
  Sand: 'Tormenta de arena',
  Snow: 'Nieve',
  'Strong Winds': 'Turbulencias',
}

export const TERRAIN_LABEL: Record<string, string> = {
  Electric: 'Campo Eléctrico',
  Grassy: 'Campo de Hierba',
  Psychic: 'Campo Psíquico',
  Misty: 'Campo de Niebla',
}

/** Jerga que se explica en corto la primera vez que aparece. */
export const JARGON: Record<string, { term: string; text: string }> = {
  preview: {
    term: 'Vista previa',
    text: 'Ves los 6 Pokémon de cada uno y eliges cuáles juegas. Los primeros de tu lista salen al campo.',
  },
  usage: {
    term: 'Estimaciones',
    text: 'Lo que el rival aún no ha enseñado se calcula con lo que más lleva la gente (estadísticas de uso de Smogon).',
  },
  trickroom: {
    term: 'Espacio Raro',
    text: 'Durante 5 turnos los Pokémon más lentos se mueven primero.',
  },
  tailwind: {
    term: 'Viento Afín',
    text: 'Duplica la velocidad de un equipo durante 4 turnos.',
  },
  screens: {
    term: 'Pantallas',
    text: 'Reflejo, Pantalla de Luz y Velo Aurora reducen el daño que recibe ese equipo durante unos turnos.',
  },
  boosts: {
    term: 'Cambios de estadísticas',
    text: '«Atq +1» es que su Ataque ha subido un nivel (×1,5); «−1», que ha bajado. Se pierden al cambiar de Pokémon.',
  },
  mega: {
    term: 'Mega',
    text: 'Ha megaevolucionado: cambia de estadísticas y habilidad, y a veces de tipo. Sólo uno por equipo.',
  },
}

/* ------------------------------------------------------------------ */
/* Vida                                                                 */
/* ------------------------------------------------------------------ */

function hpLevel(hp: number | null) {
  if (hp === null) return 'unknown'
  if (hp > 50) return 'high'
  if (hp > 20) return 'mid'
  return 'low'
}

/** "45 %" con coma decimal, como se escribe en español. */
export function formatPct(n: number) {
  return `${String(Math.round(n * 10) / 10).replace('.', ',')} %`
}

export function HpBar({ hp, fainted, className }: { hp: number | null; fainted?: boolean; className?: string }) {
  const value = fainted ? 0 : hp
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div aria-hidden className="battle-hp min-w-0 flex-1" data-level={hpLevel(value)}>
        <span style={{ width: `${value === null ? 100 : Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums">
        {fainted ? (
          <span className="text-danger">Fuera</span>
        ) : value === null ? (
          <span className="text-muted" title="Aún no ha salido al campo">
            ¿?
          </span>
        ) : (
          formatPct(value)
        )}
      </span>
      <span className="sr-only">
        {fainted ? 'Debilitado' : value === null ? 'Vida desconocida' : `Vida: ${formatPct(value)}`}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Estado y cambios                                                     */
/* ------------------------------------------------------------------ */

export function StatusTag({ status }: { status: StatusId }) {
  if (!status) return null
  return (
    <span
      title={`${STATUS_LABEL[status]}: ${STATUS_EFFECT[status]}`}
      className={clsx(
        'inline-flex h-6 items-center rounded-full px-2 text-xs font-bold',
        status === 'par' || status === 'slp' || status === 'frz'
          ? 'bg-warning-soft text-warning'
          : 'bg-danger-soft text-danger',
      )}
    >
      {STATUS_LABEL[status]}
      <span className="sr-only">: {STATUS_EFFECT[status]}</span>
    </span>
  )
}

export function MegaTag() {
  return (
    <span
      title="Megaevolucionado"
      className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2 text-xs font-bold text-brand"
    >
      Mega
    </span>
  )
}

export function hasBoosts(mon: MonState) {
  return Object.values(mon.boosts).some((v) => v)
}

export function BoostTags({ boosts }: { boosts: MonState['boosts'] }) {
  const entries = BOOST_ORDER.filter((k) => boosts[k]).map((k) => [k, boosts[k] as number] as const)
  if (!entries.length) return null
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Cambios de estadísticas">
      {entries.map(([stat, value]) => (
        <li
          key={stat}
          className={clsx(
            'inline-flex h-6 items-center rounded-md px-1.5 text-xs font-bold tabular-nums',
            value > 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
          )}
        >
          <span aria-hidden>
            {BOOST_SHORT[stat]} {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
          </span>
          <span className="sr-only">
            {BOOST_LONG[stat]} {value > 0 ? 'sube' : 'baja'} {Math.abs(value)} {Math.abs(value) === 1 ? 'nivel' : 'niveles'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Jerga                                                                */
/* ------------------------------------------------------------------ */

/**
 * Explicaciones de una línea para los términos de `keys` que el usuario aún
 * no ha visto. Salen una vez y se pueden cerrar; no vuelven a estorbar.
 */
export function JargonHints({ keys, className }: { keys: string[]; className?: string }) {
  const { visible, dismiss } = useFirstTimeHints(keys.filter((k) => JARGON[k]))
  if (!visible.length) return null
  return (
    <ul className={clsx('space-y-1.5', className)} aria-label="Qué significa">
      {visible.map((key) => (
        <li
          key={key}
          className="flex animate-fade-in items-start gap-2 rounded-xl bg-surface-2 py-1 pl-3 pr-1 text-sm leading-snug"
        >
          <Info aria-hidden size={16} className="mt-2.5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 py-2">
            <strong className="font-semibold">{JARGON[key].term}:</strong>{' '}
            <span className="text-muted">{JARGON[key].text}</span>
          </p>
          <button
            type="button"
            onClick={() => dismiss(key)}
            aria-label={`Entendido, ocultar la explicación de ${JARGON[key].term}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X aria-hidden size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Título de sección del tablero: corto, con un icono y una acción opcional a la derecha. */
export function SectionTitle({
  icon,
  children,
  aside,
  id,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  aside?: React.ReactNode
  id?: string
}) {
  return (
    <div className="mb-2 flex min-h-11 items-center gap-2">
      {icon && (
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          {icon}
        </span>
      )}
      <h2 id={id} className="min-w-0 flex-1 truncate text-base font-bold">
        {children}
      </h2>
      {aside}
    </div>
  )
}
