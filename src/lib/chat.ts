import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Datos y utilidades puras del chat. Sin imports de servidor: lo usan tanto las
// páginas como los componentes de cliente.

type Client = SupabaseClient<Database>

/** Límite de messages.body (constraint message_len de la base de datos). */
export const MESSAGE_MAX_LENGTH = 2000
/** Mensajes por tanda: al abrir un chat y en cada «Cargar anteriores». */
export const MESSAGE_PAGE_SIZE = 50
/**
 * Zona con la que se pintan fechas en el servidor y durante la hidratación.
 * Tras montar se usa la del dispositivo; para quien está en España no cambia nada.
 */
export const CHAT_TIME_ZONE = 'Europe/Madrid'

export type ChatProfile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export type LastMessage = { body: string; created_at: string; mine: boolean }

export interface ConversationSummary {
  id: string
  last_message_at: string
  /** Última línea con el prefijo «Tú: » si el mensaje es mío; null si aún no hay mensajes. */
  preview: string | null
  unread: boolean
  other: ChatProfile
  last: LastMessage | null
  /** Hasta dónde he leído yo esta conversación. */
  last_read_at: string
}

const EPOCH = '1970-01-01T00:00:00Z'

type QueryMessage = { body: string; sender_id: string; created_at: string }

type ConversationQueryRow = {
  id: string
  last_message_at: string
  conversation_participants: { user_id: string; profiles: ChatProfile | null }[] | null
  messages: QueryMessage[] | null
}

/**
 * Conversaciones del usuario con el otro participante, el último mensaje y si
 * hay algo sin leer. Son dos consultas acotadas: mis participaciones y, para
 * las `limit` más recientes, perfiles y un único mensaje por conversación
 * (PostgREST aplica el limit del recurso embebido fila a fila).
 */
export async function listConversations(
  supabase: Client,
  meId: string,
  limit = 20,
): Promise<ConversationSummary[]> {
  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', meId)

  if (!mine || mine.length === 0) return []
  const readMap = new Map(mine.map((m) => [m.conversation_id, m.last_read_at]))
  return summarize(supabase, meId, readMap, limit)
}

/**
 * Resumen de una sola conversación: la lista en vivo lo pide cuando llega un
 * mensaje de un chat que no tenía (alguien me escribe por primera vez).
 */
export async function getConversationSummary(
  supabase: Client,
  meId: string,
  conversationId: string,
): Promise<ConversationSummary | null> {
  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('last_read_at')
    .eq('user_id', meId)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!mine) return null
  const [summary] = await summarize(supabase, meId, new Map([[conversationId, mine.last_read_at]]), 1)
  return summary ?? null
}

async function summarize(
  supabase: Client,
  meId: string,
  readMap: Map<string, string>,
  limit: number,
): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from('conversations')
    .select(
      'id, last_message_at, conversation_participants(user_id, profiles(id, username, display_name, avatar_url)), messages(body, sender_id, created_at)',
    )
    .in('id', [...readMap.keys()])
    .order('last_message_at', { ascending: false })
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })
    .limit(limit)

  const summaries: ConversationSummary[] = []
  for (const row of (data ?? []) as unknown as ConversationQueryRow[]) {
    const other = row.conversation_participants?.find((p) => p.user_id !== meId)?.profiles
    // Si el otro borró su cuenta la conversación se queda sin interlocutor.
    if (!other) continue

    // El servidor ya devuelve uno solo; quedarse con el más reciente cubre
    // igualmente el caso de que llegaran varios.
    let newest: QueryMessage | null = null
    for (const m of row.messages ?? []) {
      if (!newest || toTime(m.created_at) > toTime(newest.created_at)) newest = m
    }

    const last = newest
      ? { body: newest.body, created_at: newest.created_at, mine: newest.sender_id === meId }
      : null
    const readAt = readMap.get(row.id) ?? EPOCH

    summaries.push({
      id: row.id,
      last_message_at: row.last_message_at,
      preview: last ? previewText(last) : null,
      unread: isUnread(last, readAt),
      other,
      last,
      last_read_at: readAt,
    })
  }
  return summaries
}

/* ---------------------------------------------------------------
   Utilidades de presentación
   --------------------------------------------------------------- */

/** Milisegundos de una marca ISO. Compara bien aunque Postgres devuelva microsegundos. */
export function toTime(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

export function isUnread(last: LastMessage | null, readAt: string): boolean {
  return Boolean(last && !last.mine && toTime(last.created_at) > toTime(readAt))
}

/** Una sola línea para listas: los saltos de línea se vuelven espacios. */
export function previewText(last: Pick<LastMessage, 'body' | 'mine'>): string {
  const text = last.body.replace(/\s+/g, ' ').trim()
  return last.mine ? `Tú: ${text}` : text
}

export function displayName(profile: Pick<ChatProfile, 'username' | 'display_name'>): string {
  return profile.display_name?.trim() || `@${profile.username}`
}

// Intl.DateTimeFormat es caro de construir y aquí se formatean cientos de fechas.
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone ?? ''}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('es-ES', { ...options, timeZone })
    formatters.set(key, f)
  }
  return f
}

