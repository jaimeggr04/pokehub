import { Suspense } from 'react'
import Link from 'next/link'
import { Sparkles, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { PokemonPanel } from '@/components/pokemon-panel'
import { SearchBox } from '@/components/search-box'
import { SuggestionsPanel } from '@/components/suggestions-panel'
import { ChatsPanel } from '@/components/chats-panel'
import { TeamCardSkeleton } from '@/components/team-card'
import { CreateTeamFab, FeedList } from '@/components/feed-list'
import { FeedGreeting } from '@/components/feed-greeting'
import { TrainerStories } from '@/components/trainer-stories'
import { EmptyState } from '@/components/ui/empty-state'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserRowData } from '@/components/user-row'
import { queryFeedPage, type FeedTab } from '@/app/(app)/home/feed-query'

export const metadata = { title: 'Inicio' }

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: tabParam } = await searchParams
  const tab: FeedTab = tabParam === 'amigos' ? 'siguiendo' : 'para-ti'

  const supabase = await createClient()
  // Una sola llamada a la RPC para la fila de historias (móvil) y el panel lateral (xl).
  const [{ profile, userId }, { data: suggestedData }] = await Promise.all([
    requireProfile(),
    supabase.rpc('suggested_users', { limit_count: 10 }),
  ])
  const suggested = (suggestedData ?? []) as unknown as UserRowData[]
  const name = profile.display_name?.trim() || profile.username

  return (
    // Misma rejilla que loading.tsx: si cambia aquí, cambiarla también allí.
    <div className="mx-auto grid max-w-[1700px] gap-5 px-3 sm:px-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_23rem] 2xl:grid-cols-[24rem_minmax(0,1fr)_25rem] 2xl:gap-6">
      <aside aria-label="Detalle del Pokémon" className="hidden lg:block">
        <div className="feed-rail">
          <div className="feed-rail-scroll">
            <PokemonPanel />
          </div>
        </div>
      </aside>

      {/* md:pt-4: el feed empieza donde acaba la pokéball que cuelga de la cabecera. */}
      <section
        aria-label="Equipos de la comunidad"
        className="mx-auto w-full min-w-0 max-w-[680px] md:pt-4 lg:max-w-[760px]"
      >
        <FeedGreeting name={name} />

        <TrainerStories users={suggested} className="mt-5 xl:hidden" />

        <SegmentedTabs
          ariaLabel="Filtro del feed"
          // En móvil las pestañas se quedan flotando bajo la cabecera. En md+ no:
          // la pokéball de la cabecera caería justo encima de ellas.
          className="sticky top-[calc(var(--header-h)+8px)] z-20 mb-4 mt-5 max-md:shadow-float md:static"
          items={[
            {
              href: '/home',
              active: tab === 'para-ti',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={15} aria-hidden />
                  Para ti
                </span>
              ),
            },
            {
              href: '/home?tab=amigos',
              active: tab === 'siguiendo',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Users size={15} aria-hidden />
                  Siguiendo
                </span>
              ),
            },
          ]}
        />

        {/* La key hace que al cambiar de pestaña se vea el esqueleto en vez del feed anterior. */}
        <Suspense key={tab} fallback={<FeedSkeleton />}>
          <Feed tab={tab} userId={userId} />
        </Suspense>

        <CreateTeamFab />
      </section>

      <aside aria-label="Buscar, sugerencias y mensajes" className="hidden xl:block">
        <div className="feed-rail">
          {/* Fuera de la zona con scroll: si no, el desplegable de resultados quedaría recortado. */}
          <div className="relative z-10 shrink-0">
            <SearchBox />
          </div>
          <div className="feed-rail-scroll flex flex-col gap-4">
            <SuggestionsPanel meId={userId} users={suggested} />
            <Suspense fallback={<Skeleton className="h-52 rounded-card" />}>
              <ChatsPanel meId={userId} />
            </Suspense>
          </div>
        </div>
      </aside>
    </div>
  )
}

async function Feed({ tab, userId }: { tab: FeedTab; userId: string }) {
  const supabase = await createClient()
  const page = await queryFeedPage(supabase, userId, { tab, cursor: null }).catch(() => null)

  if (!page) {
    return (
      <EmptyState
        title="No se pudo cargar el feed"
        description="Ha habido un problema al hablar con el servidor. Vuelve a intentarlo en unos segundos."
        action={
          <Link href={tab === 'siguiendo' ? '/home?tab=amigos' : '/home'} className="btn btn-primary">
            Reintentar
          </Link>
        }
      />
    )
  }

  if (page.teams.length === 0) return <EmptyFeed tab={tab} followsNobody={page.followsNobody} />

  return <FeedList tab={tab} initialTeams={page.teams} initialCursor={page.nextCursor} />
}

function EmptyFeed({ tab, followsNobody }: { tab: FeedTab; followsNobody: boolean }) {
  if (tab === 'siguiendo') {
    return (
      <EmptyState
        icon={<Users size={28} aria-hidden />}
        title={followsNobody ? 'Aún no sigues a ningún entrenador' : 'Tus entrenadores aún no han publicado equipos'}
        description={
          followsNobody
            ? 'Sigue a otros entrenadores y sus equipos aparecerán aquí en cuanto los publiquen.'
            : 'Cuando alguien a quien sigues comparta un equipo, lo verás aquí antes que nadie.'
        }
        action={
          <>
            <Link href="/search?tipo=entrenadores" className="btn btn-primary">
              Descubrir entrenadores
            </Link>
            <Link href="/home" className="btn btn-soft">
              Ver «Para ti»
            </Link>
          </>
        }
      />
    )
  }

  return (
    <EmptyState
      title="Todavía no hay equipos"
      description="La comunidad está esperando su primer equipo. Créalo desde cero o impórtalo desde Showdown."
      action={
        <Link href="/team/new" className="btn btn-primary">
          Crear mi primer equipo
        </Link>
      }
    />
  )
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        Cargando equipos…
      </p>
      {[0, 1, 2].map((i) => (
        <TeamCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}
