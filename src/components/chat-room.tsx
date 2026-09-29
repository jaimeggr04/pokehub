'use client'

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowLeft, Check, CheckCheck, Clock3, Lock, RotateCw, Send, Swords } from 'lucide-react'
import clsx from 'clsx'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Avatar } from '@/components/ui/avatar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { PokeballIcon } from '@/components/pokeball'
import { reportConversation } from '@/components/conversation-list'
import { markConversationRead, sendMessage } from '@/app/actions/social'
import { createClient } from '@/lib/supabase/client'
import { useMediaQuery, useMounted } from '@/lib/hooks'
import { prettify, spriteUrl } from '@/lib/pokemon'
import {
  CHAT_TIME_ZONE,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  clockTime,
  dayKey,
  dayLabel,
  displayName,
  emojiOnlyCount,
  fullDate,
  releaseChannel,
  teamIdFromUrl,
  toTime,
  tokenizeMessage,
  type ChatProfile,
  type MessageToken,
} from '@/lib/chat'
import type { MessageRow } from '@/lib/database.types'

/* ---------------------------------------------------------------
   Modelo
   --------------------------------------------------------------- */

type Status = 'sent' | 'sending' | 'failed'

/**
 * `key` es estable durante toda la vida del mensaje: el optimista y la fila
 * real comparten clave, así React no lo desmonta (ni repite la animación) al
 * confirmarse. `fresh` marca lo que llega en directo: sólo eso se anima.
 */
type ChatMessage = MessageRow & { key: string; status: Status; fresh: boolean }

type Position = 'single' | 'first' | 'middle' | 'last'

type RowModel = { message: ChatMessage; position: Position; unreadDivider: boolean }
type DayModel = { key: string; label: string; rows: RowModel[] }

// Mensajes seguidos del mismo remitente con menos de 5 minutos entre sí van juntos.
const GROUP_GAP = 5 * 60_000
const TYPING_THROTTLE = 2000
const TYPING_TIMEOUT = 3200
const READ_THROTTLE = 3000
const NEAR_BOTTOM = 96
const ICEBREAKERS = ['¡Hola! 👋', '¿Un combate? ⚔️', '¡Qué buen equipo! 🔥', '¿Intercambiamos? 🔄']

let localSeq = 0

function fromRow(row: MessageRow, fresh = false): ChatMessage {
  return { ...row, key: row.id, status: 'sent', fresh }
}

/** Confirmados en orden cronológico del servidor; pendientes y fallidos, al final. */
function ordered(list: ChatMessage[]): ChatMessage[] {
  const sent = list.filter((m) => m.status === 'sent').sort((a, b) => toTime(a.created_at) - toTime(b.created_at))
  const rest = list.filter((m) => m.status !== 'sent')
  return rest.length > 0 ? [...sent, ...rest] : sent
}

/** Sustituye el mensaje local `key` por la fila real, sin duplicarla nunca. */
function settle(list: ChatMessage[], key: string, row: MessageRow): ChatMessage[] {
  if (list.some((m) => m.id === row.id)) return list.filter((m) => m.id === row.id || m.key !== key)
  const index = list.findIndex((m) => m.key === key)
  if (index === -1) return ordered([...list, fromRow(row, true)])
  const next = [...list]
  next[index] = { ...row, key, status: 'sent', fresh: list[index].fresh }
  return ordered(next)
}

/** Fila que llega por tiempo real o al ponerse al día. */
function mergeIncoming(list: ChatMessage[], row: MessageRow, meId: string): ChatMessage[] {
  if (list.some((m) => m.id === row.id)) return list
  if (row.sender_id === meId) {
    // Un envío que se dio por fallido (se cortó la respuesta) pero sí se guardó.
    const index = list.findIndex((m) => m.status === 'failed' && m.body === row.body)
    if (index !== -1) {
      const next = [...list]
      next[index] = { ...row, key: list[index].key, status: 'sent', fresh: list[index].fresh }
      return ordered(next)
    }
  }
  return ordered([...list, fromRow(row, true)])
}

type Parsed = { tokens: MessageToken[]; emoji: number }
// Caché sólo en el navegador: en el servidor el módulo vive entre peticiones
// de distintos usuarios y no tiene sentido guardar sus mensajes.
const parseCache = new Map<string, Parsed>()

function parse(body: string): Parsed {
  if (typeof window === 'undefined') return { tokens: tokenizeMessage(body), emoji: emojiOnlyCount(body) }
  let parsed = parseCache.get(body)
  if (!parsed) {
    if (parseCache.size > 800) parseCache.clear()
    parsed = { tokens: tokenizeMessage(body), emoji: emojiOnlyCount(body) }
    parseCache.set(body, parsed)
  }
  return parsed
}

function later(a: string, b: string) {
  return toTime(b) > toTime(a) ? b : a
}

/* ---------------------------------------------------------------
   Vista previa de equipos enlazados
   --------------------------------------------------------------- */

type TeamPreview = {
  id: string
  name: string
  format: string
  author: string | null
  slots: { pokemonId: number; name: string; shiny: boolean }[]
}

type TeamPreviewRow = {
  id: string
  name: string
  format: string
  author: { username: string } | null
  builds: { pokemon_id: number; pokemon_name: string; shiny: boolean; slot: number }[] | null
}

// Caché de módulo: el mismo equipo compartido en varios chats se pide una vez.
const teamCache = new Map<string, TeamPreview | null>()
const teamLoading = new Set<string>()
const teamListeners = new Set<() => void>()

