import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { CalendarDays, Sparkles, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TEAM_SELECT, withLikes } from '@/lib/queries'
import { TeamCard } from '@/components/team-card'
import { FollowButton } from '@/components/follow-button'
import { MessageUserButton } from '@/components/message-user-button'
import type { ProfileRow, TeamWithAuthor } from '@/lib/database.types'

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

  const [{ count: followers }, { count: following }, { data: followRow }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', person.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', person.id),
    supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', userId)
      .eq('following_id', person.id)
      .maybeSingle(),
  ])

  let teams: TeamWithAuthor[] = []
  if (showLiked) {
    const { data: liked } = await supabase.from('likes').select('team_id').eq('user_id', person.id)
    const ids = (liked ?? []).map((l) => l.team_id)
    if (ids.length) {
      const { data } = await supabase
        .from('teams')
        .select(TEAM_SELECT)
        .in('id', ids)
        .order('created_at', { ascending: false })
      teams = (data ?? []) as unknown as TeamWithAuthor[]
    }
  } else {
    const { data } = await supabase
      .from('teams')
      .select(TEAM_SELECT)
      .eq('user_id', person.id)
      .order('created_at', { ascending: false })
    teams = (data ?? []) as unknown as TeamWithAuthor[]
  }
  teams = await withLikes(supabase, teams, userId)

  const joined = new Date(person.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-[820px] px-3 sm:px-4">
      <header className="mb-5 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-5">
          <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-bg-elevated bg-surface-2 text-muted shadow-card">
            {person.avatar_url ? (
              <Image src={person.avatar_url} alt="" width={96} height={96} unoptimized className="h-full w-full object-cover" />
            ) : (
              <User size={40} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
              {person.display_name || person.username}
              {person.is_premium && <Sparkles size={18} className="text-brand" aria-label="Premium" />}
            </h1>
            <p className="text-sm text-muted">@{person.username}</p>
            {person.bio && <p className="mt-2 max-w-prose text-sm">{person.bio}</p>}

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Stat label="equipos" value={teams.length} hidden={showLiked} />
              <Stat label="seguidores" value={followers ?? 0} />
              <Stat label="siguiendo" value={following ?? 0} />
              <span className="flex items-center gap-1.5 text-muted">
                <CalendarDays size={14} /> Se unió en {joined}
              </span>
            </dl>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {isMe ? (
              <Link
                href="/settings"
                className="rounded-full bg-surface-2 px-5 py-2 text-sm font-semibold shadow-card transition hover:bg-line"
              >
                Editar perfil
              </Link>
            ) : (
              <>
                <FollowButton targetId={person.id} following={Boolean(followRow)} size="md" />
                <MessageUserButton targetId={person.id} />
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="mb-4 flex gap-2 rounded-full bg-surface p-1 shadow-card">
        <Tab href={`/u/${person.username}`} active={!showLiked}>Equipos</Tab>
        <Tab href={`/u/${person.username}?tab=megusta`} active={showLiked}>Me gusta</Tab>
      </nav>

      {teams.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          {showLiked
            ? 'Todavía no ha dado me gusta a ningún equipo.'
            : isMe
              ? 'Aún no has publicado ningún equipo.'
              : 'Este entrenador todavía no ha publicado equipos.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hidden }: { label: string; value: number; hidden?: boolean }) {
  if (hidden) return null
  return (
    <span>
      <strong className="tabular-nums">{value}</strong> <span className="text-muted">{label}</span>
    </span>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
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
