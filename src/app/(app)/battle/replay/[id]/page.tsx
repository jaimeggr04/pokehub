import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { parseReplayLink } from '@/lib/battle/replay'
import { getBattleTeam } from '@/lib/battle/teams.server'
import { ReplayBattle } from '@/components/battle/board/replay-battle'

export const metadata: Metadata = {
  title: 'Repetición con el asistente',
  description: 'Repasa una partida de Pokémon Showdown turno a turno con los consejos del asistente.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * /battle/replay/<id>?team=<uuid>. La repetición se descarga en el navegador
 * (replay.pokemonshowdown.com lo permite); aquí sólo se valida el id y se
 * carga tu equipo, si lo hay.
 */
export default async function ReplayBattlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const replayId = parseReplayLink(decodeURIComponent(id))
  if (!replayId) redirect('/battle')

  const team = await getBattleTeam(first(query.team))

  return <ReplayBattle key={replayId} replayId={replayId} builds={team?.builds ?? null} teamName={team?.name} />
}
