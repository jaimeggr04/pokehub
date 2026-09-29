'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare } from 'lucide-react'
import clsx from 'clsx'
import { startConversation } from '@/app/actions/social'
import { toast } from '@/components/ui/toast'

/**
 * Abre (o reutiliza) el chat con otro entrenador. La transición sigue pendiente
 * hasta que termina la navegación, así el giro dura lo que tarda en abrirse.
 */
export function MessageUserButton({
  targetId,
  username,
  className,
}: {
  targetId: string
  /** Para la etiqueta accesible: "Enviar un mensaje a @ash". */
  username?: string
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function open() {
    startTransition(async () => {
      let conversationId: string | undefined
      let error = 'Inténtalo de nuevo en unos segundos.'
      try {
        const result = await startConversation(targetId)
        if ('conversationId' in result && result.conversationId) conversationId = result.conversationId
        else if ('error' in result && result.error) error = result.error
      } catch {
        error = 'Comprueba tu conexión e inténtalo de nuevo.'
      }

      if (conversationId) {
        router.push(`/messages/${conversationId}`)
        return
      }
      toast('No se pudo abrir el chat', { tone: 'error', description: error })
    })
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      aria-busy={pending}
      aria-label={username ? `Enviar un mensaje a @${username}` : undefined}
      className={clsx('btn btn-soft h-11 gap-2 px-5', className)}
    >
      {pending ? (
        <Loader2 size={17} aria-hidden className="shrink-0 animate-spin" />
      ) : (
        <MessageSquare size={17} aria-hidden className="shrink-0" />
      )}
      Mensaje
    </button>
  )
}
