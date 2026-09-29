import Link from 'next/link'
import { ChevronRight, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { UserRow, type UserRowData } from '@/components/user-row'

const VISIBLE = 5

/**
 * Entrenadores sugeridos para la columna derecha. `users` permite reutilizar
 * la lista que la página ya ha pedido (la misma que alimenta la fila de
 * historias en móvil) y ahorrarse una segunda llamada a la RPC.
 */
export async function SuggestionsPanel({ meId, users }: { meId: string; users?: UserRowData[] }) {
  let list = users
  if (!list) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('suggested_users', { limit_count: VISIBLE })
    list = (data ?? []) as unknown as UserRowData[]
  }

  const shown = list.slice(0, VISIBLE)
  if (shown.length === 0) return null

  return (
    <section aria-labelledby="suggestions-title" className="card p-4">
      <h2
        id="suggestions-title"
        className="mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-muted"
      >
        <UserPlus size={17} aria-hidden />
        Entrenadores que quizá conozcas
      </h2>

      <ul className="feed-suggestions flex flex-col gap-2">
        {shown.map((user) => (
          <UserRow key={user.id} user={user} meId={meId} following={false} />
        ))}
      </ul>

      <Link href="/search?tipo=entrenadores" className="group btn btn-ghost btn-sm mt-3 w-full text-muted hover:text-ink">
        Ver más entrenadores
        <ChevronRight
          size={15}
          aria-hidden
          className="transition-transform duration-(--dur) ease-(--ease-spring) group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  )
}
