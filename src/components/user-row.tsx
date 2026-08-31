import Image from 'next/image'
import Link from 'next/link'
import { User } from 'lucide-react'
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
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 shadow-card transition hover:-translate-y-px hover:shadow-float">
      <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-line text-muted">
          {user.avatar_url ? (
            <Image src={user.avatar_url} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
          ) : (
            <User size={18} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">@{user.username}</span>
          <span className="block truncate text-xs text-muted">{user.bio || 'Entrenador de PokeHub'}</span>
        </span>
      </Link>
      {showFollow && user.id !== meId && (
        <FollowButton targetId={user.id} following={Boolean(following)} />
      )}
    </li>
  )
}
