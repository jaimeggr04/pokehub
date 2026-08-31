import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TEAM_SELECT, getFollowingIds, withLikes } from '@/lib/queries'
import { TeamCard } from '@/components/team-card'
import { PokemonPanel } from '@/components/pokemon-panel'
import { SearchBox } from '@/components/search-box'
import { SuggestionsPanel } from '@/components/suggestions-panel'
import { ChatsPanel } from '@/components/chats-panel'
import type { TeamWithAuthor } from '@/lib/database.types'

export const metadata = { title: 'Inicio' }

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const friendsOnly = tab === 'amigos'

  const { profile, userId } = await requireProfile()
  const supabase = await createClient()

  let query = supabase
    .from('teams')
    .select(TEAM_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(30)

  if (friendsOnly) {
    const ids = await getFollowingIds(supabase, userId)
    query = ids.length
      ? query.in('user_id', ids)
      : query.eq('user_id', '00000000-0000-0000-0000-000000000000')
  }

  const { data } = await query
  const teams = await withLikes(supabase, (data ?? []) as unknown as TeamWithAuthor[], userId)

  return (
    <div className="mx-auto grid max-w-[1700px] gap-5 px-3 sm:px-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_23rem]">
      {/* Columna izquierda: detalle del Pokémon seleccionado */}
      <aside className="hidden lg:block">
        <div className="sticky top-[152px]">
          <PokemonPanel />
        </div>
      </aside>

      {/* Feed */}
      <section className="min-w-0">
        <nav className="mb-4 flex gap-2 rounded-full bg-surface p-1 shadow-card" aria-label="Filtro del feed">
          <TabLink href="/home" active={!friendsOnly}>Para ti</TabLink>
          <TabLink href="/home?tab=amigos" active={friendsOnly}>Siguiendo</TabLink>
        </nav>

        {teams.length === 0 ? (
          <EmptyFeed friendsOnly={friendsOnly} />
        ) : (
          <div className="flex flex-col gap-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>

      {/* Columna derecha: buscador, sugerencias y chats */}
      <aside className="hidden xl:block">
        <div className="sticky top-[152px] flex flex-col gap-4">
          <SearchBox />
          <SuggestionsPanel meId={userId} />
          <ChatsPanel meId={userId} />
        </div>
      </aside>

      {/* Botón flotante para crear equipo */}
      <Link
        href="/team/new"
        aria-label="Crear un equipo nuevo"
        className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-fg shadow-float transition hover:bg-brand-strong active:translate-y-0.5 md:bottom-16"
      >
        <Plus size={28} />
      </Link>

      <span className="sr-only">Sesión iniciada como {profile.username}</span>
    </div>
  )
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 rounded-full py-2 text-center text-sm font-semibold transition ${
        active ? 'bg-brand text-brand-fg shadow-card' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

function EmptyFeed({ friendsOnly }: { friendsOnly: boolean }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
      <p className="text-lg font-bold">
        {friendsOnly ? 'Aún no sigues a nadie' : 'Todavía no hay equipos'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {friendsOnly
          ? 'Sigue a otros entrenadores para ver aquí sus equipos.'
          : 'Sé el primero en compartir un equipo con la comunidad.'}
      </p>
      <Link
        href={friendsOnly ? '/search' : '/team/new'}
        className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong"
      >
        {friendsOnly ? 'Buscar entrenadores' : 'Crear mi primer equipo'}
      </Link>
    </div>
  )
}
