'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { markConversationRead, sendMessage } from '@/app/actions/social'
import type { MessageRow } from '@/lib/database.types'

export function ChatRoom({
  conversationId,
  meId,
  initialMessages,
  otherName,
}: {
  conversationId: string
  meId: string
  initialMessages: MessageRow[]
  otherName: string
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Suscripción en tiempo real a los mensajes nuevos de esta conversación.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  useEffect(() => {
    markConversationRead(conversationId)
  }, [conversationId, messages.length])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')

    const optimistic: MessageRow = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: meId,
      body,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      await sendMessage(conversationId, body)
    })
  }

  return (
    <>
      <ol
        className="flex min-h-[45vh] flex-col gap-2 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card"
        style={{ maxHeight: 'calc(100dvh - 300px)' }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <li className="my-auto text-center text-sm text-muted">
            Empieza la conversación con @{otherName}.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId
          return (
            <li key={m.id} className={mine ? 'self-end' : 'self-start'}>
              <p
                className={`max-w-[72vw] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-card sm:max-w-[28rem] ${
                  mine
                    ? 'rounded-br-sm bg-brand text-brand-fg'
                    : 'rounded-bl-sm bg-surface-2 text-ink'
                }`}
              >
                {m.body}
              </p>
              <time
                dateTime={m.created_at}
                className={`mt-0.5 block text-[10px] text-muted ${mine ? 'text-right' : ''}`}
              >
                {new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          )
        })}
        <div ref={bottomRef} />
      </ol>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={`Mensaje para @${otherName}…`}
          aria-label="Escribe un mensaje"
          className="h-12 flex-1 rounded-full border border-line bg-surface-2 px-5 text-sm outline-none transition placeholder:text-muted focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label="Enviar mensaje"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5 disabled:opacity-50"
        >
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </>
  )
}
