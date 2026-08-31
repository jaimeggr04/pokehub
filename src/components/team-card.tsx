'use client'

import { useOptimistic, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle } from 'lucide-react'
import { ShareButton } from '@/components/share-button'
import { useSelectedPokemon } from '@/components/selected-pokemon'
import { toggleLike } from '@/app/actions/social'
import { prettify, spriteUrl } from '@/lib/pokemon'
import { compactNumber, timeAgo } from '@/lib/format'
import type { TeamWithAuthor } from '@/lib/database.types'

export function TeamCard({ team }: { team: TeamWithAuthor }) {
  const { select, build: selected } = useSelectedPokemon()
  const [, startTransition] = useTransition()

  const [likeState, setLikeState] = useOptimistic(
    { liked: Boolean(team.liked_by_me), count: team.like_count },
    (_state, next: { liked: boolean; count: number }) => next,
  )

  function onLike() {
    startTransition(async () => {
      const next = {
        liked: !likeState.liked,
        count: likeState.count + (likeState.liked ? -1 : 1),
      }
      setLikeState(next)
      await toggleLike(team.id, likeState.liked)
    })
  }

  const slots = [...team.builds].sort((a, b) => a.slot - b.slot)

  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-card transition hover:shadow-float">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight">{team.name}</h2>
          <p className="text-xs text-muted">
            {team.format} · {timeAgo(team.created_at)}
          </p>
        </div>
        <Link
          href={`/u/${team.author.username}`}
          className="flex shrink-0 items-center gap-2 text-sm font-semibold hover:text-brand"
        >
          <span className="hidden sm:inline">@{team.author.username}</span>
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-surface-2 text-xs font-bold uppercase">
            {team.author.avatar_url ? (
              <Image src={team.author.avatar_url} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" />
            ) : (
              team.author.username.slice(0, 2)
            )}
          </span>
        </Link>
      </header>

      <ul className="mb-4 grid grid-cols-6 gap-1.5 sm:gap-2">
        {slots.map((b) => {
          const active = selected?.id === b.id
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => select(b, team.name)}
                aria-pressed={active}
                title={prettify(b.pokemon_name)}
                className={`grid aspect-square w-full place-items-center rounded-xl bg-surface-2 shadow-card transition ${
                  active
                    ? 'translate-y-[3px] bg-brand/15 shadow-pressed'
                    : 'hover:bg-brand/10 hover:shadow-float'
                }`}
              >
                <Image
                  src={spriteUrl(b.pokemon_id, b.shiny)}
                  alt={b.pokemon_name}
                  width={72}
                  height={72}
                  unoptimized
                  className="h-full w-full [image-rendering:pixelated] object-contain p-0.5"
                />
              </button>
            </li>
          )
        })}
      </ul>

      <footer className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-surface-2 px-1 py-1 shadow-card">
          <IconStat
            onClick={onLike}
            active={likeState.liked}
            activeClass="text-brand"
            label={likeState.liked ? 'Quitar me gusta' : 'Me gusta'}
            icon={<Heart size={17} fill={likeState.liked ? 'currentColor' : 'none'} />}
            value={likeState.count}
          />
          <Link
            href={`/team/${team.id}#comentarios`}
            aria-label="Comentarios"
            className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:text-blue-500 sm:min-h-0 sm:px-2.5 sm:py-1"
          >
            <MessageCircle size={17} />
            <span className="tabular-nums">{compactNumber(team.comment_count)}</span>
          </Link>
          <ShareButton path={`/team/${team.id}`} title={team.name} variant="icon" />
        </div>

        <Link
          href={`/team/${team.id}`}
          className="rounded-lg bg-brand px-5 py-1.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5"
        >
          Ver
        </Link>
      </footer>
    </article>
  )
}

function IconStat({
  onClick,
  icon,
  value,
  label,
  active,
  activeClass,
}: {
  onClick: () => void
  icon: React.ReactNode
  value?: number
  label: string
  active?: boolean
  activeClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // 40 px de alto en móvil: por debajo de eso el dedo falla. En escritorio
      // se compacta porque ahí se apunta con el ratón.
      className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-line/40 sm:min-h-0 sm:px-2.5 sm:py-1 ${
        active ? activeClass : ''
      }`}
    >
      {icon}
      {value !== undefined && <span className="tabular-nums">{compactNumber(value)}</span>}
    </button>
  )
}
