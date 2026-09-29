import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Client = SupabaseClient<Database>

// Tope de conversaciones a confirmar. El globo muestra «9+» mucho antes, y así
// la última consulta no crece con el historial de chats del usuario.
const MAX_CANDIDATES = 20

type ParticipantRow = {
  conversation_id: string
  last_read_at: string
  conversations: { last_message_at: string } | null
}

/**
 * Conversaciones con mensajes sin leer, con el mismo criterio que la lista de
 * chats: el último mensaje es del otro y es posterior a mi última lectura.
 * Sirve tanto con el cliente de servidor como con el del navegador. Devuelve
 * null si falla una consulta, para que quien la use conserve el valor previo.
 */
export async function getUnreadConversationIds(supabase: Client, userId: string): Promise<string[] | null> {
  // Una sola consulta para mis participaciones y la fecha del último mensaje
  // de cada conversación (el trigger bump_conversation la mantiene al día).
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, conversations!inner(last_message_at)')
    .eq('user_id', userId)
  if (error || !data) return null

  const candidates = (data as unknown as ParticipantRow[])
    .flatMap((row) => {
      const lastMessageAt = row.conversations?.last_message_at
      return lastMessageAt && Date.parse(lastMessageAt) > Date.parse(row.last_read_at)
        ? [{ id: row.conversation_id, lastMessageAt }]
        : []
    })
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
    .slice(0, MAX_CANDIDATES)

  if (candidates.length === 0) return []

  // Que haya algo más nuevo que mi lectura no basta: puede ser mi propia
  // respuesta. last_message_at es exactamente el created_at del último mensaje,
  // así que basta pedir esos mensajes concretos para saber quién lo envió.
  const { data: latest, error: latestError } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', candidates.map((c) => c.id))
    .in('created_at', candidates.map((c) => c.lastMessageAt))
  if (latestError || !latest) return null

  const lastAt = new Map(candidates.map((c) => [c.id, c.lastMessageAt]))
  const unread = new Set<string>()
  for (const message of latest) {
    if (message.sender_id !== userId && lastAt.get(message.conversation_id) === message.created_at) {
      unread.add(message.conversation_id)
    }
  }
  return candidates.map((c) => c.id).filter((id) => unread.has(id))
}

/** Número de conversaciones sin leer (el globo de Mensajes). */
export async function getUnreadCount(supabase: Client, userId: string): Promise<number> {
  return (await getUnreadConversationIds(supabase, userId))?.length ?? 0
}

/** Id de la conversación abierta si la ruta es /messages/<id>. */
export function openConversationId(pathname: string | null): string | null {
  // Los ids son UUID: no hace falta (ni conviene) decodificar nada.
  const match = pathname?.match(/^\/messages\/([^/?#]+)/)
  return match ? match[1] : null
}
