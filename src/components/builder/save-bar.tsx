'use client'

import { AlertCircle, CheckCircle2, LoaderCircle, Save, Send, X } from 'lucide-react'
import clsx from 'clsx'
import { MAX_SLOTS } from '@/components/builder/model'

type SaveProps = {
  editing: boolean
  pending: boolean
  dirty: boolean
  filled: number
  error: string | null
  onSave: () => void
  onCancel: () => void
}

function saveLabel(editing: boolean, pending: boolean) {
  if (pending) return editing ? 'Guardando…' : 'Publicando…'
  return editing ? 'Guardar cambios' : 'Publicar equipo'
}

function SaveIcon({ editing, pending }: { editing: boolean; pending: boolean }) {
  if (pending) return <LoaderCircle size={17} aria-hidden className="animate-spin" />
  return editing ? <Save size={17} aria-hidden /> : <Send size={17} aria-hidden />
}

/** Estado de guardado en una línea: cambios pendientes, error o todo al día. */
function SaveStatus({ editing, dirty, filled, error, compact }: SaveProps & { compact?: boolean }) {
  if (error) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-danger">
        <AlertCircle size={14} aria-hidden className="shrink-0" />
        <span className={clsx('min-w-0', compact ? 'truncate' : 'line-clamp-2')}>{error}</span>
      </span>
    )
  }
  if (dirty) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="builder-dirty-dot size-2 shrink-0 rounded-full bg-warning" />
        <span className="truncate">{editing ? 'Cambios sin guardar' : 'Borrador sin publicar'}</span>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <CheckCircle2 size={14} aria-hidden className="shrink-0 text-success" />
      <span className="truncate">{editing ? 'Sin cambios' : 'Empieza eligiendo un Pokémon'}</span>
    </span>
  )
}

/**
 * Barra fija abajo en móvil y tableta, sobre la navegación inferior (y sobre
 * el pie en md). En escritorio la sustituye SaveCard, en la columna lateral.
 */
export function SaveBar(props: SaveProps) {
  const { editing, pending, filled, onSave, onCancel } = props
  return (
    <div className="builder-savebar fixed inset-x-0 z-30 px-3 sm:px-4 lg:hidden">
      <div className="glass mx-auto flex max-w-[680px] items-center gap-2 rounded-2xl border border-line p-2 shadow-float">
        <button
          type="button"
          onClick={onCancel}
          aria-label={editing ? 'Cancelar la edición' : 'Cancelar'}
          title="Cancelar"
          className="btn btn-ghost btn-icon text-muted hover:text-ink"
        >
          <X size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 text-xs leading-tight">
          <p className="font-bold tabular-nums">
            {filled}/{MAX_SLOTS} Pokémon
          </p>
          <p role="status" className="mt-0.5 text-muted">
            <SaveStatus {...props} compact />
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          aria-busy={pending || undefined}
          className="btn btn-primary shine shrink-0 px-4"
        >
          <SaveIcon editing={editing} pending={pending} />
          <span className="max-[359px]:sr-only">{editing ? (pending ? 'Guardando…' : 'Guardar') : pending ? 'Publicando…' : 'Publicar'}</span>
        </button>
      </div>
    </div>
  )
}

export function SaveCard(props: SaveProps) {
  const { editing, pending, onSave, onCancel } = props
  return (
    <div className="card hidden p-4 lg:block">
      <p role="status" className="mb-3 text-xs text-muted">
        <SaveStatus {...props} />
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        aria-busy={pending || undefined}
        className="btn btn-primary btn-lg shine w-full"
      >
        <SaveIcon editing={editing} pending={pending} />
        {saveLabel(editing, pending)}
      </button>
      <button type="button" onClick={onCancel} className="btn btn-ghost mt-2 w-full text-muted hover:text-ink">
        Cancelar
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">
        Atajo: <kbd className="shell-kbd">Ctrl</kbd> + <kbd className="shell-kbd">S</kbd>
      </p>
    </div>
  )
}
