import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { getFollowingIds } from '@/lib/queries'
import { SearchBox } from '@/components/search-box'
import { UserRow, type UserRowData } from '@/components/user-row'

export const metadata = { title: 'Buscar entrenadores' }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const term = (q ?? '').trim()

  const { userId } = await requireProfile()
  const supabase = await createClient()
  const following = new Set(await getFollowingIds(supabase, userId))

  let users: UserRowData[] = []
  if (term) {
    const { data } = await supabase.rpc('search_profiles', { q: term, limit_count: 30 })
    users = (data ?? []) as unknown as UserRowData[]
  } else {
    const { data } = await supabase.rpc('suggested_users', { limit_count: 20 })
    users = (data ?? []) as unknown as UserRowData[]
  }

  return (
    <div className="mx-auto max-w-[680px] px-3 sm:px-4">
      <h1 className="mb-4 text-2xl font-extrabold">Buscar entrenadores</h1>
      <div className="mb-5">
        <SearchBox autoFocus />
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
        {term ? `Resultados para «${term}»` : 'Sugerencias para ti'}
      </h2>

      {users.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          No hemos encontrado a nadie con ese nombre.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} meId={userId} following={following.has(u.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}