/** Día natural (AAAA-MM-DD) de una fecha en la zona dada. */
export function dayKey(date: string | number, timeZone?: string): string {
  const parts = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(date),
  )
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function daysBetween(fromKey: string, toKey: string): number {
  const utc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000)
}

/** Separador de día: «Hoy», «Ayer» o «12 de marzo» (con año si no es el actual). */
export function dayLabel(iso: string, now: number, timeZone?: string): string {
  const key = dayKey(iso, timeZone)
  const today = dayKey(now, timeZone)
  const diff = daysBetween(key, today)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return formatter(timeZone, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  )
}

/** Hora corta, 24 h: «14:05». */
export function clockTime(iso: string, timeZone?: string): string {
  return formatter(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}

/** Fecha completa para tooltips y lectores de pantalla. */
export function fullDate(iso: string, timeZone?: string): string {
  return formatter(timeZone, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso))
}

/**
 * Hora relativa compacta de las listas de chats, al estilo de las apps de
 * mensajería: «ahora», «5 min», «14:05», «Ayer», «lun», «12 mar».
 */
export function listTime(iso: string, now: number, timeZone?: string): string {
  const elapsed = now - toTime(iso)
  if (elapsed < 60_000) return 'ahora'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min`

  const key = dayKey(iso, timeZone)
  const today = dayKey(now, timeZone)
  const diff = daysBetween(key, today)
  if (diff === 0) return clockTime(iso, timeZone)
  if (diff === 1) return 'Ayer'
  if (diff < 7) return formatter(timeZone, { weekday: 'short' }).format(new Date(iso))
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return formatter(timeZone, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso))
    .replace(/\./g, '')
}

/* ---------------------------------------------------------------
   Texto de los mensajes
   --------------------------------------------------------------- */

export type MessageToken = { type: 'text'; value: string } | { type: 'link'; value: string; href: string }

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"]+/gi

// Puntuación que casi siempre cierra la frase y no el enlace («mira https://x.com.»).
function trimUrl(raw: string): string {
  let url = raw
  while (url.length > 0) {
    const last = url[url.length - 1]
    if ('.,;:!?¡¿\'"]}*_'.includes(last)) {
      url = url.slice(0, -1)
      continue
    }
    // Un paréntesis final sólo es del enlace si abre dentro de él (Wikipedia).
    if (last === ')' && url.split('(').length < url.split(')').length) {
      url = url.slice(0, -1)
      continue
    }
    break
  }
  return url
}

/** Parte el texto en trozos y enlaces http(s). Nunca genera otros protocolos. */
export function tokenizeMessage(body: string): MessageToken[] {
  const tokens: MessageToken[] = []
  let cursor = 0
  for (const match of body.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    const url = trimUrl(match[0])
    let href: string | null = null
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') href = parsed.href
    } catch {
      href = null
    }
    if (!href) continue
    if (start > cursor) tokens.push({ type: 'text', value: body.slice(cursor, start) })
    tokens.push({ type: 'link', value: url, href })
    cursor = start + url.length
  }
  if (cursor < body.length) tokens.push({ type: 'text', value: body.slice(cursor) })
  return tokens
}

const EMOJI_GRAPHEME = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|‍|️|⃣)+$/u
// Que se pinte como emoji: «©» o «™» sueltos son texto, «❤️» (con FE0F) no.
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}|\p{Regional_Indicator}|️/u

let segmenter: Intl.Segmenter | null = null

/** Si el mensaje son sólo emojis (de 1 a 3), cuántos; si no, 0. */
export function emojiOnlyCount(body: string): number {
  const text = body.trim()
  if (!text || text.length > 40 || typeof Intl.Segmenter !== 'function') return 0
  segmenter ??= new Intl.Segmenter('es', { granularity: 'grapheme' })
  const graphemes = Array.from(segmenter.segment(text), (s) => s.segment).filter((s) => s.trim() !== '')
  if (graphemes.length === 0 || graphemes.length > 3) return 0
  return graphemes.every((g) => EMOJI_GRAPHEME.test(g) && EMOJI_PRESENTATION.test(g)) ? graphemes.length : 0
}

const TEAM_PATH = /^\/team\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

/** Id del equipo si el enlace apunta a un equipo de esta misma web. */
export function teamIdFromUrl(href: string, host: string): string | null {
  try {
    const url = new URL(href)
    if (url.host !== host) return null
    return TEAM_PATH.exec(url.pathname)?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------
   Tiempo real
   --------------------------------------------------------------- */

/**
 * supabase-js reutiliza el canal que ya exista con el mismo nombre, y uno que
 * todavía se está cerrando (un remontaje rápido, StrictMode) ignoraría el
 * subscribe(). Se cierra del todo antes de crear el nuevo.
 */
export async function releaseChannel(supabase: Client, topic: string): Promise<void> {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
  if (stale) await supabase.removeChannel(stale)
}
