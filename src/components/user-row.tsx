import Link from 'next/link'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { FollowButton } from '@/components/follow-button'
import { Highlight } from '@/components/search/highlight'

export interface UserRowData {
  id: string
  username: string
  display_name: string | null
  bio: string
  avatar_url: string | null
  /** Sólo en resultados de búsqueda (RPC search_profiles). */
  team_count?: number
  /** Sólo en sugerencias (RPC suggested_users). */
  follower_count?: number
}

export function UserRow({
  user,
  following,
  showFollow = true,
  meId,
  highlight,
  meta,
  index,
}: {
  user: UserRowData
  following?: boolean
  showFollow?: boolean
  meId?: string
  /** Término de búsqueda que se marca en el nombre y en el usuario. */
  highlight?: string
  /** Dato breve delante de la bio: «3 equipos», «12 seguidores»… */
  meta?: React.ReactNode
  /** Posición en la lista: con ella la fila entra escalonada. */
  index?: number
}) {
  const displayName = user.display_name?.trim()
  const showDisplayName = !!displayName && displayName.toLowerCase() !== user.username.toLowerCase()
  const isMe = user.id === meId
  const mark = (text: string) => (highlight ? <Highlight text={text} term={highlight} /> : text)

  return (
    <li
      style={index === undefined ? undefined : ({ '--i': index } as React.CSSProperties)}
      className={clsx(
        'profile-row group/row flex items-center gap-3 rounded-xl bg-surface-2 py-2 pl-2.5 pr-2.5 shadow-card sm:pr-3',
        index !== undefined && 'stagger-item',
      )}
    >
      <Link
        href={`/u/${user.username}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 outline-offset-4"
      >
        <span className="profile-row-avatar relative shrink-0 rounded-full">
          <Avatar src={user.avatar_url} name={user.username} size={40} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-bold leading-tight transition-colors duration-(--dur) group-hover/row:text-brand">
              {showDisplayName ? mark(displayName) : <>@{mark(user.username)}</>}
            </span>
            {showDisplayName && (
              <span className="min-w-0 shrink truncate text-xs text-muted">@{mark(user.username)}</span>
            )}
          </span>
          <span className="mt-0.5 flex min-w-0 items-baseline gap-1 text-xs text-muted">
            {meta && (
              <>
                <span className="shrink-0 font-semibold text-ink/75">{meta}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="truncate">{user.bio || 'Entrenador de PokeHub'}</span>
          </span>
        </span>
      </Link>
      {/* Uno mismo también sale en las búsquedas: sin botón de seguir, pero reconocible. */}
      {showFollow &&
        (isMe ? (
          <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold">Tú</span>
        ) : (
          <FollowButton targetId={user.id} following={Boolean(following)} username={user.username} />
        ))}
    </li>
  )
}
