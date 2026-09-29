'use client'

import { useId } from 'react'
import { AlertCircle, Globe, Lock, PenLine } from 'lucide-react'
import { FieldLabel, Segmented } from '@/components/builder/fields'
import { FORMATS } from '@/components/builder/model'

export const NAME_MAX = 40
export const DESCRIPTION_MAX = 1000

export function TeamDetails({
  name,
  format,
  description,
  isPublic,
  nameError,
  nameRef,
  onName,
  onFormat,
  onDescription,
  onPublic,
}: {
  name: string
  format: string
  description: string
  isPublic: boolean
  nameError: string | null
  nameRef: React.RefObject<HTMLInputElement | null>
  onName: (value: string) => void
  onFormat: (value: string) => void
  onDescription: (value: string) => void
  onPublic: (value: boolean) => void
}) {
  const id = useId()
  const formatsId = `${id}-formats`
  const nameErrorId = `${id}-name-error`

  return (
    <section aria-labelledby={`${id}-title`} className="card p-4 sm:p-5">
      <h2 id={`${id}-title`} className="mb-4 flex items-center gap-2 text-base font-extrabold">
        <PenLine size={17} aria-hidden className="text-brand" />
        Datos del equipo
      </h2>

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <FieldLabel htmlFor={`${id}-name`} counter={{ value: name.length, max: NAME_MAX }}>
            Nombre del equipo
          </FieldLabel>
          <input
            ref={nameRef}
            id={`${id}-name`}
            value={name}
            onChange={(e) => onName(e.target.value)}
            maxLength={NAME_MAX}
            required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            placeholder="p. ej. Rain Team 2026"
            autoComplete="off"
            enterKeyHint="next"
            className="builder-input h-11 px-4 text-sm font-semibold"
          />
          {nameError && (
            <p id={nameErrorId} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
              <AlertCircle size={13} aria-hidden /> {nameError}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-format`}>Formato</FieldLabel>
          <input
            id={`${id}-format`}
            value={format}
            onChange={(e) => onFormat(e.target.value)}
            list={formatsId}
            autoComplete="off"
            className="builder-input h-11 px-4 text-sm"
          />
          <datalist id={formatsId}>
            {FORMATS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        {/* Atajos: en móvil el <datalist> apenas se ve, y así se elige de un toque.
            En md+ van a todo el ancho, bajo los dos campos, y caben en una línea. */}
        <div className="-mt-2 flex min-w-0 items-center gap-2 md:col-span-2">
          <span id={`${id}-formats-label`} className="shrink-0 text-xs text-muted max-md:sr-only">
            Formatos habituales:
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-formats-label`}
            className="builder-chip-row no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap md:overflow-visible"
          >
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format.trim() === f}
                onClick={() => onFormat(f)}
                className="builder-chip"
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <FieldLabel htmlFor={`${id}-description`} counter={{ value: description.length, max: DESCRIPTION_MAX }}>
            Descripción
          </FieldLabel>
          <textarea
            id={`${id}-description`}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="Cuenta la estrategia del equipo, los matchups complicados, cómo se juega…"
            className="builder-input block min-h-24 resize-y px-4 py-3 text-sm leading-relaxed"
          />
        </div>

        <Segmented
          legend="Visibilidad"
          className="md:col-span-2"
          size="lg"
          value={isPublic ? 'public' : 'private'}
          onChange={(v) => onPublic(v === 'public')}
          options={[
            {
              value: 'public',
              label: 'Público',
              description: 'Visible para toda la comunidad',
              icon: <Globe size={17} />,
            },
            {
              value: 'private',
              label: 'Privado',
              description: 'Sólo lo ves tú',
              icon: <Lock size={17} />,
            },
          ]}
        />
      </div>
    </section>
  )
}
