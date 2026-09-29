import Link from 'next/link'
import clsx from 'clsx'
import { ArrowLeft, Lock, MessageCircle, PawPrint, Pencil, Sparkles, Trophy } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { LikeButton } from '@/components/like-button'
import { ShareButton } from '@/components/share-button'
import { DeleteTeamButton } from '@/components/delete-team-button'
import { PokemonArt } from '@/components/pokemon-details'
import { TeamDescription } from '@/components/team-description'
import { prettify } from '@/lib/pokemon'
import { timeAgo } from '@/lib/format'
import type { BuildRow, TeamWithAuthor } from '@/lib/database.types'

// Zona horaria fija, como en los comentarios: la fecha completa del título no
// depende de dónde se renderice.
const fullDate = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
})

/** Nombre con el que se muestra un miembro: su mote si lo tiene. */
export function memberName(build: BuildRow) {
  return build.nickname?.trim() || prettify(build.pokemon_name)
}

/**
 * Cabecera de la página de equipo: banda de marca con el nombre, el autor y la
 * alineación flotando, y debajo, sobre la superficie normal, la descripción y
 * las acciones. Las acciones van fuera del degradado a propósito: sus estados
 * (me gusta activo, enlace copiado, borrar) usan tintes de marca, verde y rojo
 * que sobre la banda roja o morada no se distinguirían.
 */
