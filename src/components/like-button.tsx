'use client'

import { useOptimistic, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toggleLike } from '@/app/actions/social'

export function LikeButton({
  teamId,
  liked,
  count,
}: {
  teamId: string
  liked: boolean
  count: number
}) {
  const [, startTransition] = useTransition()
  const [state, setState] = useOptimistic({ liked, count }, (_p, n: { liked: boolean; count: number }) => n)

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) })
          await toggleLike(teamId, state.liked)
        })
      }
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-card transition active:translate-y-0.5 ${
        state.liked ? 'bg-brand text-brand-fg' : 'bg-surface-2 hover:bg-line'
      }`}
    >
      <Heart size={16} fill={state.liked ? 'currentColor' : 'none'} />
      <span className="tabular-nums">{state.count}</span>
    </button>
  )
}
