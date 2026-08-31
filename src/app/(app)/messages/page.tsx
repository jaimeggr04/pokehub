import Link from 'next/link'
import Image from 'next/image'
import { MessageSquare, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { listConversations } from '@/lib/chat'
import { timeAgo } from '@/lib/format'

export const metadata = { title: 'Mensajes' }

export default async function MessagesPage() {
  const { userId } = await requireProfile()
  const supabase = await createClient()
  const conversations = await listConversations(supabase, userId, 50)

  return (
    <div className="mx-auto max-w-[680px] px-3 sm:px-4">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
        <MessageSquare size={24} /> Mensajes
      </h1>

      {conversations.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <p className="font-semibold">Aún no tienes conversaciones</p>
          <p className="mt-1 text-sm text-muted">
            Entra en el perfil de un entrenador y pulsa «Mensaje» para empezar a hablar.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong"
          >
            Buscar entrenadores
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card transition hover:-translate-y-px hover:shadow-float"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted">
                  {c.other.avatar_url ? (
                    <Image src={c.other.avatar_url} alt="" width={44} height={44} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <User size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">@{c.other.username}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at)}</span>
                  </span>
                  <span className={`block truncate text-sm ${c.unread ? 'font-semibold' : 'text-muted'}`}>
                    {c.preview ?? 'Di hola 👋'}
                  </span>
                </span>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Sin leer" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
