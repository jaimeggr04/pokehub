import { createClient } from '@/lib/supabase/server'
import { listConversations } from '@/lib/chat'
import { ConversationList } from '@/components/conversation-list'

/** Panel de la portada: los 4 chats más recientes, en vivo. */
export async function ChatsPanel({ meId }: { meId: string }) {
  const supabase = await createClient()
  const conversations = await listConversations(supabase, meId, 4)

  return (
    <section className="card p-4">
      <ConversationList variant="compact" initial={conversations} meId={meId} now={Date.now()} />
    </section>
  )
}
