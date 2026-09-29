import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { FollowButton } from '@/components/follow-button'

export interface UserRowData {
  id: string
  username: string
  display_name: string | null
  bio: string
  avatar_url: string | null
}

export function UserRow({
  user,
  following,
  showFollow = true,
  meId,
}: {
  user: UserRowData
  following?: boolean
  showFollow?: boolean
  meId?: string
}) {
  const displayName = user.display_name?.trim()
  const showDisplayName = !!displayName && displayName.toLowerCase() !== user.username.toLowerCase()

  return (
    <li className="profile-row group/row flex items-center gap-3 rounded-xl bg-surface-2 py-2 pl-2.5 pr-2.5 shadow-card sm:pr-3">
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
              {showDisplayName ? displayName : `@${user.username}`}
            </span>
            {showDisplayName && (
              <span className="min-w-0 shrink truncate text-xs text-muted">@{user.username}</span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">{user.bio || 'Entrenador de PokeHub'}</span>
        </span>
      </Link>
      {showFollow && user.id !== meId && (
        <FollowButton targetId={user.id} following={Boolean(following)} username={user.username} />
      )}
    </li>
  )
}
