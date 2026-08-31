'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare } from 'lucide-react'
import { startConversation } from '@/app/actions/social'

export function MessageUserButton({ targetId }: { targetId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await startConversation(targetId)
          if (res.conversationId) router.push(`/messages/${res.conversationId}`)
        })
      }
      className="flex items-center justify-center gap-1.5 rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold shadow-card transition hover:bg-line disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
      Mensaje
    </button>
  )
}
