import { createClient } from '@/lib/supabase/server'
import type { BuildRow } from '@/lib/database.types'

/*
 * Equipos de PokeHub para el asistente de partida. Sólo en el servidor: usa
 * la sesión de la petición y la RLS decide qué se puede leer.
 */

export type BattleTeam = {
  id: string
  name: string
  format: string
  builds: BuildRow[]
}

/** Un equipo concreto (tuyo o público de otro entrenador). */
export async function getBattleTeam(teamId: string | null | undefined): Promise<BattleTeam | null> {
  if (!teamId || !/^[0-9a-f-]{36}$/i.test(teamId)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('teams')
    .select('id, name, format, builds(*)')
    .eq('id', teamId)
    .maybeSingle()
  if (!data) return null
  const team = data as unknown as BattleTeam
  return { ...team, builds: [...team.builds].sort((a, b) => a.slot - b.slot) }
}

/** Tus equipos, del más reciente al más antiguo, para elegir con cuál juegas. */
export async function listMyTeams(userId: string): Promise<BattleTeam[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teams')
    .select('id, name, format, builds(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  return ((data ?? []) as unknown as BattleTeam[]).map((t) => ({
    ...t,
    builds: [...t.builds].sort((a, b) => a.slot - b.slot),
  }))
}
