import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOptionalUserId } from '@/lib/session'
import { listConversations } from '@/lib/chat'
import { ConversationList, ConversationListSkeleton, MessagesFrame } from '@/components/conversation-list'

/**
 * La lista vive en el layout: al saltar de un chat a otro no se vuelve a
 * pedir ni a animar, y en escritorio queda fija a la izquierda. Va en
 * Suspense para que la navegación a /messages pinte el esqueleto al instante.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <MessagesFrame
      inbox={
        <Suspense fallback={<ConversationListSkeleton />}>
          <Inbox />
        </Suspense>
      }
    >
      {children}
    </MessagesFrame>
  )
}

async function Inbox() {
  // Sólo hace falta el id: el perfil ya lo exige el layout de (app).
  const userId = await getOptionalUserId()
  if (!userId) redirect('/login')
  const supabase = await createClient()
  const conversations = await listConversations(supabase, userId, 50)

  return <ConversationList initial={conversations} meId={userId} now={Date.now()} />
}
