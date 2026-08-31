import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Client = SupabaseClient<Database>

export interface ConversationSummary {
  id: string
  last_message_at: string
  preview: string | null
  unread: boolean
  other: { id: string; username: string; display_name: string | null; avatar_url: string | null }
}

/**
 * Lista las conversaciones del usuario con el otro participante, el último
 * mensaje y si hay mensajes sin leer.
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

  const ids = (mine ?? []).map((m) => m.conversation_id)
  if (ids.length === 0) return []

  const readMap = new Map((mine ?? []).map((m) => [m.conversation_id, m.last_read_at]))

  const [{ data: convs }, { data: others }, { data: lastMessages }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, last_message_at')
      .in('id', ids)
      .order('last_message_at', { ascending: false })
      .limit(limit),
    supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles!inner(id, username, display_name, avatar_url)')
      .in('conversation_id', ids)
      .neq('user_id', meId),
    supabase
      .from('messages')
      .select('conversation_id, body, created_at, sender_id')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false }),
  ])

  type OtherRow = {
    conversation_id: string
    profiles: ConversationSummary['other']
  }

  const otherMap = new Map<string, ConversationSummary['other']>()
  for (const row of (others ?? []) as unknown as OtherRow[]) {
    if (!otherMap.has(row.conversation_id)) otherMap.set(row.conversation_id, row.profiles)
  }

  const lastMap = new Map<string, { body: string; created_at: string; sender_id: string }>()
  for (const m of lastMessages ?? []) {
    if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m)
  }

  return (convs ?? [])
    .map((c) => {
      const other = otherMap.get(c.id)
      if (!other) return null
      const last = lastMap.get(c.id)
      const lastRead = readMap.get(c.id) ?? '1970-01-01'
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        preview: last ? (last.sender_id === meId ? `Tú: ${last.body}` : last.body) : null,
        unread: Boolean(last && last.sender_id !== meId && last.created_at > lastRead),
        other,
      } satisfies ConversationSummary
    })
    .filter(Boolean) as ConversationSummary[]
}