async function loadTeams(ids: string[]) {
  ids.forEach((id) => teamLoading.add(id))
  try {
    const { data, error } = await createClient()
      .from('teams')
      .select('id, name, format, author:profiles!teams_user_id_fkey(username), builds(pokemon_id, pokemon_name, shiny, slot)')
      .in('id', ids)
    if (error) throw error
    // Lo que no vuelve es privado o ya no existe: se queda como enlace normal.
    ids.forEach((id) => teamCache.set(id, null))
    for (const row of (data ?? []) as unknown as TeamPreviewRow[]) {
      teamCache.set(row.id, {
        id: row.id,
        name: row.name,
        format: row.format,
        author: row.author?.username ?? null,
        slots: [...(row.builds ?? [])]
          .sort((a, b) => a.slot - b.slot)
          .map((b) => ({ pokemonId: b.pokemon_id, name: b.pokemon_name, shiny: b.shiny })),
      })
    }
  } catch {
    // Sin caché: se reintentará cuando cambien los enlaces visibles.
  } finally {
    ids.forEach((id) => teamLoading.delete(id))
    teamListeners.forEach((listener) => listener())
  }
}

/** Instantánea de la caché: cambia de identidad al llegar datos, así la lista memoizada se repinta. */
function useTeamPreviews(ids: string[]): ReadonlyMap<string, TeamPreview | null> {
  const [snapshot, setSnapshot] = useState<ReadonlyMap<string, TeamPreview | null>>(() => new Map(teamCache))
  useEffect(() => {
    const listener = () => setSnapshot(new Map(teamCache))
    teamListeners.add(listener)
    return () => {
      teamListeners.delete(listener)
    }
  }, [])

  const key = ids.join(',')
  useEffect(() => {
    const missing = key ? key.split(',').filter((id) => !teamCache.has(id) && !teamLoading.has(id)) : []
    if (missing.length > 0) void loadTeams(missing)
  }, [key])

  return snapshot
}

/* ---------------------------------------------------------------
   Sala
   --------------------------------------------------------------- */

type ChatApi = {
  receive: (row: MessageRow) => void
  catchUp: () => Promise<void>
  requestRead: () => void
  onTyping: () => void
  dispatch: (key: string, body: string) => Promise<void>
}

/**
 * Conversación a pantalla completa: cabecera con presencia, mensajes en vivo
 * y barra de escribir fija abajo. Todo el tiempo real (mensajes, «escribiendo»,
 * «en línea» y «visto») va por un único canal `conversation:<id>`.
 */
