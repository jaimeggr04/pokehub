import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserRow, type UserRowData } from '@/components/user-row'

export async function SuggestionsPanel({ meId }: { meId: string }) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('suggested_users', { limit_count: 4 })
  const users = (data ?? []) as unknown as UserRowData[]

  if (users.length === 0) return null

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-muted">
        Entrenadores que quizá conozcas
      </h2>
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <UserRow key={u.id} user={u} meId={meId} following={false} />
        ))}
      </ul>
      <Link
        href="/search"
        className="mt-3 block text-center text-xs font-semibold text-muted underline underline-offset-2 transition hover:text-brand"
      >
        Ver más…
      </Link>
    </section>
  )
}
