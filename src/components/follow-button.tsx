'use client'

import { useOptimistic, useTransition } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { toggleFollow } from '@/app/actions/social'

export function FollowButton({
  targetId,
  following,
  size = 'sm',
}: {
  targetId: string
  following: boolean
  size?: 'sm' | 'md'
}) {
  const [, startTransition] = useTransition()
  const [state, setState] = useOptimistic(following, (_p, n: boolean) => n)

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          setState(!state)
          await toggleFollow(targetId, state)
        })
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition active:translate-y-0.5 ${
        size === 'sm' ? 'min-h-9 px-3.5 py-2 text-xs sm:min-h-0 sm:py-1' : 'min-h-11 px-4 py-2.5 text-sm'
      } ${
        state
          ? 'border border-line bg-surface-2 text-muted hover:text-ink'
          : 'bg-brand text-brand-fg shadow-card hover:bg-brand-strong'
      }`}
    >
      {state ? <Check size={14} /> : <UserPlus size={14} />}
      {state ? 'Siguiendo' : 'Seguir'}
    </button>
  )
}
