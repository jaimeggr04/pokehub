'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CircleDot, CircleHelp, Sparkles, Swords, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { TYPE_COLORS } from '@/lib/pokemon'
import { typeNameEs } from '@/lib/type-chart'
import type { StatusId } from '@/lib/battle/calc'
import type { MonProfile } from '@/lib/battle/advice'

/*
 * Piezas pequeñas que comparten la ficha, la calculadora, la tabla de
 * velocidades y la lista del equipo: chapas de tipo en español, barra de vida,
 * estado alterado y la explicación en corto de la jerga.
 */

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

/**
 * Chapa de tipo con el nombre en español. TypeBadge pinta el nombre en inglés
 * y espera el tipo en minúsculas; la calculadora los da con mayúscula
 * ("Fire"), así que aquí se normalizan.
 */
export function TypeChip({ type, size = 'sm', className }: { type: string; size?: 'xs' | 'sm'; className?: string }) {
  const t = type.toLowerCase()
  const c = TYPE_COLORS[t] ?? TYPE_COLORS.unknown
  return (
    <span
      className={clsx(
        'pokemon-type-badge inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-semibold uppercase leading-none tracking-wide',
        c.fg === '#ffffff' && 'pokemon-type-badge--light',
        size === 'xs' ? 'h-4 px-1 text-[9px]' : 'h-5 px-1.5 text-[10px]',
        className,
      )}
      style={{ '--type-bg': c.bg, '--type-fg': c.fg } as React.CSSProperties}
    >
      {typeNameEs(t)}
    </span>
  )
}

export const CATEGORY: Record<'Physical' | 'Special' | 'Status', { label: string; Icon: LucideIcon }> = {
  Physical: { label: 'Físico', Icon: Swords },
  Special: { label: 'Especial', Icon: Sparkles },
  Status: { label: 'Estado', Icon: CircleDot },
}

/* ------------------------------------------------------------------ */
/* Vida y estado                                                        */
/* ------------------------------------------------------------------ */

export const STATUS: Record<Exclude<StatusId, ''>, { short: string; long: string }> = {
  brn: { short: 'QUEM', long: 'Quemado: su ataque físico hace la mitad' },
  par: { short: 'PAR', long: 'Paralizado: velocidad a la mitad y a veces no se mueve' },
  psn: { short: 'ENV', long: 'Envenenado' },
  tox: { short: 'TÓX', long: 'Gravemente envenenado' },
  slp: { short: 'DOR', long: 'Dormido' },
  frz: { short: 'CONG', long: 'Congelado' },
}

export function StatusChip({ status, className }: { status: StatusId | undefined; className?: string }) {
  if (!status) return null
  const s = STATUS[status]
  return (
    <span className={clsx('battle-d-status', className)} data-status={status} title={s.long}>
      <span aria-hidden>{s.short}</span>
      <span className="sr-only">{s.long}</span>
    </span>
  )
}

/** Tono de la barra de vida: verde, ámbar por debajo de la mitad y rojo por debajo del 20 %. */
export function hpTone(hp: number) {
  return hp > 50 ? 'high' : hp > 20 ? 'mid' : 'low'
}

/** Vida en %: la que se ha visto o, si no se ha visto aún, llena. */
export function hpOf(profile: MonProfile): number {
  if (profile.state?.fainted) return 0
  return profile.state?.hp ?? profile.set.hpPercent ?? 100
}

