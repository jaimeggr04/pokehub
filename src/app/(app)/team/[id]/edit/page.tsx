import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { TeamBuilder } from '@/components/team-builder'
import type { BuildRow, TeamRow } from '@/lib/database.types'

export const metadata = { title: 'Editar equipo' }

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await requireProfile()
  const supabase = await createClient()

  const [{ data: team }, { data: builds }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', id).maybeSingle(),
    supabase.from('builds').select('*').eq('team_id', id).order('slot'),
  ])

  if (!team) notFound()
  if ((team as TeamRow).user_id !== userId) redirect(`/team/${id}`)

  return <TeamBuilder team={team as TeamRow} builds={(builds ?? []) as BuildRow[]} />
}
