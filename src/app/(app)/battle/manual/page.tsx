import { requireProfile } from '@/lib/session'
import { getBattleTeam, listMyTeams } from '@/lib/battle/teams.server'
import { DEFAULT_FORMAT, getFormat } from '@/lib/battle/formats'
import { ManualBattle } from '@/components/battle/setup/manual-battle'

export const metadata = {
  title: 'Modo manual · Asistente de partida',
  description: 'Prepara una partida sin enlace y juega con los consejos marcando tú lo que pasa.',
}

export default async function ManualBattlePage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; team?: string }>
}) {
  const [{ format, team }, { userId }] = await Promise.all([searchParams, requireProfile()])
  const mine = await listMyTeams(userId)
  // ?team= también puede ser un equipo público de otro entrenador.
  const extra = team && !mine.some((t) => t.id === team) ? await getBattleTeam(team) : null
  const teams = extra ? [extra, ...mine] : mine
  const teamId = team && teams.some((t) => t.id === team) ? team : null

  return (
    <ManualBattle teams={teams} formatId={getFormat(format)?.id ?? DEFAULT_FORMAT.id} teamId={teamId} />
  )
}
