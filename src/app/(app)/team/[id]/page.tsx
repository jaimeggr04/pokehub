import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PawPrint, Pencil, Radar, Swords } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TEAM_SELECT } from '@/lib/queries'
import { BuildCard } from '@/components/build-card'
import { Comments, type CommentItem } from '@/components/comments'
import { ShowdownExport } from '@/components/showdown-export'
import { TeamAnalysis } from '@/components/team-analysis'
import { TeamHero, memberName } from '@/components/team-hero'
import { TeamSectionNav, type TeamSectionItem } from '@/components/team-section-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { teamToShowdown } from '@/lib/showdown'
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
  const hasBuilds = builds.length > 0
  // Mismo orden que los bloques de teamToShowdown (por hueco): ShowdownExport los empareja por posición.
  const members = builds.map((b) => ({ pokemonId: b.pokemon_id, name: memberName(b) }))

  // Sin Pokémon no hay nada que analizar ni exportar: esas secciones ni se pintan.
  const sections: TeamSectionItem[] = [
    { id: 'pokemon', label: 'Pokémon', count: builds.length },
    ...(hasBuilds
      ? [
          { id: 'analisis', label: 'Análisis' },
          { id: 'showdown', label: 'Showdown' },
        ]
      : []),
    { id: 'comentarios', label: 'Comentarios', count: comments.length },
  ]

  return (
    // md:pt-4: la cabecera empieza donde acaba la pokéball que cuelga de la barra superior.
    // Misma geometría que loading.tsx: si cambia aquí, cambiarla también allí.
    <article aria-labelledby="team-title" className="mx-auto max-w-[1200px] px-3 sm:px-4 md:pt-4">
      <TeamHero
        team={team}
        builds={builds}
        liked={Boolean(likeRow)}
        commentCount={comments.length}
        isOwner={isOwner}
        titleId="team-title"
      />

      <TeamSectionNav items={sections} />

      <div className="flex flex-col gap-12 md:gap-14">
        <section
          id="pokemon"
          aria-labelledby="team-pokemon-title"
          tabIndex={-1}
          className="team-section outline-none"
        >
          <SectionHeading
            id="team-pokemon-title"
            icon={<PawPrint size={20} />}
            title="Pokémon"
            count={builds.length}
            description="Objeto, habilidad, naturaleza, movimientos y estadísticas de cada set."
          />
          {hasBuilds ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {builds.map((build, i) => (
                // grid: la tarjeta estira hasta la altura de su vecina de fila.
                <li key={build.id} id={`pokemon-${build.slot}`} className="team-anchor grid">
                  <BuildCard build={build} index={i} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Este equipo aún no tiene Pokémon"
              description={
                isOwner
                  ? 'Añade hasta seis desde el editor, o pega un equipo de Showdown para importarlo de golpe.'
                  : 'Su entrenador todavía no ha elegido a ningún Pokémon.'
              }
              action={
                isOwner && (
                  <Link href={`/team/${team.id}/edit`} className="btn btn-primary">
                    <Pencil size={16} aria-hidden />
                    Añadir Pokémon
                  </Link>
                )
              }
            />
          )}
        </section>

        {hasBuilds && (
          <>
            <section
              id="analisis"
              aria-labelledby="team-analysis-title"
              tabIndex={-1}
              className="team-section outline-none"
            >
              <SectionHeading
                id="team-analysis-title"
                icon={<Radar size={20} />}
                title="Análisis"
                description="Debilidades y resistencias de tipo, velocidad y media de estadísticas base."
              />
              <TeamAnalysis members={members} />
            </section>

            <section
              id="showdown"
              aria-labelledby="team-showdown-title"
              tabIndex={-1}
              className="team-section outline-none"
            >
              <SectionHeading
                id="team-showdown-title"
                icon={<Swords size={20} />}
                title="Exportar a Showdown"
                description="Cópialo y pégalo en Teambuilder › New Team › Import from text."
              />
              <ShowdownExport text={teamToShowdown(builds)} teamName={team.name} members={members} />
            </section>
          </>
        )}

        {/* Lleva dentro su propio id="comentarios": el feed enlaza a /team/<id>#comentarios. */}
        <Comments
          teamId={team.id}
          comments={comments}
          me={{ id: profile.id, username: profile.username, avatar_url: profile.avatar_url }}
          teamAuthorId={team.user_id}
        />
      </div>
    </article>
  )
}

/** Encabezado de sección con el mismo dibujo que el de Comentarios. */
function SectionHeading({
  id,
  icon,
  title,
  count,
  description,
}: {
  id: string
  icon: React.ReactNode
  title: string
  count?: number
  description: string
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-xl font-extrabold leading-tight tracking-tight">
          {title}
          {count !== undefined && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-surface-2 px-2 text-xs font-bold text-muted shadow-card">
              {count}
            </span>
          )}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </div>
  )
}
