'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { MessageSquare, Search, SquarePen, X } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { useMounted } from '@/lib/hooks'
import {
  CHAT_TIME_ZONE,
  displayName,
  fullDate,
  getConversationSummary,
  isUnread,
  listTime,
  previewText,
  toTime,
  type ConversationSummary,
  type LastMessage,
} from '@/lib/chat'
import type { MessageRow } from '@/lib/database.types'

/* ---------------------------------------------------------------
   Avisos entre la sala de chat y las listas.
   Un registro a nivel de módulo: la lista del lateral se entera al momento
   de lo que pasa en la sala y, si la lista se vuelve a montar desde la caché
   del router (botón atrás), recupera lo que se perdió mientras no estaba.
   --------------------------------------------------------------- */

export type InboxPatch = {
  conversationId: string
  /** Último mensaje conocido de la conversación. */
  last?: LastMessage
  /** Hasta dónde he leído yo. */
  readAt?: string
}

const patches = new Map<string, InboxPatch>()
const patchListeners = new Set<(patch: InboxPatch) => void>()

function later(a: string | undefined, b: string | undefined) {
  if (!a) return b
  if (!b) return a
  return toTime(b) > toTime(a) ? b : a
}

/** La sala informa de mensajes nuevos o de lectura; lo aplican todas las listas montadas. */
export function reportConversation(patch: InboxPatch) {
  const prev = patches.get(patch.conversationId)
  const newest =
    prev?.last && patch.last
      ? toTime(patch.last.created_at) >= toTime(prev.last.created_at)
        ? patch.last
        : prev.last
      : (patch.last ?? prev?.last)
  const merged: InboxPatch = {
    conversationId: patch.conversationId,
    last: newest,
    readAt: later(prev?.readAt, patch.readAt),
  }
  patches.set(patch.conversationId, merged)
  patchListeners.forEach((listener) => listener(merged))
}

function applyPatch(item: ConversationSummary, patch: InboxPatch | undefined): ConversationSummary {
  if (!patch) return item
  let last = item.last
  let lastMessageAt = item.last_message_at
  let readAt = item.last_read_at

  if (patch.last && (!last || toTime(patch.last.created_at) > toTime(last.created_at))) {
    last = patch.last
    lastMessageAt = later(lastMessageAt, patch.last.created_at) ?? lastMessageAt
  }
  if (patch.readAt && toTime(patch.readAt) > toTime(readAt)) readAt = patch.readAt
  if (last === item.last && readAt === item.last_read_at) return item

  return {
    ...item,
    last,
    last_message_at: lastMessageAt,
    last_read_at: readAt,
    preview: last ? previewText(last) : null,
    unread: isUnread(last, readAt),
  }
}

function byRecent(a: ConversationSummary, b: ConversationSummary) {
  return toTime(b.last_message_at) - toTime(a.last_message_at)
}

