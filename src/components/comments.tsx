'use client'

import { useEffect, useId, useLayoutEffect, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { LoaderCircle, MessageCircle, Send, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { addComment, deleteComment } from '@/app/actions/social'
import { Avatar } from '@/components/ui/avatar'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast'
import { timeAgo } from '@/lib/format'

export interface CommentItem {
  id: string
  body: string
  created_at: string
  author: { id: string; username: string; avatar_url: string | null }
}

const MAX_LENGTH = 500
const OPTIMISTIC = 'optimistic-'
const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const

// Zona horaria fija: la fecha completa sale igual en el servidor y en el navegador.
const fullDate = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})

const noopSubscribe = () => () => {}

/** «⌘ + Enter» en Apple y «Ctrl + Enter» en el resto; null hasta hidratar. */
function useSendShortcut(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘ + Enter' : 'Ctrl + Enter'),
    () => null,
  )
}

/** Vuelve a pintar cada minuto para que "ahora" pase a "hace 1 minuto" sin recargar. */
function useMinuteTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
}

type Change = { type: 'add'; comment: CommentItem } | { type: 'remove'; id: string }

export function Comments({
  teamId,
  comments,
  me,
  teamAuthorId,
}: {
  teamId: string
  comments: CommentItem[]
  me: { id: string; username: string; avatar_url: string | null }
  /** Para marcar los comentarios del autor del equipo. */
  teamAuthorId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const hintId = useId()
  const shortcut = useSendShortcut()
  useMinuteTick()

  // Un solo reductor para alta y baja: así el borrado también es optimista y la
  // lista no espera al viaje de ida y vuelta al servidor.
  const [list, apply] = useOptimistic(comments, (prev, change: Change) =>
    change.type === 'add' ? [...prev, change.comment] : prev.filter((c) => c.id !== change.id),
  )

  // Al confirmarse, el comentario optimista se cambia por el real, que trae otro
  // id. Si la key cambiase, la lista lo animaría como "sale uno y entra otro".
  // Los míos nuevos se identifican por su texto y el orden en que se repite,
  // igual para el optimista que para el real.
  const [initialIds] = useState(() => new Set(comments.map((c) => c.id)))
  const repeats = new Map<string, number>()
  const keyed = list.map((comment) => {
    if (comment.author.id !== me.id || initialIds.has(comment.id)) return { comment, key: comment.id }
    const n = repeats.get(comment.body) ?? 0
    repeats.set(comment.body, n + 1)
    return { comment, key: `mine-${n}-${comment.body}` }
  })

  // El cuadro crece con el texto hasta un tope; a partir de ahí, scroll interno.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  const body = draft.trim()
  const canSend = body.length > 0 && !pending

  function submit() {
    if (!canSend) return
    setDraft('')
    const optimistic: CommentItem = {
      id: `${OPTIMISTIC}${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
      author: me,
    }

    startTransition(async () => {
      apply({ type: 'add', comment: optimistic })
      let error: string | null
      try {
        const result = await addComment(teamId, body)
        error = result.error ?? null
      } catch {
        error = 'No se pudo publicar el comentario.'
      }
      if (error) {
        // El texto vuelve al cuadro (si no se ha empezado otro) para reintentar sin reescribirlo.
        setDraft((current) => current || body)
        toast(error, { tone: 'error', description: 'Tu comentario sigue en el cuadro de texto.' })
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      apply({ type: 'remove', id })
      let error: string | null
      try {
        const result = await deleteComment(id, teamId)
        error = result.error ?? null
      } catch {
        error = 'No se pudo eliminar el comentario.'
      }
      if (error) toast(error, { tone: 'error', description: 'Lo hemos devuelto a su sitio.' })
    })
  }

  return (
    <section id="comentarios" aria-labelledby={titleId} tabIndex={-1} className="team-section outline-none">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="flex items-center gap-2 text-xl font-extrabold leading-tight tracking-tight">
            Comentarios
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-surface-2 px-2 text-xs font-bold text-muted shadow-card">
              <AnimatedNumber value={list.length} />
            </span>
          </h2>
          <p className="text-sm text-muted">Opiniones, preguntas y consejos de otros entrenadores.</p>
        </div>
      </div>

      {/* popLayout: lo que sale deja de ocupar sitio al instante y el resto se
          recoloca con un muelle en lugar de saltar al terminar la salida. */}
      <ul className="relative flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {list.length === 0 && (
            <motion.li
              key="empty"
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              transition={SPRING}
            >
              <EmptyState
                icon={<MessageCircle size={26} />}
                title="Todavía no hay comentarios"
                description="Rompe el hielo: cuenta qué te parece el equipo o pregunta por algún set."
                className="py-8"
              />
            </motion.li>
          )}
          {keyed.map(({ comment, key }) => (
            <CommentRow
              key={key}
              comment={comment}
              mine={comment.author.id === me.id}
              byTeamAuthor={comment.author.id === teamAuthorId}
              onDelete={() => remove(comment.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mt-4 flex items-end gap-2.5 sm:gap-3"
      >
        <Avatar src={me.avatar_url} name={me.username} size={40} className="mb-1 max-sm:hidden" />

        <div className="team-composer-box min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${titleId}-input`}>
            Escribe un comentario
          </label>
          <textarea
            id={`${titleId}-input`}
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Escribe un comentario…"
            aria-describedby={hintId}
            enterKeyHint="enter"
            className="team-composer-input block max-h-48 min-h-12 w-full resize-none overflow-y-auto bg-transparent px-4 pb-1 pt-3 text-base leading-relaxed outline-none placeholder:text-muted sm:text-[15px]"
          />
          <div className="flex items-center justify-between gap-3 px-4 pb-2.5">
            <p id={hintId} className="min-w-0 truncate text-[11px] text-muted">
              <span className="sr-only">Máximo {MAX_LENGTH} caracteres. </span>
              {shortcut && (
                <span className="pointer-coarse:hidden">
                  <kbd className="font-sans font-semibold text-ink/80">{shortcut}</kbd> para enviar
                </span>
              )}
            </p>
            <CharacterCounter length={draft.length} max={MAX_LENGTH} />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Publicar comentario"
          title="Publicar comentario"
          className="btn btn-primary btn-lg btn-icon mb-1"
        >
          {pending ? (
            <LoaderCircle size={19} aria-hidden className="animate-spin" />
          ) : (
            <Send size={19} aria-hidden className="-translate-x-px translate-y-px" />
          )}
        </button>
      </form>
    </section>
  )
}

function CommentRow({
  comment,
  mine,
  byTeamAuthor,
  onDelete,
}: {
  comment: CommentItem
  mine: boolean
  byTeamAuthor: boolean
  onDelete: () => void
}) {
  const optimistic = comment.id.startsWith(OPTIMISTIC)
  const profile = `/u/${comment.author.username}`

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: optimistic ? 0.6 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={SPRING}
      aria-busy={optimistic || undefined}
    >
      <article className="flex gap-3 rounded-card border border-line bg-surface p-3 sm:p-4">
        {/* Duplica el enlace del nombre: fuera del orden de tabulación y del árbol accesible. */}
        <Link href={profile} tabIndex={-1} aria-hidden className="pressable h-fit shrink-0 rounded-full">
          <Avatar src={comment.author.avatar_url} name={comment.author.username} size={40} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
            <Link href={profile} className="truncate font-bold transition-colors hover:text-brand">
              @{comment.author.username}
            </Link>
            {byTeamAuthor && (
              <span className="inline-flex h-5 items-center rounded-full bg-brand-soft px-2 text-[10px] font-bold uppercase tracking-wide text-brand">
                Autor
              </span>
            )}
            {optimistic ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <LoaderCircle size={11} aria-hidden className="animate-spin" /> Enviando…
              </span>
            ) : (
              // La hora relativa depende del reloj: puede diferir un minuto entre servidor y cliente.
              <time
                dateTime={comment.created_at}
                title={fullDate.format(new Date(comment.created_at))}
                className="text-xs text-muted"
                suppressHydrationWarning
              >
                {timeAgo(comment.created_at)}
              </time>
            )}
          </p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">
            {comment.body}
          </p>
        </div>

        {mine && !optimistic && <DeleteCommentButton onConfirm={onDelete} />}
      </article>
    </motion.li>
  )
}

