import Link from 'next/link'
import Image from 'next/image'
import { MessageSquare, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/format'
import { listConversations } from '@/lib/chat'

export async function ChatsPanel({ meId }: { meId: string }) {
  const supabase = await createClient()
  const conversations = await listConversations(supabase, meId, 4)
  const unread = conversations.filter((c) => c.unread).length

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        <span className="relative">
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-fg">
              {unread}
            </span>
          )}
        </span>
        Mensajes
      </h2>

      {conversations.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">
          Aún no tienes conversaciones. Entra en un perfil y escribe a alguien.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 shadow-card transition hover:-translate-y-px hover:shadow-float"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-line text-muted">
                  {c.other.avatar_url ? (
                    <Image src={c.other.avatar_url} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <User size={18} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold">@{c.other.username}</span>
                    <span className="shrink-0 text-[10px] text-muted">{timeAgo(c.last_message_at)}</span>
                  </span>
                  <span className={`block truncate text-xs ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                    {c.preview ?? 'Di hola 👋'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/messages"
        className="mt-3 block text-center text-xs font-semibold text-muted underline underline-offset-2 transition hover:text-brand"
      >
        Ver todos los chats
      </Link>
    </section>
  )
}