// Sin tildes ni mayúsculas: «jose» encuentra a «José».
function fold(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

let channelSeq = 0

/* ---------------------------------------------------------------
   Lista
   --------------------------------------------------------------- */

/**
 * Lista de conversaciones en vivo: se reordena, actualiza la vista previa y
 * marca lo no leído en cuanto llega un mensaje por tiempo real.
 * - `inbox`: la de /messages (página en móvil, columna lateral en escritorio).
 * - `compact`: el panel de la portada, con las 4 más recientes.
 */
export function ConversationList({
  initial,
  meId,
  now: serverNow,
  variant = 'inbox',
}: {
  initial: ConversationSummary[]
  meId: string
  /** Date.now() del servidor: las horas relativas coinciden al hidratar. */
  now: number
  variant?: 'inbox' | 'compact'
}) {
  const compact = variant === 'compact'
  const pathname = usePathname()
  const mounted = useMounted()
  const timeZone = mounted ? undefined : CHAT_TIME_ZONE
  const searchId = useId()

  const [items, setItems] = useState(initial)
  const [now, setNow] = useState(serverNow)
  const [query, setQuery] = useState('')

  const activeId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null

  // Datos nuevos del servidor (montaje o router.refresh) + lo que la sala
  // haya contado mientras tanto. En un efecto para no desentonar al hidratar.
  useEffect(() => {
    setItems(initial.map((item) => applyPatch(item, patches.get(item.id))).sort(byRecent))
  }, [initial])

  // Reloj para «ahora», «5 min»… Con un tic cada 30 s basta.
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })

  useEffect(() => {
    let active = true
    const fetching = new Set<string>()

    function onPatch(patch: InboxPatch) {
      const id = patch.conversationId
      if (itemsRef.current.some((item) => item.id === id)) {
        setItems((prev) => {
          const index = prev.findIndex((item) => item.id === id)
          if (index === -1) return prev
          const updated = applyPatch(prev[index], patch)
          if (updated === prev[index]) return prev
          const next = [...prev]
          next[index] = updated
          return next.sort(byRecent)
        })
        return
      }
      // Un chat que la lista no tenía (alguien me escribe por primera vez, o
      // uno antiguo que revive): se pide sólo ese, no la página entera.
      if (!patch.last || fetching.has(id)) return
      fetching.add(id)
      void getConversationSummary(createClient(), meId, id).then((summary) => {
        fetching.delete(id)
        if (!active || !summary) return
        setItems((prev) =>
          prev.some((item) => item.id === id)
            ? prev
            : [...prev, applyPatch(summary, patches.get(id))].sort(byRecent),
        )
      })
    }

    patchListeners.add(onPatch)
    return () => {
      active = false
      patchListeners.delete(onPatch)
    }
  }, [meId])

  // Un canal propio por lista montada (nombre único): sin filtro, porque RLS
  // ya sólo entrega los mensajes de mis conversaciones.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`inbox:${meId}:${++channelSeq}:${Date.now()}`)
      .on<MessageRow>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new
        if (!row?.conversation_id) return
        reportConversation({
          conversationId: row.conversation_id,
          last: { body: row.body, created_at: row.created_at, mine: row.sender_id === meId },
        })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [meId])

  const unreadCount = items.filter((c) => c.unread && c.id !== activeId).length
  const folded = fold(query.trim())
  const visible = useMemo(() => {
    const list = compact ? items.slice(0, 4) : items
    if (!folded) return list
    return list.filter((c) => fold(`${c.other.display_name ?? ''} ${c.other.username}`).includes(folded))
  }, [items, compact, folded])

  if (compact) {
    return (
      <>
        <h2 className="mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <span className="relative">
            <MessageSquare size={18} aria-hidden />
            {unreadCount > 0 && (
              <span
                key={unreadCount}
                aria-hidden
                className="absolute -right-2 -top-2 grid h-4 min-w-4 animate-pop place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-fg tabular-nums"
              >
                {unreadCount}
              </span>
            )}
          </span>
          Mensajes
          {unreadCount > 0 && <span className="sr-only">({unreadCount} sin leer)</span>}
        </h2>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-3 py-5 text-center">
            <p className="text-xs text-muted">Aún no tienes conversaciones. Entra en un perfil y escribe a alguien.</p>
            <Link href="/search?tipo=entrenadores" className="btn btn-soft btn-sm">
              Buscar entrenadores
            </Link>
          </div>
        ) : (
          <Rows items={visible} activeId={activeId} now={now} timeZone={timeZone} compact />
        )}

        <Link
          href="/messages"
          className="mt-3 flex min-h-10 items-center justify-center rounded-full text-xs font-semibold text-muted underline-offset-2 transition-colors hover:text-brand hover:underline"
        >
          Ver todos los chats
        </Link>
      </>
    )
  }

  const Heading = activeId ? 'h2' : 'h1'

  return (
    <section
      aria-labelledby={`${searchId}-title`}
      className="card flex flex-col overflow-hidden lg:chat-pane-h"
    >
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Heading id={`${searchId}-title`} className="flex min-w-0 items-center gap-2 text-xl font-extrabold">
          Mensajes
          {unreadCount > 0 && (
            <span
              key={unreadCount}
              className="grid h-6 min-w-6 animate-pop place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-fg tabular-nums"
            >
              {unreadCount}
              <span className="sr-only"> sin leer</span>
            </span>
          )}
        </Heading>
        <Link
          href="/search?tipo=entrenadores"
          aria-label="Nuevo chat: buscar entrenadores"
          title="Nuevo chat"
          className="btn btn-soft btn-icon ml-auto"
        >
          <SquarePen size={18} aria-hidden />
        </Link>
      </header>

      {items.length > 3 && (
        <div role="search" className="px-3 pb-2">
          <label htmlFor={`${searchId}-q`} className="sr-only">
            Buscar conversación
          </label>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={`${searchId}-q`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  setQuery('')
                }
              }}
              placeholder="Buscar conversación"
              autoComplete="off"
              className="chat-search h-10 w-full rounded-full border border-line bg-surface-2 pl-10 pr-10 text-base outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:text-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      <motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {items.length === 0 ? (
          <EmptyState
            className="border-0! bg-transparent!"
            title="Aún no tienes conversaciones"
            description="Entra en el perfil de un entrenador y pulsa «Mensaje» para empezar a hablar."
            action={
              <Link href="/search?tipo=entrenadores" className="btn btn-primary">
                Buscar entrenadores
              </Link>
            }
          />
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted" role="status">
            Ningún chat coincide con «{query.trim()}».
          </p>
        ) : (
          <Rows items={visible} activeId={activeId} now={now} timeZone={timeZone} />
        )}
      </motion.div>
    </section>
  )
}

