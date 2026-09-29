'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardPaste, Download, LoaderCircle, X } from 'lucide-react'
import clsx from 'clsx'
import { MAX_SLOTS, showdownFormatLabel } from '@/components/builder/model'
import { toast } from '@/components/ui/toast'
import { parseShowdownTeam } from '@/lib/showdown'

const PLACEHOLDER = `=== [gen9vgc2024regh] Mi equipo ===

Pelipper (F) @ Damp Rock
Ability: Drizzle
Level: 50
EVs: 252 HP / 4 Def / 252 Spe
Timid Nature
- Hurricane
- Scald
- Tailwind
- Protect`

/**
 * Panel para pegar un equipo de Pokémon Showdown. El análisis de la vista
 * previa es puro tratamiento de texto (sin red), así que se hace en cada
 * tecla: antes de importar ya se sabe cuántos Pokémon se han reconocido.
 */
export function ImportPanel({
  filledCount,
  onImport,
  onClose,
}: {
  /** Pokémon que ya hay en el equipo: la importación los sustituye. */
  filledCount: number
  onImport: (text: string) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const statusId = `${id}-status`

  // En escritorio se puede pegar directamente; en táctil, enfocar abriría el
  // teclado y taparía medio panel (para eso está el botón "Pegar").
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus({ preventScroll: true })
  }, [])

  const preview = useMemo(() => (text.trim() ? parseShowdownTeam(text) : null), [text])
  const found = preview?.builds.length ?? 0
  const formatLabel = showdownFormatLabel(preview?.format ?? null)
  const names = preview?.builds.slice(0, MAX_SLOTS).map((b) => b.pokemon_name) ?? []

  async function run() {
    if (busy || found === 0) return
    setBusy(true)
    try {
      await onImport(text)
    } finally {
      setBusy(false)
    }
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip.trim()) {
        toast('El portapapeles está vacío', { description: 'Copia antes el equipo en Showdown (Import/Export).' })
        return
      }
      setText(clip)
    } catch {
      toast('No se ha podido leer el portapapeles', {
        description: 'Pega el texto a mano en el recuadro (mantén pulsado o Ctrl+V).',
      })
      textareaRef.current?.focus()
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) {
          e.stopPropagation()
          onClose()
        }
      }}
      className="card builder-import p-4 sm:p-5"
    >
      <div className="mb-3 flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-brand-fg shadow-card">
          <Download size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-base font-extrabold leading-tight">
            Importar de Pokémon Showdown
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Pega el texto de «Import/Export». También valen equipos en español.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar el importador" className="btn btn-ghost btn-icon btn-sm -mr-1 -mt-1 text-muted hover:text-ink">
          <X size={18} aria-hidden />
        </button>
      </div>

      <label htmlFor={`${id}-text`} className="sr-only">
        Texto del equipo en formato Showdown
      </label>
      <textarea
        ref={textareaRef}
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void run()
          }
        }}
        rows={14}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-describedby={statusId}
        placeholder={PLACEHOLDER}
        className="builder-input builder-code block min-h-[16rem] resize-y overflow-auto p-3 font-mono text-xs leading-relaxed sm:min-h-[22rem]"
      />

      <div id={statusId} aria-live="polite" className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5 text-xs">
        {text.trim() && (
          <span
            className={clsx(
              'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-bold',
              found === 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
            )}
          >
            {found === 0 ? <AlertTriangle size={13} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
            {found === 0
              ? 'No se ha reconocido ningún Pokémon'
              : `${found} Pokémon detectado${found === 1 ? '' : 's'}`}
          </span>
        )}
        {preview?.name && (
          <span className="inline-flex h-7 max-w-full items-center truncate rounded-full bg-surface-2 px-2.5 font-semibold shadow-card">
            Equipo: «{preview.name}»
          </span>
        )}
        {formatLabel && (
          <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 font-semibold shadow-card">
            {formatLabel}
          </span>
        )}
        {found > MAX_SLOTS && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 font-bold text-warning">
            <AlertTriangle size={13} aria-hidden /> Sólo se importarán los {MAX_SLOTS} primeros
          </span>
        )}
      </div>

      {names.length > 0 && (
        <p className="mt-2 truncate text-xs text-muted">
          <span className="font-semibold text-ink">Se importarán:</span> {names.join(' · ')}
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Se reconocen la cabecera del equipo, motes, género, objeto, habilidad, naturaleza, nivel, teratipo,
        IVs/EVs y hasta cuatro movimientos. Lo que no se pueda traducir se importa igual y te diremos qué revisar.
      </p>

      {filledCount > 0 && found > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-warning">
          <AlertTriangle size={13} aria-hidden className="mt-px shrink-0" />
          Sustituirá a {filledCount === 1 ? 'el Pokémon que tienes ahora' : `los ${filledCount} Pokémon que tienes ahora`}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={pasteFromClipboard} className="btn btn-soft max-sm:flex-1">
          <ClipboardPaste size={16} aria-hidden /> Pegar
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy || found === 0}
          aria-busy={busy || undefined}
          className="btn btn-primary max-sm:flex-1"
        >
          {busy ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Download size={16} aria-hidden />}
          {busy ? 'Importando…' : found > 0 ? `Importar ${Math.min(found, MAX_SLOTS)}` : 'Importar'}
        </button>
      </div>
      <p className="mt-2 hidden text-right text-[11px] text-muted sm:block">
        Atajo: <kbd className="shell-kbd">Ctrl</kbd> + <kbd className="shell-kbd">Intro</kbd>
      </p>
    </section>
  )
}
