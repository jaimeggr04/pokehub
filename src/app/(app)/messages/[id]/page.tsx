import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { ChatRoom } from '@/components/chat-room'
import type { MessageRow } from '@/lib/database.types'

export const metadata = { title: 'Chat' }

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await requireProfile()
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) notFound()

  const [{ data: otherRow }, { data: messages }] = await Promise.all([
    supabase
      .from('conversation_participants')
      .select('profiles!inner(id, username, display_name, avatar_url)')
      .eq('conversation_id', id)
      .neq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  const other = (otherRow as unknown as {
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  } | null)?.profiles

  if (!other) notFound()

  return (
    <div className="mx-auto flex max-w-[720px] flex-col px-3 sm:px-4">
      <header className="mb-3 flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
        <Link href="/messages" aria-label="Volver" className="rounded-lg p-1 text-muted transition hover:text-brand">
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted">
            {other.avatar_url ? (
              <Image src={other.avatar_url} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
            ) : (
              <User size={19} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold leading-tight">
              {other.display_name || other.username}
            </span>
            <span className="block truncate text-xs text-muted">@{other.username}</span>
          </span>
        </Link>
      </header>

      <ChatRoom
        conversationId={id}
        meId={userId}
        initialMessages={(messages ?? []) as MessageRow[]}
        otherName={other.username}
      />
    </div>
  )
}