/**
 * Papelera en dos pasos: el primer toque la "arma" (se vuelve roja y pide
 * confirmación) y el segundo borra. Se desarma sola, al salir o con Esc.
 */
function DeleteCommentButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && armed) {
          e.stopPropagation()
          setArmed(false)
        }
      }}
      aria-label={armed ? 'Confirmar: eliminar comentario' : 'Eliminar comentario'}
      title={armed ? 'Pulsa otra vez para eliminar' : 'Eliminar comentario'}
      className={clsx(
        '-mr-1 -mt-1 flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-full text-xs font-bold transition-colors duration-(--dur)',
        armed
          ? 'bg-danger-soft px-3 text-danger'
          : 'text-muted hover:bg-danger-soft hover:text-danger',
      )}
    >
      <Trash2 size={16} aria-hidden className={clsx(armed && 'animate-wiggle')} />
      {armed && <span aria-hidden>¿Eliminar?</span>}
    </button>
  )
}

/** Anillo de progreso con el recuento; ámbar al acercarse al tope, rojo al llegar. */
function CharacterCounter({ length, max }: { length: number; max: number }) {
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const ratio = Math.min(1, length / max)
  const tone = length >= max ? 'var(--danger)' : length >= max * 0.9 ? 'var(--warning)' : 'var(--brand)'

  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums text-muted">
      <span className={clsx(length >= max * 0.9 && (length >= max ? 'text-danger' : 'text-warning'))}>
        {length}/{max}
      </span>
      <svg viewBox="0 0 20 20" className="team-counter-ring size-5 -rotate-90">
        <circle cx="10" cy="10" r={radius} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          opacity={length === 0 ? 0 : 1}
        />
      </svg>
    </span>
  )
}
