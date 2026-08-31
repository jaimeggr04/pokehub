import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowLeft, Heart, MessageCircle, Pencil, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TEAM_SELECT } from '@/lib/queries'
import { BuildCard } from '@/components/build-card'
import { CopyButton } from '@/components/copy-button'
import { Comments, type CommentItem } from '@/components/comments'
import { LikeButton } from '@/components/like-button'
import { ShareButton } from '@/components/share-button'
import { DeleteTeamButton } from '@/components/delete-team-button'
import { teamToShowdown } from '@/lib/showdown'
import { timeAgo } from '@/lib/format'
import type { TeamWithAuthor } from '@/lib/database.types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('teams').select('name, description').eq('id', id).maybeSingle()
  if (!data) return { title: 'Equipo no encontrado' }
  return { title: data.name, description: data.description.slice(0, 160) }
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile, userId } = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase.from('teams').select(TEAM_SELECT).eq('id', id).maybeSingle()
  if (!data) notFound()
  const team = data as unknown as TeamWithAuthor

  const [{ data: likeRow }, { data: commentRows }] = await Promise.all([
    supabase.from('likes').select('team_id').eq('team_id', id).eq('user_id', userId).maybeSingle(),
    supabase
      .from('comments')
      .select('id, body, created_at, author:profiles!comments_user_id_fkey(id, username, avatar_url)')
      .eq('team_id', id)
      .order('created_at', { ascending: true }),
  ])

  const builds = [...team.builds].sort((a, b) => a.slot - b.slot)
  const isOwner = team.user_id === userId
  const comments = (commentRows ?? []) as unknown as CommentItem[]

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-4">
      <Link
        href="/home"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand"
      >
        <ArrowLeft size={16} /> Volver al feed
      </Link>

      <header className="mb-5 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{team.format}</p>
            <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">{team.name}</h1>
            <Link
              href={`/u/${team.author.username}`}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold transition hover:text-brand"
            >
              <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted">
                {team.author.avatar_url ? (
                  <Image src={team.author.avatar_url} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" />
                ) : (
                  <User size={15} />
                )}
              </span>
              @{team.author.username}
            </Link>
            <span className="ml-2 text-xs text-muted">· {timeAgo(team.created_at)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LikeButton teamId={team.id} liked={Boolean(likeRow)} count={team.like_count} />
            <Link
              href="#comentarios"
              aria-label="Ir a los comentarios"
              className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm shadow-card transition hover:bg-line"
            >
              <MessageCircle size={16} /> {team.comment_count}
            </Link>
            <ShareButton path={`/team/${team.id}`} title={team.name} />
            <CopyButton text={teamToShowdown(builds)} label="Importar" copiedLabel="Copiado" />
            {isOwner && (
              <>
                <Link
                  href={`/team/${team.id}/edit`}
                  className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold shadow-card transition hover:bg-line"
                >
                  <Pencil size={16} /> Editar
                </Link>
                <DeleteTeamButton teamId={team.id} />
              </>
            )}
          </div>
        </div>

        {team.description && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-relaxed shadow-pressed">
            {team.description}
          </p>
        )}
      </header>

      <section aria-label="Pokémon del equipo" className="mb-8 grid gap-4 lg:grid-cols-2">
        {builds.map((b) => (
          <BuildCard key={b.id} build={b} />
        ))}
        {builds.length === 0 && (
          <p className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Este equipo todavía no tiene Pokémon.
          </p>
        )}
      </section>

      <Comments
        teamId={team.id}
        comments={comments}
        me={{ id: profile.id, username: profile.username, avatar_url: profile.avatar_url }}
      />

      <p className="sr-only">
        <Heart size={12} /> {team.like_count} me gusta
      </p>
    </div>
  )
}
