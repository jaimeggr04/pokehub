'use client'

import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { STAT_LABELS, STAT_NAMES_ES, computeStat, type StatKey } from '@/lib/pokemon'

// Orden de los juegos desde Espada y Escudo: PS arriba y en el sentido de las agujas del reloj.
const RADAR_ORDER: StatKey[] = ['hp', 'atk', 'def', 'spe', 'spd', 'spa']

const W = 240
const H = 232
const CX = 120
const CY = 116
const R = 80
const RINGS = [0.25, 0.5, 0.75, 1]

function angle(i: number) {
  return ((-90 + i * 60) * Math.PI) / 180
}

function point(i: number, r: number): [number, number] {
  const a = angle(i)
  // Redondeo a décimas: el `d` resultante es corto y estable entre servidor y cliente.
  return [Math.round((CX + r * Math.cos(a)) * 10) / 10, Math.round((CY + r * Math.sin(a)) * 10) / 10]
}

function polygon(radii: number[]) {
  return radii.map((r, i) => `${i === 0 ? 'M' : 'L'}${point(i, r).join(' ')}`).join(' ') + ' Z'
}

/**
 * Tope de la escala: lo que daría una stat base 160 con 31 IV y 252 EV al
 * nivel del Pokémon. Así dos Pokémon del mismo nivel se comparan a simple
 * vista, y si alguno se sale (el PS de Blissey) la escala se estira con él.
 */
export function statScaleMax(level: number, values?: Record<StatKey, number> | null) {
  const reference = computeStat('atk', 160, 31, 252, level, null)
  const highest = values ? Math.max(...Object.values(values)) : 0
  return Math.max(reference, Math.ceil(highest * 1.04))
}

/**
 * Hexágono de estadísticas finales. Se dibuja desde el centro con un muelle;
 * sin datos (cargando) pinta sólo la rejilla. Las stats que sube o baja la
 * naturaleza se marcan en verde y rojo en sus etiquetas.
 */
export function StatRadar({
  values,
  level = 50,
  up,
  down,
  decorative = false,
  className,
}: {
  values: Record<StatKey, number> | null
  level?: number
  up?: StatKey | null
  down?: StatKey | null
  /** Si al lado ya hay una tabla con los mismos datos, el lector de pantalla no los oye dos veces. */
  decorative?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const max = statScaleMax(level, values)
  const radii = RADAR_ORDER.map((k) => (values ? Math.max(0.04, Math.min(1, values[k] / max)) * R : 0))
  const center = polygon(RADAR_ORDER.map(() => 0))
  const shape = polygon(radii)

  const label = values
    ? `Estadísticas finales: ${RADAR_ORDER.map((k) => `${STAT_NAMES_ES[k]} ${values[k]}`).join(', ')}`
    : 'Cargando estadísticas'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
      className={clsx('block h-auto w-full', className)}
    >
      {/* Rejilla */}
      <g fill="none" stroke="var(--border)" strokeWidth={1}>
        {RINGS.map((ring) => (
          <path
            key={ring}
            d={polygon(RADAR_ORDER.map(() => ring * R))}
            strokeDasharray={ring === 1 ? undefined : '3 4'}
            opacity={ring === 1 ? 1 : 0.8}
          />
        ))}
        {RADAR_ORDER.map((k, i) => {
          const [x, y] = point(i, R)
          return <line key={k} x1={CX} y1={CY} x2={x} y2={y} opacity={0.7} />
        })}
      </g>

      {values && (
        <>
          <motion.path
            fill="var(--brand)"
            fillOpacity={0.28}
            stroke="var(--brand)"
            strokeWidth={2.25}
            strokeLinejoin="round"
            initial={reduceMotion ? false : { d: center, opacity: 0 }}
            animate={{ d: shape, opacity: 1 }}
            transition={{
              d: { type: 'spring', stiffness: 150, damping: 17, mass: 0.9, delay: 0.12 },
              opacity: { duration: 0.2, delay: 0.12 },
            }}
          />
          {RADAR_ORDER.map((k, i) => {
            const [x, y] = point(i, radii[i])
            return (
              <motion.circle
                key={k}
                r={3.5}
                fill="var(--brand)"
                stroke="var(--bg-elevated)"
                strokeWidth={1.5}
                initial={reduceMotion ? false : { cx: CX, cy: CY, opacity: 0 }}
                animate={{ cx: x, cy: y, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 150,
                  damping: 17,
                  mass: 0.9,
                  delay: 0.12 + i * 0.03,
                }}
              />
            )
          })}
        </>
      )}

      {/* Etiquetas: abreviatura y, debajo, el valor final. */}
      {RADAR_ORDER.map((k, i) => {
        const [px, py] = point(i, R + 12)
        const cos = Math.cos(angle(i))
        const anchor = Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end'
        // Arriba el texto crece hacia arriba y abajo hacia abajo; en los lados, centrado en el vértice.
        const top = i === 0
        const bottom = i === 3
        const y = top ? py - 14 : bottom ? py + 8 : py - 3
        const tone = k === up ? 'fill-success' : k === down ? 'fill-danger' : 'fill-muted'
        return (
          <text key={k} x={px} y={y} textAnchor={anchor} aria-hidden className="select-none">
            <tspan className={clsx('text-[10px] font-semibold uppercase tracking-wide', tone)}>
              {STAT_LABELS[k]}
              {k === up ? ' +' : k === down ? ' −' : ''}
            </tspan>
            <tspan x={px} dy={12} className="fill-ink text-[11px] font-bold tabular-nums">
              {values ? values[k] : '—'}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
