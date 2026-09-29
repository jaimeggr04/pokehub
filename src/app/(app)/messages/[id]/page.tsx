import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOptionalUserId } from '@/lib/session'
import { MESSAGE_PAGE_SIZE, type ChatProfile } from '@/lib/chat'
import { ChatRoom } from '@/components/chat-room'
import type { MessageRow } from '@/lib/database.types'

export const metadata = { title: 'Chat' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ParticipantRow = { user_id: string; last_read_at: string; profiles: ChatProfile | null }

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Un id mal formado haría fallar la consulta en Postgres: mejor un 404 limpio.
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()

  // Todo a la vez. Del usuario sólo hace falta el id (el perfil ya lo exige el
  // layout de (app)), y RLS sólo devuelve filas si soy miembro: la consulta de
  // participantes sirve también de comprobación de acceso.
  const [userId, { data: participants }, { data: rows }] = await Promise.all([
    getOptionalUserId(),
    supabase
      .from('conversation_participants')
      .select('user_id, last_read_at, profiles(id, username, display_name, avatar_url)')
      .eq('conversation_id', id),
    // Los más recientes (uno de más para saber si hay anteriores), luego en orden cronológico.
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1),
  ])
  if (!userId) redirect('/login')

  const members = (participants ?? []) as unknown as ParticipantRow[]
  const me = members.find((p) => p.user_id === userId)
  const other = members.find((p) => p.user_id !== userId)
  if (!me || !other?.profiles) notFound()

  const newest = (rows ?? []) as MessageRow[]
  const hasMore = newest.length > MESSAGE_PAGE_SIZE
  const initialMessages = newest.slice(0, MESSAGE_PAGE_SIZE).reverse()

  return (
    <ChatRoom
      // Al cambiar de conversación la sala empieza de cero (estado, canal, scroll).
      key={id}
      conversationId={id}
      meId={userId}
      other={other.profiles}
      initialMessages={initialMessages}
      hasMore={hasMore}
      myLastReadAt={me.last_read_at}
      otherLastReadAt={other.last_read_at}
      now={Date.now()}
    />
  )
}