export function TeamHero({
  team,
  builds,
  liked,
  commentCount,
  isOwner,
  titleId,
}: {
  team: TeamWithAuthor
  /** Ya ordenados por hueco. */
  builds: BuildRow[]
  liked: boolean
  commentCount: number
  isOwner: boolean
  titleId: string
}) {
  const profileHref = `/u/${team.author.username}`
  const displayName = team.author.display_name?.trim()
  const showDisplayName = !!displayName && displayName.toLowerCase() !== team.author.username.toLowerCase()
  const description = team.description.trim()
  const format = team.format.trim()
  const hasLineup = builds.length > 0

  return (
    <header className="mb-4 overflow-hidden rounded-3xl border border-line bg-surface shadow-card animate-fade-up md:mb-6">
      <div
        className={clsx(
          'team-hero-band px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7',
          hasLineup
            ? 'lg:grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-end lg:gap-8'
            : 'pb-6 lg:pb-8',
        )}
      >
        <HeroWatermark className="team-hero-ball" />

        <div className={clsx('team-hero-text relative min-w-0', hasLineup && 'lg:self-center lg:pb-7')}>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/home"
              aria-label="Volver al inicio"
              title="Volver al inicio"
              className="team-hero-chip pressable size-9 justify-center px-0 hover:bg-black/40"
            >
              <ArrowLeft size={17} aria-hidden />
            </Link>
            {format && (
              <span className="team-hero-chip" title={`Formato: ${format}`}>
                <Trophy size={13} aria-hidden className="shrink-0" />
                <span className="sr-only">Formato: </span>
                <span className="min-w-0 truncate">{format}</span>
              </span>
            )}
            <span className="team-hero-chip">
              <PawPrint size={13} aria-hidden className="shrink-0" />
              {builds.length} Pokémon
              <span className="sr-only"> en el equipo</span>
            </span>
            {!team.is_public && (
              <span className="team-hero-chip" title="Sólo lo ves tú">
                <Lock size={12} aria-hidden className="shrink-0" />
                Privado
              </span>
            )}
          </div>

          <h1
            id={titleId}
            className="mt-3 text-balance text-[1.75rem] font-extrabold leading-[1.1] tracking-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-[2.5rem]"
          >
            {team.name}
          </h1>

          <div className="mt-3 flex min-w-0 items-center gap-2.5">
            {/* Duplica el enlace del nombre: fuera del orden de tabulación y del árbol accesible. */}
            <Link href={profileHref} tabIndex={-1} aria-hidden className="pressable shrink-0 rounded-full">
              <Avatar
                src={team.author.avatar_url}
                name={team.author.username}
                size={40}
                className="ring-2 ring-white/60"
              />
            </Link>
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate">
                <span className="sr-only">Creado por </span>
                <Link
                  href={profileHref}
                  className="rounded-sm font-bold underline-offset-4 hover:underline"
                >
                  {showDisplayName ? displayName : `@${team.author.username}`}
                </Link>
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px]">
                {showDisplayName && (
                  <>
                    <span className="truncate">@{team.author.username}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <time dateTime={team.created_at} title={fullDate.format(new Date(team.created_at))} className="shrink-0">
                  {timeAgo(team.created_at)}
                </time>
              </p>
            </div>
          </div>
        </div>

        {hasLineup && <TeamLineup builds={builds} className="mt-4 sm:mt-5 lg:mt-0" />}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        {description ? (
          <TeamDescription text={description} />
        ) : (
          isOwner && (
            <p className="text-sm text-muted">
              Aún no tiene descripción.{' '}
              <Link
                href={`/team/${team.id}/edit`}
                className="font-semibold text-brand underline-offset-4 hover:underline"
              >
                Cuenta cómo se juega
              </Link>
            </p>
          )
        )}

        <div
          className={clsx(
            'flex flex-wrap items-center gap-2',
            (description || isOwner) && 'border-t border-line pt-4',
          )}
        >
          <LikeButton teamId={team.id} liked={liked} count={team.like_count} />
          <a
            href="#comentarios"
            aria-label={`Ir a los comentarios (${commentCount})`}
            title="Comentarios"
            className="btn btn-soft gap-2 px-4"
          >
            <MessageCircle size={17} aria-hidden />
            <span className="tabular-nums">{commentCount}</span>
          </a>
          <ShareButton path={`/team/${team.id}`} title={team.name} />

          {isOwner && (
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/team/${team.id}/edit`}
                title="Editar equipo"
                className="btn btn-soft max-sm:w-11 max-sm:px-0"
              >
                <Pencil size={16} aria-hidden />
                <span className="max-sm:sr-only">Editar</span>
              </Link>
              <DeleteTeamButton
                teamId={team.id}
                teamName={team.name}
                pokemonIds={builds.map((b) => b.pokemon_id)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Los Pokémon del equipo de pie sobre la banda, cada uno flotando a su ritmo.
 * Cada uno es un atajo a su ficha (#pokemon-<hueco>), que se ilumina al llegar.
 */
function TeamLineup({ builds, className }: { builds: BuildRow[]; className?: string }) {
  return (
    <ul aria-label="Alineación: ir a la ficha de cada Pokémon" className={clsx('relative flex justify-center pb-1', className)}>
      {builds.map((build, i) => {
        const name = memberName(build)
        return (
          <li key={build.id} className="team-lineup-item" style={{ '--i': i } as React.CSSProperties}>
            <a href={`#pokemon-${build.slot}`} className="team-lineup-link">
              <span aria-hidden className="team-lineup-shadow" />
              {/* relative: sin él, la sombra (absoluta) se pintaría encima al acabar la animación. */}
              <div className="team-lineup-float relative">
                <PokemonArt pokemonId={build.pokemon_id} shiny={build.shiny} alt="" className="aspect-square w-full" />
              </div>
              <span aria-hidden className="team-lineup-flash" />
              {build.shiny && <Sparkles aria-hidden size={18} strokeWidth={2.5} className="team-lineup-shiny" />}
              <span className="team-lineup-name">
                {name}
                {build.shiny && <span className="sr-only"> (variocolor)</span>}
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** Pokéball de trazo para la marca de agua de la banda. */
function HeroWatermark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      className={className}
    >
      <circle cx="50" cy="50" r="44" />
      <path d="M6 50h29M65 50h29" />
      <circle cx="50" cy="50" r="15" />
      <circle cx="50" cy="50" r="6" fill="currentColor" stroke="none" />
    </svg>
  )
}
