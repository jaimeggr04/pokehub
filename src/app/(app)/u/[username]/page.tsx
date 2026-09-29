import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays, Heart, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TEAM_SELECT, withLikes } from '@/lib/queries'
import {
  computeMedals,
  daysSince,
  pickPartner,
  trainerNumber,
  type PartnerBuild,
  type TrainerStats,
} from '@/lib/achievements'
import { PokeballGlyph, TeamCard } from '@/components/team-card'
import { TrainerBadges } from '@/components/trainer-badges'
import { ProfileShareButton, ProfileSocial } from '@/components/profile-social'
import { ProfileTrainerCard } from '@/components/profile-trainer-card'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import type { ProfileRow, TeamRow, TeamWithAuthor } from '@/lib/database.types'

// En la pestaña "Me gusta" sus equipos no se pintan, pero siguen haciendo
// falta para los contadores, las medallas y el compañero: basta con esto.
const TEAM_STATS_SELECT = 'id, is_public, like_count, builds(pokemon_id, pokemon_name, shiny)'

type TeamStatsRow = Pick<TeamRow, 'id' | 'is_public' | 'like_count'> & { builds: PartnerBuild[] | null }
type Client = Awaited<ReturnType<typeof createClient>>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  return { title: `@${username}` }
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { username } = await params
  const { tab } = await searchParams
  const showLiked = tab === 'megusta'

  const { userId } = await requireProfile()
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (!target) notFound()
  const person = target as ProfileRow
  const isMe = person.id === userId

  const [{ count: followers }, { count: following }, followRow, { data: ownData }, likedTeams] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', person.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', person.id),
    // A uno mismo no se le sigue: en tu ficha la consulta sobra.
    isMe
      ? null
      : supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('following_id', person.id)
          .maybeSingle(),
    // La RLS ya deja fuera los equipos privados ajenos: lo que llega es lo visible.
    supabase
      .from('teams')
      .select(showLiked ? TEAM_STATS_SELECT : TEAM_SELECT)
      .eq('user_id', person.id)
      .order('created_at', { ascending: false }),
    showLiked ? fetchLikedTeams(supabase, person.id) : null,
  ])

  const ownTeams = (ownData ?? []) as unknown as TeamStatsRow[]
  const teams = await withLikes(
    supabase,
    likedTeams ?? (ownTeams as unknown as TeamWithAuthor[]),
    userId,
  )

  let likesReceived = 0
  let shinyBuilds = 0
  for (const team of ownTeams) {
    // En tu propia ficha llegan también los privados, y ésos no los puede likear nadie más.
    if (team.is_public) likesReceived += team.like_count
    for (const build of team.builds ?? []) if (build.shiny) shinyBuilds += 1
  }

  // Todo lo que depende de la fecha se calcula aquí: el cliente sólo lo pinta.
  const stats: TrainerStats = {
    teams: ownTeams.length,
    likesReceived,
    followers: followers ?? 0,
    shinyBuilds,
    accountDays: daysSince(person.created_at),
  }
  const medals = computeMedals(stats)
  const partner = pickPartner(ownTeams)

  const displayName = person.display_name?.trim() || person.username
  const bio = person.bio?.trim()
  const joined = new Date(person.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const profileHref = `/u/${person.username}`

  return (
    // Misma rejilla que loading.tsx: si cambia aquí, cambiarla también allí.
    // md:pt-4: la cabecera empieza donde acaba la pokéball que cuelga del menú.
    <div className="profile-layout mx-auto max-w-[1160px] px-3 sm:px-4 md:pt-4">
      <header aria-labelledby="profile-name" className="profile-hero card stagger-item">
        <div className="profile-band">
          <BandBall />
          <ProfileShareButton username={person.username} name={displayName} />
        </div>

        <div className="profile-hero-body">
          <span className="profile-avatar" data-premium={person.is_premium || undefined}>
            <Avatar src={person.avatar_url} name={person.username} size={128} />
          </span>

          <div className="profile-hero-id">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1
                id="profile-name"
                className="min-w-0 text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] md:text-[1.75rem]"
              >
                {displayName}
              </h1>
              {person.is_premium && (
                <span
                  title="Entrenador con el plan Premium"
                  className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2.5 text-xs font-bold text-warning"
                >
                  <Sparkles size={13} strokeWidth={2.5} aria-hidden />
                  Premium
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
              <span className="font-semibold [overflow-wrap:anywhere]">@{person.username}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden className="shrink-0" />
                <span>
                  Se unió en <time dateTime={person.created_at}>{joined}</time>
                </span>
              </span>
            </p>
          </div>

          {bio && (
            <p className="profile-hero-bio max-w-prose whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">
              {bio}
            </p>
          )}

          <ProfileSocial
            targetId={person.id}
            username={person.username}
            isMe={isMe}
            following={Boolean(followRow?.data)}
            counts={{
              teams: stats.teams,
              followers: stats.followers,
              following: following ?? 0,
              likesReceived,
            }}
          />
        </div>
      </header>

      <aside
        aria-label={isMe ? 'Tu ficha y tus medallas' : 'Ficha y medallas'}
        style={{ '--i': 1 } as React.CSSProperties}
        className="profile-aside stagger-item"
      >
        <ProfileTrainerCard trainerNo={trainerNumber(person.id)} partner={partner} isMe={isMe} />
        <TrainerBadges medals={medals} isMe={isMe} trainerId={person.id} username={person.username} />
      </aside>

      <section aria-labelledby="profile-list-title" className="profile-main">
        <h2 id="profile-list-title" className="sr-only">
          {showLiked ? `Equipos que le gustan a @${person.username}` : `Equipos de @${person.username}`}
        </h2>

        <SegmentedTabs
          ariaLabel="Secciones del perfil"
          // En móvil las pestañas se quedan flotando bajo la cabecera; en md+
          // no, o la pokéball que cuelga del menú caería encima de ellas.
          className="sticky top-[calc(var(--header-h)+8px)] z-20 mb-4 max-md:shadow-float md:static"
          items={[
            {
              href: profileHref,
              active: !showLiked,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <PokeballGlyph className="size-[15px] shrink-0" />
                  Equipos
                </span>
              ),
            },
            {
              href: `${profileHref}?tab=megusta`,
              active: showLiked,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Heart size={15} aria-hidden className="shrink-0" />
                  Me gusta
                </span>
              ),
            },
          ]}
        />

        {teams.length === 0 ? (
          <ProfileEmpty liked={showLiked} isMe={isMe} username={person.username} />
        ) : (
          <div className="flex flex-col gap-4">
            {teams.map((team, index) => (
              <TeamCard key={team.id} team={team} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

async function fetchLikedTeams(supabase: Client, personId: string): Promise<TeamWithAuthor[]> {
  const { data: liked } = await supabase.from('likes').select('team_id').eq('user_id', personId)
  const ids = (liked ?? []).map((l) => l.team_id)
  if (ids.length === 0) return []

  const { data } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .in('id', ids)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as TeamWithAuthor[]
}

function ProfileEmpty({ liked, isMe, username }: { liked: boolean; isMe: boolean; username: string }) {
  if (liked) {
    return (
      <EmptyState
        icon={<Heart size={28} aria-hidden />}
        title={isMe ? 'Aún no te ha gustado ningún equipo' : `A @${username} aún no le ha gustado ningún equipo`}
        description={
          isMe
            ? 'Dale me gusta a los equipos que te inspiren y los tendrás siempre a mano aquí.'
            : 'Cuando le dé me gusta a algún equipo, aparecerá aquí.'
        }
        action={
          isMe && (
            <Link href="/home" className="btn btn-primary">
              Explorar equipos
            </Link>
          )
        }
      />
    )
  }

  return (
    <EmptyState
      title={isMe ? 'Aún no has publicado ningún equipo' : `@${username} todavía no ha publicado equipos`}
      description={
        isMe
          ? 'Créalo desde cero o impórtalo desde Showdown. Tu primera medalla te está esperando.'
          : 'Cuando comparta su primer equipo, lo verás aquí.'
      }
      action={
        isMe && (
          <Link href="/team/new" className="btn btn-primary">
            Crear mi primer equipo
          </Link>
        )
      }
    />
  )
}

/** Pokéball de trazo que asoma por la banda. Sólo decoración. */
function BandBall() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      aria-hidden
      focusable="false"
      className="profile-band-ball"
    >
      <circle cx="50" cy="50" r="46" />
      <path d="M4 50h30M66 50h30" />
      <circle cx="50" cy="50" r="15" />
      <circle cx="50" cy="50" r="6" fill="currentColor" stroke="none" />
    </svg>
  )
}