export function HpBar({
  hp,
  className,
  thin = false,
  label,
}: {
  hp: number
  className?: string
  thin?: boolean
  /** Nombre para lectores de pantalla ("Vida de Incineroar"). */
  label?: string
}) {
  const value = Math.max(0, Math.min(100, hp))
  return (
    <div
      role="meter"
      aria-label={label ?? 'Vida'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} %`}
      className={clsx('battle-d-hp', thin && 'battle-d-hp--thin', className)}
    >
      <span className="battle-d-hp-fill" data-tone={hpTone(value)} style={{ width: `${value}%` }} />
    </div>
  )
}

/**
 * Barra del daño sobre la vida que le queda: la parte sólida es lo que quita
 * seguro (mínimo), la rayada lo que puede quitar de más (hasta el máximo).
 */
export function DamageBar({ remaining, min, max }: { remaining: number; min: number; max: number }) {
  const hp = Math.max(0, Math.min(100, remaining))
  const lo = Math.min(hp, Math.max(0, min))
  const hi = Math.min(hp, Math.max(0, max))
  const left = hp - hi
  const ko = min >= hp
  return (
    <div className="battle-d-dmgbar" aria-hidden>
      <span className="battle-d-dmgbar-left" data-tone={hpTone(left)} style={{ width: `${left}%` }} />
      <span className="battle-d-dmgbar-maybe" style={{ left: `${left}%`, width: `${hi - lo}%` }} />
      <span className="battle-d-dmgbar-sure" data-ko={ko || undefined} style={{ left: `${hp - lo}%`, width: `${lo}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Jerga explicada                                                      */
/* ------------------------------------------------------------------ */

export const JARGON: Record<string, string> = {
  KO: 'Debilitarlo: dejarlo sin vida.',
  OHKO: 'KO directo: lo debilita de un solo golpe.',
  '2HKO': 'Lo debilita en 2 golpes. 3HKO, en 3, y así.',
  STAB: 'El ataque es de un tipo del propio Pokémon: pega ×1,5.',
  Rango: 'El daño varía un poco en cada golpe (del 85 % al 100 %): por eso se da un mínimo y un máximo.',
  Prioridad: 'Los ataques con prioridad (Fake Out, Sucker Punch…) van antes que los demás, sin mirar la velocidad.',
  Pañuelo: 'Choice Scarf: multiplica la velocidad ×1,5 pero obliga a repetir el mismo ataque.',
  Puntos:
    'En Champions no hay EVs: cada estadística recibe de 0 a 32 «puntos de estadística», y cada punto suma 1 al valor final.',
  EVs: 'Esfuerzo invertido en cada estadística (0-252): 4 EVs suman 1 punto a nivel 100.',
  Crítico: 'Golpe crítico: ×1,5 de daño e ignora pantallas y subidas de defensa del rival.',
  Ayuda: 'Helping Hand: el compañero sube ×1,5 el siguiente ataque de este turno.',
  Pantallas: 'Reflect y Light Screen: reducen el daño físico o especial (un tercio en dobles).',
  'Viento Afín': 'Tailwind: dobla la velocidad de tu lado durante 4 turnos.',
  'Espacio Raro': 'Trick Room: durante 5 turnos el más lento se mueve primero.',
}

/** Qué término de la jerga explica mejor una etiqueta de KO de la calculadora. */
export function jargonForLabel(label: string) {
  if (label.startsWith('KO directo')) return 'OHKO'
  if (/^\d+HKO/.test(label)) return '2HKO'
  return 'KO'
}

/**
 * Término con su explicación a un toque (no en hover: en el móvil no hay).
 * La explicación aparece debajo, dentro del flujo, y se lee sin taparse.
 */
export function Term({ term, children, className }: { term: string; children?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const reduce = useReducedMotion()
  const text = JARGON[term]
  if (!text) return <span className={className}>{children ?? term}</span>
  return (
    <span className={clsx('battle-d-term', className)}>
      <button
        type="button"
        className="battle-d-term-btn"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {children ?? term}
        <CircleHelp aria-hidden size={13} strokeWidth={2.4} className="opacity-60" />
        <span className="sr-only"> (¿qué significa?)</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.span
            id={id}
            role="note"
            className="battle-d-term-note"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Varios                                                               */
/* ------------------------------------------------------------------ */

/** "Choice Scarf" -> "choice-scarf": el slug de la PokéAPI para el icono del objeto. */
export function itemSlug(name: string | null | undefined) {
  if (!name) return null
  return name
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Porcentaje para las estimaciones: "56 %", "<1 %". */
export function pctText(pct: number) {
  if (pct < 1) return '<1 %'
  return `${Math.round(pct)} %`
}

export function SectionTitle({
  children,
  hint,
  id,
  className,
}: {
  children: React.ReactNode
  hint?: React.ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={clsx('mb-2 flex items-baseline justify-between gap-3', className)}>
      <h3 id={id} className="text-[13px] font-bold uppercase tracking-wider text-muted">
        {children}
      </h3>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}