export function ChatRoom({
  conversationId,
  meId,
  other,
  initialMessages,
  hasMore: initialHasMore,
  myLastReadAt,
  otherLastReadAt,
  now: serverNow,
}: {
  conversationId: string
  meId: string
  other: ChatProfile
  initialMessages: MessageRow[]
  hasMore: boolean
  myLastReadAt: string
  otherLastReadAt: string
  /** Date.now() del servidor, para que «Hoy» y «Ayer» coincidan al hidratar. */
  now: number
}) {
  const name = displayName(other)
  const mounted = useMounted()
  const timeZone = mounted ? undefined : CHAT_TIME_ZONE
  const reduceMotion = useReducedMotion()

  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages.map((row) => fromRow(row)))
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [otherReadAt, setOtherReadAt] = useState(otherLastReadAt)
  const [online, setOnline] = useState(false)
  const [typing, setTyping] = useState(false)
  const [connection, setConnection] = useState<'connecting' | 'live' | 'lost'>('connecting')
  const [unseen, setUnseen] = useState(0)
  const [far, setFar] = useState(false)
  const [now, setNow] = useState(serverNow)
  const [shareOpen, setShareOpen] = useState(false)

  // El separador «Mensajes nuevos» se calcula una vez: no debe moverse
  // mientras se lee la conversación.
  const [unreadAtOpen] = useState(() => {
    const read = toTime(myLastReadAt)
    const index = initialMessages.findIndex((m) => m.sender_id !== meId && toTime(m.created_at) > read)
    // Sólo tiene sentido si hay algo ya leído por encima (aunque sea sin cargar todavía).
    const divider = index > 0 || (index === 0 && initialHasMore)
    return { firstId: divider ? initialMessages[index].id : null, any: index !== -1 }
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribed = useRef(false)
  const alive = useRef(true)
  const messagesRef = useRef(messages)
  const hasMoreRef = useRef(hasMore)
  const loadingOlderRef = useRef(false)
  const inflight = useRef<{ key: string; body: string }[]>([])
  // Ids ya conocidos, actualizados al instante (el estado de React llega un
  // render después): el eco de un envío ya confirmado no debe casarse con el
  // siguiente mensaje pendiente.
  const seenIds = useRef<Set<string> | null>(null)
  if (seenIds.current === null) seenIds.current = new Set(initialMessages.map((m) => m.id))
  const atBottom = useRef(true)
  const pinUntil = useRef(0)
  const anchor = useRef<{ height: number; top: number } | null>(null)
  // null hasta el primer pintado: lo que ya venía del servidor no cuenta como nuevo.
  const knownKeys = useRef<Set<string> | null>(null)
  const wasLive = useRef(false)
  const lastTypingSent = useRef(0)
  const typingTimer = useRef<number | undefined>(undefined)
  const readState = useRef({ inFlight: false, again: false, last: 0, timer: 0, whenVisible: false })

  useLayoutEffect(() => {
    messagesRef.current = messages
    hasMoreRef.current = hasMore
  })

  useEffect(() => {
    alive.current = true
    const read = readState.current
    return () => {
      alive.current = false
      window.clearTimeout(typingTimer.current)
      // Una lectura aplazada por el throttle se envía ya: lo que se vio al
      // salir del chat no debe quedarse como «sin leer».
      const pending = read.timer !== 0 || read.again
      window.clearTimeout(read.timer)
      read.timer = 0
      read.again = false
      if (pending) {
        markConversationRead(conversationId)
          .then((res) => {
            if (!res.ok) return
            window.dispatchEvent(new Event('pokehub:unread-refresh'))
            reportConversation({ conversationId, readAt: res.readAt })
          })
          .catch(() => {
            // Sin conexión: se marcará la próxima vez que se abra el chat.
          })
      }
    }
  }, [conversationId])

  /* ---------- Acciones (siempre la versión más reciente vía `api`) ---------- */

  function receive(row: MessageRow) {
    const seen = seenIds.current
    // Repetido (tiempo real y puesta al día pueden coincidir): nada que hacer.
    if (!row?.id || row.conversation_id !== conversationId || !seen || seen.has(row.id)) return
    seen.add(row.id)

    if (row.sender_id === meId) {
      // Nuestro propio envío llega por tiempo real antes que la respuesta de
      // la acción: se casa con el pendiente más antiguo con el mismo texto
      // (las acciones de servidor se procesan en orden, una tras otra).
      const index = inflight.current.findIndex((p) => p.body === row.body)
      if (index !== -1) {
        const [{ key }] = inflight.current.splice(index, 1)
        setMessages((list) => settle(list, key, row))
        return
      }
    } else {
      setTyping(false)
      window.clearTimeout(typingTimer.current)
      requestRead()
    }
    setMessages((list) => mergeIncoming(list, row, meId))
    reportConversation({
      conversationId,
      last: { body: row.body, created_at: row.created_at, mine: row.sender_id === meId },
    })
  }

  /** Lo que llegara mientras el canal no escuchaba (render del servidor, cortes, pestaña dormida). */
  async function catchUp() {
    const current = messagesRef.current
    let lastSent: ChatMessage | undefined
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].status === 'sent') {
        lastSent = current[i]
        break
      }
    }
    let query = createClient()
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (lastSent) query = query.gt('created_at', lastSent.created_at)
    const { data } = await query
    if (!alive.current) return
    for (const row of (data ?? []) as MessageRow[]) receive(row)
  }

  // Marcar como leído: una vez al abrir si hace falta y después, como mucho,
  // cada READ_THROTTLE ms mientras lleguen mensajes y la pestaña esté visible.
  function requestRead() {
    const state = readState.current
    if (!alive.current) return
    if (document.visibilityState !== 'visible') {
      state.whenVisible = true
      return
    }
    if (state.inFlight || state.timer) {
      state.again = true
      return
    }
    const wait = state.last + READ_THROTTLE - Date.now()
    if (wait > 0) {
      state.timer = window.setTimeout(() => {
        state.timer = 0
        void runRead()
      }, wait)
      return
    }
    void runRead()
  }

  async function runRead() {
    const state = readState.current
    state.inFlight = true
    state.again = false
    try {
      const res = await markConversationRead(conversationId)
      if (res.ok) {
        window.dispatchEvent(new Event('pokehub:unread-refresh'))
        reportConversation({ conversationId, readAt: res.readAt })
        if (subscribed.current) {
          void channelRef.current?.send({ type: 'broadcast', event: 'read', payload: { user_id: meId, at: res.readAt } })
        }
      }
    } catch {
      // Sin conexión: el siguiente mensaje lo vuelve a intentar.
    } finally {
      state.inFlight = false
      state.last = Date.now()
      if (state.again && alive.current) {
        state.again = false
        requestRead()
      }
    }
  }

  function onTyping() {
    setTyping(true)
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => setTyping(false), TYPING_TIMEOUT)
  }

  async function dispatch(key: string, body: string) {
    inflight.current.push({ key, body })
    const drop = () => {
      inflight.current = inflight.current.filter((p) => p.key !== key)
    }
    try {
      const res = await sendMessage(conversationId, body)
      drop()
      if (res.ok) {
        seenIds.current?.add(res.message.id)
        setMessages((list) => settle(list, key, res.message))
        reportConversation({
          conversationId,
          last: { body: res.message.body, created_at: res.message.created_at, mine: true },
        })
        return
      }
    } catch {
      drop()
    }
    setMessages((list) => list.map((m) => (m.key === key ? { ...m, status: 'failed' } : m)))
  }

  const api = useRef<ChatApi | null>(null)
  useLayoutEffect(() => {
    api.current = { receive, catchUp, requestRead, onTyping, dispatch }
  })

  const send = useCallback(
    (raw: string) => {
      const body = raw.trim().slice(0, MESSAGE_MAX_LENGTH)
      if (!body) return
      const key = `local-${++localSeq}`
      const message: ChatMessage = {
        id: key,
        key,
        conversation_id: conversationId,
        sender_id: meId,
        body,
        created_at: new Date().toISOString(),
        status: 'sending',
        fresh: true,
      }
      setMessages((list) => [...list, message])
      // El siguiente «escribiendo» se avisa sin esperar al throttle.
      lastTypingSent.current = 0
      void api.current?.dispatch(key, body)
    },
    [conversationId, meId],
  )

  const retry = useCallback((key: string) => {
    const message = messagesRef.current.find((m) => m.key === key)
    if (!message || message.status !== 'failed') return
    setMessages((list) => list.map((m) => (m.key === key ? { ...m, status: 'sending' } : m)))
    void api.current?.dispatch(key, message.body)
  }, [])

  const notifyTyping = useCallback(() => {
    const channel = channelRef.current
    if (!channel || !subscribed.current) return
    const t = Date.now()
    if (t - lastTypingSent.current < TYPING_THROTTLE) return
    lastTypingSent.current = t
    void channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: meId } })
  }, [meId])

  /* ---------- Tiempo real ---------- */

  useEffect(() => {
    const supabase = createClient()
    const topic = `conversation:${conversationId}`
    let channel: RealtimeChannel | null = null
    let cancelled = false

    void (async () => {
      await releaseChannel(supabase, topic)
      if (cancelled) return

      const created = supabase
        .channel(topic, { config: { presence: { key: meId }, broadcast: { self: false } } })
        .on<MessageRow>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => api.current?.receive(payload.new),
        )
        .on('broadcast', { event: 'typing' }, (message) => {
          if (readUserId(message.payload) === other.id) api.current?.onTyping()
        })
        .on('broadcast', { event: 'read' }, (message) => {
          const payload = message.payload as { user_id?: unknown; at?: unknown } | undefined
          if (readUserId(payload) === other.id && typeof payload?.at === 'string') {
            const at = payload.at
            setOtherReadAt((prev) => later(prev, at))
          }
        })
        .on('presence', { event: 'sync' }, () => {
          setOnline(Object.prototype.hasOwnProperty.call(created.presenceState(), other.id))
        })
        .subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            subscribed.current = true
            wasLive.current = true
            setConnection('live')
            if (document.visibilityState === 'visible') void created.track({ user_id: meId })
            void api.current?.catchUp()
          } else {
            // CHANNEL_ERROR, TIMED_OUT o CLOSED: supabase-js reintenta solo. Si
            // nunca llegó a conectar (tiempo real no disponible) no se alarma:
            // el chat sigue funcionando y se pone al día al volver a la pestaña.
            subscribed.current = false
            setOnline(false)
            if (wasLive.current) setConnection('lost')
          }
        })

      channel = created
      channelRef.current = created
    })()

    return () => {
      cancelled = true
      subscribed.current = false
      channelRef.current = null
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId, meId, other.id])

  // Al volver a la pestaña: ponerse al día, reaparecer «en línea» y leer lo pendiente.
  useEffect(() => {
    function onVisibility() {
      const channel = channelRef.current
      if (document.visibilityState === 'visible') {
        if (readState.current.whenVisible) {
          readState.current.whenVisible = false
          api.current?.requestRead()
        }
        if (channel && subscribed.current) void channel.track({ user_id: meId })
        void api.current?.catchUp()
      } else if (channel && subscribed.current) {
        void channel.untrack()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [meId])

  useEffect(() => {
    if (unreadAtOpen.any) api.current?.requestRead()
  }, [unreadAtOpen])

  // «Hoy»/«Ayer» cambian a medianoche aunque la sala siga abierta.
  useEffect(() => {
    let timer = 0
    const tick = () => {
      const date = new Date()
      setNow(date.getTime())
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 1)
      timer = window.setTimeout(tick, midnight.getTime() - date.getTime())
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])

  /* ---------- Scroll ---------- */

  const scrollToBottom = useCallback(
    (smooth: boolean) => {
      const el = scrollRef.current
      if (!el) return
      atBottom.current = true
      pinUntil.current = Date.now() + 600
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' })
      setUnseen(0)
      setFar(false)
    },
    [reduceMotion],
  )

  // Posición inicial: el separador de no leídos si lo hay; si no, el final.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const divider = el.querySelector<HTMLElement>('[data-unread-divider]')
    if (divider) {
      const offset = divider.getBoundingClientRect().top - el.getBoundingClientRect().top
      el.scrollTop += offset - 64
    } else {
      el.scrollTop = el.scrollHeight
    }
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
  }, [])

  // Mensajes nuevos: bajar si estaba abajo (o si los envío yo); si no, contarlos en la píldora.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const known = knownKeys.current
    knownKeys.current = new Set(messages.map((m) => m.key))
    if (!el || !known) return
    const added = messages.filter((m) => !known.has(m.key))

    if (anchor.current) {
      // Tras cargar anteriores, mantener a la vista lo que se estaba leyendo.
      el.scrollTop = anchor.current.top + (el.scrollHeight - anchor.current.height)
      anchor.current = null
      return
    }
    if (added.length === 0) return
    if (added.some((m) => m.sender_id === meId) || atBottom.current) scrollToBottom(true)
    else setUnseen((n) => n + added.length)
  }, [messages, meId, scrollToBottom])

  // Cambios de tamaño (teclado virtual, barra de escribir que crece, tarjetas
  // de equipo que cargan): si se estaba al final, se sigue al final.
  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(el)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreRef.current) return
    const oldest = messagesRef.current.find((m) => m.status === 'sent')
    if (!oldest) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const { data, error } = await createClient()
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE + 1)
      if (error) throw error
      if (!alive.current) return
      const rows = (data ?? []) as MessageRow[]
      const seen = seenIds.current ?? new Set<string>()
      const older = rows
        .slice(0, MESSAGE_PAGE_SIZE)
        .reverse()
        .filter((row) => !seen.has(row.id))
        .map((row) => fromRow(row))
      older.forEach((m) => seen.add(m.id))
      setHasMore(rows.length > MESSAGE_PAGE_SIZE)
      if (older.length > 0) {
        const el = scrollRef.current
        if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop }
        setMessages((list) => [...older, ...list])
      }
    } catch {
      toast('No se pudieron cargar los mensajes anteriores', { tone: 'error' })
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [conversationId])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    // Durante el desplazamiento suave que lanzamos nosotros, seguimos «abajo».
    atBottom.current = distance < NEAR_BOTTOM || Date.now() < pinUntil.current
    if (atBottom.current) setUnseen(0)
    setFar(distance > el.clientHeight * 1.2)
    if (el.scrollTop < 240 && hasMoreRef.current) void loadOlder()
  }

  /* ---------- Modelo de pintado ---------- */

  const days = useMemo(() => {
    const result: DayModel[] = []
    // Por día, si cada mensaje continúa el grupo del anterior.
    const joins: boolean[][] = []

    for (const m of messages) {
      const key = dayKey(m.created_at, timeZone)
      let day = result[result.length - 1]
      if (!day || day.key !== key) {
        day = { key, label: dayLabel(m.created_at, now, timeZone), rows: [] }
        result.push(day)
        joins.push([])
      }
      const prev = day.rows[day.rows.length - 1]?.message
      const divider = m.id === unreadAtOpen.firstId
      joins[joins.length - 1].push(
        Boolean(
          prev &&
            !divider &&
            prev.sender_id === m.sender_id &&
            toTime(m.created_at) - toTime(prev.created_at) < GROUP_GAP,
        ),
      )
      day.rows.push({ message: m, position: 'single', unreadDivider: divider })
    }

    // Segunda pasada: cada burbuja sabe si abre, continúa o cierra su grupo.
    result.forEach((day, d) => {
      day.rows.forEach((row, j) => {
        const joinsPrev = joins[d][j]
        const nextJoins = joins[d][j + 1] ?? false
        row.position = joinsPrev ? (nextJoins ? 'middle' : 'last') : nextJoins ? 'first' : 'single'
      })
    })
    return result
  }, [messages, timeZone, now, unreadAtOpen.firstId])

  // «Visto»/«Enviado» sólo bajo mi último mensaje, y sólo si es lo último de la conversación.
  const receiptKey = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.status !== 'sent') continue
      return m.sender_id === meId ? m.key : null
    }
    return null
  }, [messages, meId])
  const receiptMessage = receiptKey ? messages.find((m) => m.key === receiptKey) : undefined
  const seen = Boolean(receiptMessage && toTime(otherReadAt) >= toTime(receiptMessage.created_at))

  const host = mounted ? window.location.host : null
  const teamIds = useMemo(() => {
    if (!host) return []
    const ids = new Set<string>()
    for (const m of messages) {
      for (const token of parse(m.body).tokens) {
        if (token.type !== 'link') continue
        const id = teamIdFromUrl(token.href, host)
        if (id) ids.add(id)
      }
    }
    return [...ids].sort()
  }, [messages, host])
  const teams = useTeamPreviews(teamIds)

  const status = typing ? 'typing' : connection === 'lost' ? 'lost' : online ? 'online' : 'idle'
  const showJump = unseen > 0 || far
  const empty = messages.length === 0 && !hasMore

  return (
    <section aria-labelledby={`chat-title-${conversationId}`} className="card chat-pane-h flex flex-col overflow-hidden">
      {/* Cabecera */}
      <header className="relative z-20 flex shrink-0 items-center gap-1 border-b border-line bg-surface-2 px-2 py-2 sm:gap-2 sm:px-3">
        <Link href="/messages" aria-label="Volver a mensajes" className="btn btn-ghost btn-icon lg:hidden">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <Link
          href={`/u/${other.username}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 pr-3 transition-colors hover:bg-surface"
        >
          <span className="relative shrink-0">
            <Avatar src={other.avatar_url} name={other.username} size={42} />
            <AnimatePresence>
              {online && (
                <motion.span
                  key="online"
                  aria-hidden
                  className="chat-presence"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                />
              )}
            </AnimatePresence>
          </span>
          <span className="min-w-0">
            <h1 id={`chat-title-${conversationId}`} className="truncate text-[15px] font-bold leading-tight">
              {name}
            </h1>
            <span className="relative block h-[18px] overflow-hidden text-xs leading-[18px]">
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={status}
                  className="block truncate"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {status === 'typing' ? (
                    <span className="font-semibold text-brand">escribiendo…</span>
                  ) : status === 'lost' ? (
                    <span className="text-warning">Reconectando…</span>
                  ) : (
                    <span className="text-muted">
                      @{other.username}
                      {status === 'online' && <span className="font-semibold text-success"> · En línea</span>}
                    </span>
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        </Link>
      </header>

      {/* Mensajes */}
      <div className="chat-wallpaper relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={loadingOlder}
          aria-label={`Mensajes con ${name}`}
          tabIndex={0}
          className="chat-scroll absolute inset-0 overflow-y-auto overscroll-contain"
        >
          <div ref={contentRef} className="flex min-h-full flex-col justify-end px-2.5 pb-3 pt-1 sm:px-5">
            {hasMore ? (
              <div className="flex justify-center pb-1 pt-3">
                {loadingOlder ? (
                  <PokeballSpinner size={28} label="Cargando mensajes anteriores…" />
                ) : (
                  <button type="button" onClick={() => void loadOlder()} className="btn btn-soft btn-sm">
                    Cargar anteriores
                  </button>
                )}
              </div>
            ) : (
              !empty && (
                <p className="flex items-center justify-center gap-2 pb-1 pt-4 text-center text-xs text-muted">
                  <PokeballIcon className="h-4 w-4" />
                  Aquí empieza tu conversación con {name}
                </p>
              )
            )}

            {empty && <EmptyChat other={other} name={name} onPick={send} />}

            <MessageDays
              days={days}
              meId={meId}
              other={other}
              name={name}
              timeZone={timeZone}
              receiptKey={receiptKey}
              seen={seen}
              teams={teams}
              host={host}
              onRetry={retry}
            />

            <AnimatePresence>
              {typing && (
                <motion.div
                  key="typing"
                  className="mt-3 flex items-end gap-2"
                  style={{ originX: 0, originY: 1 }}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                >
                  <Avatar src={other.avatar_url} name={other.username} size={28} />
                  <span className="chat-bubble chat-bubble--them chat-typing" data-pos="single" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="min-w-0 truncate pb-2 text-xs text-muted">{name} está escribiendo…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {showJump && (
            <motion.div
              key={unseen > 0 ? 'pill' : 'round'}
              className={clsx(
                'pointer-events-none absolute inset-x-0 bottom-3 z-10 flex px-4',
                unseen > 0 ? 'justify-center' : 'justify-end',
              )}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            >
              {unseen > 0 ? (
                <button type="button" onClick={() => scrollToBottom(true)} className="chat-jump chat-jump--pill">
                  Nuevos mensajes
                  {unseen > 1 && <span className="chat-jump-count">{unseen > 99 ? '99+' : unseen}</span>}
                  <ArrowDown size={16} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  aria-label="Ir al último mensaje"
                  className="chat-jump chat-jump--round"
                >
                  <ArrowDown size={18} aria-hidden />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Composer
        inputRef={inputRef}
        name={name}
        onSend={send}
        onType={notifyTyping}
        onShare={() => setShareOpen(true)}
      />

      <ShareTeamSheet
        open={shareOpen}
        meId={meId}
        onClose={() => setShareOpen(false)}
        onPick={(teamId) => {
          setShareOpen(false)
          send(`${window.location.origin}/team/${teamId}`)
        }}
      />
    </section>
  )
}

function readUserId(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'user_id' in payload) {
    const id = (payload as { user_id: unknown }).user_id
    return typeof id === 'string' ? id : null
  }
  return null
}

/* ---------------------------------------------------------------
   Días y burbujas
   --------------------------------------------------------------- */

const MessageDays = memo(function MessageDays({
  days,
  meId,
  other,
  name,
  timeZone,
  receiptKey,
  seen,
  teams,
  host,
  onRetry,
}: {
  days: DayModel[]
  meId: string
  other: ChatProfile
  name: string
  timeZone: string | undefined
  receiptKey: string | null
  seen: boolean
  teams: ReadonlyMap<string, TeamPreview | null>
  host: string | null
  onRetry: (key: string) => void
}) {
  return (
    <>
      {days.map((day) => (
        <section key={day.key} className="relative">
          {/* Fija arriba mientras se recorre su día; el siguiente la empuja. */}
          <div className="pointer-events-none sticky top-2 z-10 flex justify-center py-2">
            <h2 className="chat-day-chip">{day.label}</h2>
          </div>
          <ol className="flex flex-col">
            {day.rows.map((row) => (
              <MessageRowItem
                key={row.message.key}
                row={row}
                mine={row.message.sender_id === meId}
                other={other}
                name={name}
                timeZone={timeZone}
                receipt={row.message.key === receiptKey ? (seen ? 'seen' : 'sent') : null}
                teams={teams}
                host={host}
                onRetry={onRetry}
              />
            ))}
          </ol>
        </section>
      ))}
    </>
  )
})

function MessageRowItem({
  row,
  mine,
  other,
  name,
  timeZone,
  receipt,
  teams,
  host,
  onRetry,
}: {
  row: RowModel
  mine: boolean
  other: ChatProfile
  name: string
  timeZone: string | undefined
  receipt: 'seen' | 'sent' | null
  teams: ReadonlyMap<string, TeamPreview | null>
  host: string | null
  onRetry: (key: string) => void
}) {
  const { message: m, position } = row
  const { tokens, emoji } = parse(m.body)
  const closesGroup = position === 'last' || position === 'single'
  const showMeta = closesGroup || m.status !== 'sent'

  // Enlaces a equipos de esta web con su tarjeta ya cargada.
  const teamLinks = host
    ? tokens.flatMap((t) => {
        if (t.type !== 'link') return []
        const id = teamIdFromUrl(t.href, host)
        const team = id ? teams.get(id) : null
        return team ? [team] : []
      })
    : []
  const onlyCard = teamLinks.length === 1 && tokens.length === 1

  const bubbleClass = clsx(
    'chat-bubble',
    emoji ? 'chat-bubble--emoji' : mine ? 'chat-bubble--me' : 'chat-bubble--them',
    onlyCard && 'chat-bubble--card',
    m.status === 'failed' && 'is-failed',
    m.status === 'sending' && 'is-sending',
  )

  const content = (
    <>
      {!onlyCard && (
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {tokens.map((token, i) =>
            token.type === 'text' ? (
              token.value
            ) : (
              <MessageLink key={i} href={token.href} host={host}>
                {token.value}
              </MessageLink>
            ),
          )}
        </p>
      )}
      {teamLinks.map((team) => (
        <TeamCardPreview key={team.id} team={team} mine={mine} />
      ))}
    </>
  )

  const bubbleProps = {
    className: bubbleClass,
    'data-pos': position,
    'data-emoji': emoji || undefined,
    title: m.status === 'sent' ? fullDate(m.created_at, timeZone) : undefined,
  }

  return (
    <>
      {row.unreadDivider && (
        <li data-unread-divider className="chat-unread-divider">
          <span>Mensajes nuevos</span>
        </li>
      )}
      <li className={clsx('flex flex-col', position === 'first' || position === 'single' ? 'mt-3' : 'mt-[3px]')}>
        <span className="sr-only">
          {mine ? 'Tú' : name}
          {m.status === 'sent' ? `, ${clockTime(m.created_at, timeZone)}` : ''}:{' '}
        </span>
        <div className={clsx('flex items-end gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
          {!mine && (
            <span className="w-7 shrink-0" aria-hidden>
              {closesGroup && <Avatar src={other.avatar_url} name={other.username} size={28} />}
            </span>
          )}
          <div className={clsx('flex min-w-0 max-w-[82%] flex-col sm:max-w-[min(72%,34rem)]', mine ? 'items-end' : 'items-start')}>
            {m.fresh ? (
              <motion.div
                {...bubbleProps}
                style={{ originX: mine ? 1 : 0, originY: 1 }}
                initial={
                  emoji
                    ? { opacity: 0, scale: 0.3, rotate: mine ? 12 : -12 }
                    : { opacity: 0, scale: 0.86, x: mine ? 18 : -18, y: 8 }
                }
                animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                transition={{ type: 'spring', stiffness: emoji ? 420 : 560, damping: emoji ? 16 : 34, mass: 0.8 }}
              >
                {content}
              </motion.div>
            ) : (
              <div {...bubbleProps}>{content}</div>
            )}
          </div>
        </div>

        {showMeta && (
          <div
            className={clsx(
              'mt-1 flex items-center gap-1 text-[11px] leading-4',
              mine ? 'justify-end pr-1' : 'pl-10',
              m.status === 'failed' ? 'text-danger' : 'text-muted',
            )}
          >
            {m.status === 'sending' ? (
              <>
                <Clock3 size={12} aria-hidden />
                Enviando…
              </>
            ) : m.status === 'failed' ? (
              <>
                No enviado ·
                <button
                  type="button"
                  onClick={() => onRetry(m.key)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full px-1.5 font-semibold underline underline-offset-2"
                >
                  <RotateCw size={12} aria-hidden />
                  Reintentar
                </button>
              </>
            ) : (
              <>
                {/* La hora ya la lee el prefijo sr-only del mensaje. */}
                <time dateTime={m.created_at} aria-hidden className="tabular-nums">
                  {clockTime(m.created_at, timeZone)}
                </time>
                {receipt === 'seen' && (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-brand">
                    · <CheckCheck size={13} aria-hidden /> Visto
                  </span>
                )}
                {receipt === 'sent' && (
                  <span className="inline-flex items-center gap-0.5">
                    · <Check size={13} aria-hidden /> Enviado
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </li>
    </>
  )
}

/** Enlace seguro: los de esta web navegan dentro de la app; el resto, en otra pestaña. */
function MessageLink({ href, host, children }: { href: string; host: string | null; children: React.ReactNode }) {
  if (host) {
    const url = new URL(href)
    if (url.host === host) {
      return (
        <Link href={`${url.pathname}${url.search}${url.hash}`} className="chat-link">
          {children}
        </Link>
      )
    }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="chat-link">
      {children}
    </a>
  )
}

function TeamCardPreview({ team, mine }: { team: TeamPreview; mine: boolean }) {
  return (
    <Link
      href={`/team/${team.id}`}
      aria-label={`Ver el equipo «${team.name}»${team.author ? ` de @${team.author}` : ''}`}
      className={clsx('chat-team-card', mine ? 'chat-team-card--me' : 'chat-team-card--them')}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        <Swords size={12} aria-hidden />
        Equipo · {team.format}
      </span>
      <span className="mt-0.5 block truncate text-[15px] font-bold leading-snug">{team.name}</span>
      <span className="mt-2 grid grid-cols-6 gap-1">
        {Array.from({ length: 6 }, (_, i) => {
          const slot = team.slots[i]
          return (
            <span key={i} className="chat-team-slot">
              {slot && (
                <Image
                  src={spriteUrl(slot.pokemonId, slot.shiny)}
                  alt={prettify(slot.name)}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              )}
            </span>
          )
        })}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="truncate opacity-80">{team.author ? `de @${team.author}` : ''}</span>
        <span className="shrink-0 font-semibold">Ver equipo →</span>
      </span>
    </Link>
  )
}

function EmptyChat({ other, name, onPick }: { other: ChatProfile; name: string; onPick: (text: string) => void }) {
  return (
    <div className="my-auto flex flex-col items-center px-4 py-8 text-center">
      <div className="relative animate-scale-in">
        <Avatar
          src={other.avatar_url}
          name={other.username}
          size={76}
          className="shadow-float ring-4 ring-brand-soft"
        />
        <span className="chat-hero-badge absolute -bottom-1 -right-2">
          <PokeballIcon className="h-8 w-8" />
        </span>
      </div>
      <p className="mt-5 text-lg font-extrabold">¡Un entrenador salvaje apareció!</p>
      <p className="mt-1 max-w-xs text-sm text-muted">Rompe el hielo con {name}: salúdale, rétale o proponle un intercambio.</p>
      <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">
        {ICEBREAKERS.map((text, i) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            aria-label={`Enviar «${text}»`}
            className="btn btn-soft btn-sm stagger-item"
            style={{ '--i': i + 3 } as React.CSSProperties}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------
   Barra de escribir
   --------------------------------------------------------------- */

function Composer({
  inputRef,
  name,
  onSend,
  onType,
  onShare,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  name: string
  onSend: (text: string) => void
  onType: () => void
  onShare: () => void
}) {
  const [text, setText] = useState('')
  const [tick, setTick] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Con ratón y teclado físico Intro envía; en táctil hace salto de línea y se envía con el botón.
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')
  const counterId = useId()

  const ready = text.trim().length > 0
  const remaining = MESSAGE_MAX_LENGTH - text.length
  const nearLimit = remaining <= 200

  // Crece con el texto hasta 5 líneas (el tope lo pone max-height en CSS).
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [text, inputRef])

  // En escritorio se puede escribir nada más abrir el chat.
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [inputRef])

  function submit() {
    if (!ready) return
    onSend(text)
    setText('')
    setTick((t) => t + 1)
    // Si se envió con el botón desde el teclado, el botón se desactiva y
    // perdería el foco: se devuelve a la caja de texto.
    if (document.activeElement === buttonRef.current) inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="relative z-20 flex shrink-0 items-end gap-1.5 border-t border-line bg-surface-2 p-2 sm:gap-2 sm:p-3"
    >
      <button
        type="button"
        onClick={onShare}
        aria-label="Compartir uno de tus equipos"
        title="Compartir equipo"
        className="chat-share btn btn-ghost btn-icon mb-0.5"
      >
        <PokeballIcon className="h-6 w-6" />
      </button>

      <div className="min-w-0 flex-1">
        <label htmlFor={`${counterId}-input`} className="sr-only">
          Escribe un mensaje para {name}
        </label>
        <textarea
          id={`${counterId}-input`}
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Escribe un mensaje…"
          enterKeyHint={finePointer ? 'send' : 'enter'}
          aria-describedby={nearLimit ? counterId : undefined}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value.trim()) onType()
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
            if (finePointer || e.metaKey || e.ctrlKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="chat-input block w-full resize-none rounded-[22px] border border-line bg-surface px-4 py-[9px] text-base leading-6 text-ink outline-none placeholder:text-muted sm:text-[15px]"
        />
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1">
        <AnimatePresence>
          {nearLimit && (
            <motion.span
              key="counter"
              id={counterId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className={clsx(
                'text-[11px] font-semibold tabular-nums',
                remaining <= 20 ? 'text-danger' : remaining <= 100 ? 'text-warning' : 'text-muted',
              )}
            >
              <span aria-hidden>{remaining}</span>
              <span className="sr-only">Te quedan {remaining} caracteres</span>
            </motion.span>
          )}
        </AnimatePresence>
        <button
          ref={buttonRef}
          type="submit"
          disabled={!ready}
          aria-label="Enviar mensaje"
          data-ready={ready}
          // Sin robar el foco a la caja de texto: en móvil así no se cierra el teclado.
          onMouseDown={(e) => e.preventDefault()}
          className="chat-send"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={tick}
              className="grid place-items-center"
              initial={{ x: -14, y: 14, opacity: 0, scale: 0.5 }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              exit={{ x: 24, y: -24, opacity: 0, scale: 0.7, transition: { duration: 0.28, ease: [0.5, 0, 0.75, 0] } }}
              transition={{ type: 'spring', stiffness: 520, damping: 26, delay: 0.08 }}
            >
              <Send size={19} aria-hidden className="-translate-x-px translate-y-px" />
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------
   Compartir un equipo propio
   --------------------------------------------------------------- */

type MyTeam = {
  id: string
  name: string
  format: string
  is_public: boolean
  builds: { pokemon_id: number; pokemon_name: string; shiny: boolean; slot: number }[] | null
}

function ShareTeamSheet({
  open,
  meId,
  onClose,
  onPick,
}: {
  open: boolean
  meId: string
  onClose: () => void
  onPick: (teamId: string) => void
}) {
  const [teams, setTeams] = useState<MyTeam[] | null>(null)
  const [failed, setFailed] = useState(false)

  // Se piden al abrir la hoja por primera vez, no al entrar en el chat.
  useEffect(() => {
    if (!open || teams) return
    let cancelled = false
    setFailed(false)
    void createClient()
      .from('teams')
      .select('id, name, format, is_public, builds(pokemon_id, pokemon_name, shiny, slot)')
      .eq('user_id', meId)
      .order('updated_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setFailed(true)
        else setTeams((data ?? []) as unknown as MyTeam[])
      })
    return () => {
      cancelled = true
    }
  }, [open, teams, meId])

  return (
    <BottomSheet open={open} onClose={onClose} title="Compartir un equipo" showTitle>
      <p className="-mt-1 mb-3 text-center text-sm text-muted">Se enviará como tarjeta con sus seis Pokémon.</p>
      {failed ? (
        <p className="py-8 text-center text-sm text-danger" role="alert">
          No se pudieron cargar tus equipos. Inténtalo de nuevo.
        </p>
      ) : !teams ? (
        <div className="flex justify-center py-10">
          <PokeballSpinner size={40} label="Cargando tus equipos…" />
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted">Aún no tienes equipos que compartir.</p>
          <Link href="/team/new" className="btn btn-primary btn-sm" onClick={onClose}>
            Crear un equipo
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-1">
          {teams.map((team, i) => {
            const slots = [...(team.builds ?? [])].sort((a, b) => a.slot - b.slot)
            return (
              <li key={team.id} className="stagger-item" style={{ '--i': i } as React.CSSProperties}>
                <button
                  type="button"
                  disabled={!team.is_public}
                  onClick={() => onPick(team.id)}
                  className="chat-share-option pressable"
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">{team.name}</span>
                    {team.is_public ? (
                      <span className="shrink-0 text-xs text-muted">{team.format}</span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                        <Lock size={11} aria-hidden /> Privado
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 flex gap-1" aria-hidden>
                    {slots.map((b) => (
                      <Image
                        key={b.slot}
                        src={spriteUrl(b.pokemon_id, b.shiny)}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 object-contain"
                      />
                    ))}
                  </span>
                  {!team.is_public && (
                    <span className="mt-1 block text-left text-[11px] text-muted">
                      Hazlo público para que el otro entrenador pueda verlo.
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}

/* ---------------------------------------------------------------
   Esqueleto (lo usa loading.tsx)
   --------------------------------------------------------------- */

const SKELETON_BUBBLES: { mine: boolean; width: string; tall?: boolean }[] = [
  { mine: false, width: '58%' },
  { mine: false, width: '36%' },
  { mine: true, width: '48%' },
  { mine: false, width: '64%', tall: true },
  { mine: true, width: '30%' },
  { mine: true, width: '54%' },
]

export function ChatRoomSkeleton() {
  return (
    <div className="card chat-pane-h flex flex-col overflow-hidden" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando conversación…
      </span>
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-3 py-3">
        <Skeleton className="h-10 w-10 rounded-full lg:hidden" />
        <Skeleton className="h-[42px] w-[42px] shrink-0 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="chat-wallpaper flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-4 sm:px-5">
        <Skeleton className="mx-auto mb-2 h-6 w-16 rounded-full" />
        {SKELETON_BUBBLES.map((b, i) => (
          <div key={i} className={clsx('flex', b.mine ? 'justify-end' : 'justify-start')}>
            <Skeleton className={clsx('rounded-[20px]', b.tall ? 'h-16' : 'h-10')} style={{ width: b.width }} />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-end gap-2 border-t border-line bg-surface-2 p-2 sm:p-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-11 flex-1 rounded-[22px]" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
    </div>
  )
}
