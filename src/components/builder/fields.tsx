'use client'

import { useId, useState } from 'react'
import clsx from 'clsx'
import { clampNum } from '@/components/builder/model'

/**
 * Campo numérico con borrador: mientras se escribe se puede dejar vacío o
 * pasarse del máximo sin que salte el valor por defecto a mitad de tecleo. Lo
 * válido se aplica al momento (las estadísticas se ven en vivo) y al salir del
 * campo se ajusta a los límites.
 */
export function NumberField({
  value,
  min,
  max,
  fallback,
  step = 1,
  onCommit,
  className,
  ...aria
}: {
  value: number
  min: number
  max: number
  fallback: number
  step?: number
  onCommit: (value: number) => void
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
  id?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      {...aria}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw.trim() !== '' && !Number.isNaN(Number(raw))) onCommit(clampNum(raw, min, max, fallback))
      }}
      onBlur={() => {
        if (draft === null) return
        onCommit(clampNum(draft, min, max, fallback))
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      onFocus={(e) => e.currentTarget.select()}
      className={clsx('builder-input builder-number', className)}
    />
  )
}

export type SegmentOption<T extends string> = {
  value: T
  label: React.ReactNode
  /** Nombre para lectores de pantalla cuando la etiqueta es sólo un símbolo (♂, ♀…). */
  srLabel?: string
  icon?: React.ReactNode
  description?: React.ReactNode
}

/**
 * Opciones en píldora hechas con radios nativos: las flechas del teclado ya
 * se mueven entre ellas y los lectores de pantalla las anuncian como grupo.
 */
export function Segmented<T extends string>({
  legend,
  legendClassName,
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  legend: string
  legendClassName?: string
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  size?: 'md' | 'lg'
  className?: string
}) {
  const name = useId()

  return (
    <fieldset className={clsx('min-w-0', className)}>
      <legend className={clsx('mb-1 block text-xs font-semibold', legendClassName)}>{legend}</legend>
      <div className={clsx('builder-seg', size === 'lg' && 'max-sm:flex-col')} data-size={size}>
        {options.map((o) => (
          <label key={o.value} className="builder-seg-option">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span>
              {o.icon && (
                <span
                  aria-hidden
                  className={clsx(
                    'builder-seg-icon grid shrink-0 place-items-center transition-colors duration-(--dur)',
                    size === 'lg' ? 'size-9 rounded-xl bg-surface text-muted' : 'size-5',
                  )}
                >
                  {o.icon}
                </span>
              )}
              <span className="min-w-0">
                <span aria-hidden={o.srLabel ? true : undefined} className="block truncate">
                  {o.label}
                </span>
                {o.srLabel && <span className="sr-only">{o.srLabel}</span>}
                {o.description && (
                  <span className="block truncate text-xs font-normal text-muted">{o.description}</span>
                )}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Etiqueta de campo con contador opcional a la derecha ("12/40"). */
export function FieldLabel({
  htmlFor,
  children,
  counter,
  className,
}: {
  htmlFor: string
  children: React.ReactNode
  counter?: { value: number; max: number }
  className?: string
}) {
  const near = counter && counter.value >= counter.max * 0.9
  return (
    <div className={clsx('mb-1 flex items-baseline justify-between gap-2', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {children}
      </label>
      {counter && (
        <span
          aria-hidden
          className={clsx('text-[11px] font-semibold tabular-nums', near ? 'text-warning' : 'text-muted')}
        >
          {counter.value}/{counter.max}
        </span>
      )}
    </div>
  )
}

/** Barra de "PS" de un build: verde completo, ámbar a medias, rojo casi vacío. */
export function BuildMeter({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  const ratio = total > 0 ? done / total : 0
  const tone = ratio >= 1 ? 'success' : ratio >= 0.5 ? 'warning' : 'danger'
  return (
    <span aria-hidden className={clsx('builder-hp', className)} data-tone={tone}>
      <span style={{ '--hp': ratio } as React.CSSProperties} />
    </span>
  )
}