function Rows({
  items,
  activeId,
  now,
  timeZone,
  compact = false,
}: {
  items: ConversationSummary[]
  activeId: string | null
  now: number
  timeZone: string | undefined
  compact?: boolean
}) {
  return (
    <ul className={clsx('relative flex flex-col', compact ? 'gap-1.5' : 'gap-0.5 pt-1')}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((c, i) => (
          <ConversationRow
            key={c.id}
            conversation={c}
            index={i}
            active={c.id === activeId}
            now={now}
            timeZone={timeZone}
            compact={compact}
          />
        ))}
      </AnimatePresence>
    </ul>
  )
}

function ConversationRow({
  ref,
  conversation: c,
  index,
  active,
  now,
  timeZone,
  compact,
}: {
  /** AnimatePresence en modo popLayout mide la fila saliente a través de esta ref. */
  ref?: React.Ref<HTMLLIElement>
  conversation: ConversationSummary
  index: number
  active: boolean
  now: number
  timeZone: string | undefined
  compact: boolean
}) {
  // En la conversación abierta nada está «sin leer»: la sala ya lo marca.
  const unread = c.unread && !active
  const at = c.last?.created_at ?? c.last_message_at
  const body = c.last ? c.last.body.replace(/\s+/g, ' ').trim() : null

  return (
    <motion.li
      ref={ref}
      layout="position"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
      className="stagger-item"
      style={{ '--i': index } as React.CSSProperties}
    >
      <Link
        href={`/messages/${c.id}`}
        aria-current={active ? 'page' : undefined}
        className={clsx(
          'chat-row group relative flex items-center rounded-2xl',
          compact ? 'is-compact gap-2.5 bg-surface-2 px-2.5 py-2 shadow-card' : 'gap-3 px-3 py-2.5',
          active && 'is-active',
          unread && 'is-unread',
        )}
      >
        <Avatar src={c.other.avatar_url} name={c.other.username} size={compact ? 38 : 48} />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={clsx(
                'truncate leading-snug',
                compact ? 'text-sm' : 'text-[15px]',
                unread ? 'font-bold' : 'font-semibold',
                active && 'text-brand',
              )}
            >
              {displayName(c.other)}
            </span>
            <time
              dateTime={at}
              title={fullDate(at, timeZone)}
              className={clsx(
                'shrink-0 tabular-nums',
                compact ? 'text-[11px]' : 'text-xs',
                unread ? 'font-semibold text-brand' : 'text-muted',
              )}
            >
              {listTime(at, now, timeZone)}
            </time>
          </span>

          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={clsx(
                'min-w-0 flex-1 truncate',
                compact ? 'text-xs' : 'text-sm',
                unread ? 'font-semibold text-ink' : 'text-muted',
              )}
            >
              {body === null ? (
                <span className="italic">Di hola 👋</span>
              ) : (
                <>
                  {c.last?.mine && <span className="font-normal text-muted">Tú: </span>}
                  {body}
                </>
              )}
            </span>
            {unread && <span className="chat-unread-dot" aria-hidden />}
          </span>
        </span>
        {unread && <span className="sr-only">. Mensajes sin leer</span>}
      </Link>
    </motion.li>
  )
}

/* ---------------------------------------------------------------
   Esqueleto y marco de /messages
   --------------------------------------------------------------- */

/** Mismo contorno que la lista real, para que al llegar los datos nada salte. */
export function ConversationListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card flex flex-col overflow-hidden lg:chat-pane-h" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando conversaciones…
      </span>
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Skeleton className="h-7 w-32 rounded-lg" />
        <Skeleton className="ml-auto h-10 w-10 rounded-full" />
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2 pt-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3.5 rounded-md" style={{ width: `${46 + ((i * 17) % 30)}%` }} />
                <Skeleton className="h-3 w-9 rounded-md" />
              </div>
              <Skeleton className="h-3 rounded-md" style={{ width: `${62 + ((i * 23) % 30)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Marco de /messages. En escritorio (lg) son dos columnas fijas: lista y chat.
 * En móvil y tableta se ve una cosa u otra según la ruta, como en una app.
 * El margen negativo anula el pb del <main> cuando el chat ocupa la pantalla:
 * así el documento no hace scroll y la barra de escribir queda fija abajo.
 */
export function MessagesFrame({ inbox, children }: { inbox: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const inChat = pathname.replace(/\/$/, '') !== '/messages'

  return (
    <div
      className={clsx(
        'mx-auto w-full max-w-[1320px] px-2 sm:px-4 md:pt-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[23rem_minmax(0,1fr)] xl:gap-5 2xl:grid-cols-[25rem_minmax(0,1fr)]',
        inChat ? '-mb-24 md:-mb-14' : 'lg:-mb-14',
      )}
    >
      <div className={clsx('min-w-0', inChat ? 'hidden lg:block' : 'mx-auto max-w-[680px] lg:max-w-none')}>
        {inbox}
      </div>
      <div className={clsx('min-w-0', !inChat && 'hidden lg:block')}>{children}</div>
    </div>
  )
}
