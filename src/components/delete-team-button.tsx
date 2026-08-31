'use client'

import { useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteTeam } from '@/app/actions/teams'

export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-red-500 shadow-card transition hover:bg-red-500 hover:text-white"
      >
        <Trash2 size={16} /> Borrar
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2 py-1.5 text-sm">
      <span className="px-1 font-semibold">¿Seguro?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await deleteTeam(teamId) })}
        className="flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1 font-semibold text-white"
      >
        {pending && <Loader2 size={14} className="animate-spin" />} Sí, borrar
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1 font-semibold text-muted"
      >
        No
      </button>
    </span>
  )
}
