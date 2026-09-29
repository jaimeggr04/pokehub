import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { parseBattleLink } from '@/lib/battle/formats'
import { getBattleTeam } from '@/lib/battle/teams.server'
import { LiveBattle } from '@/components/battle/board/live-battle'

export const metadata: Metadata = {
  title: 'Partida en directo',
  description: 'Sigue tu combate de Pokémon Showdown y recibe consejos turno a turno.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * /battle/live?room=battle-gen9…-123&team=<uuid>. La sala se valida aquí
 * para no abrir un websocket con cualquier cosa; el equipo se lee con la
 * sesión (la RLS decide si puedes verlo) y viaja al cliente tal cual.
 */
export default async function LiveBattlePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const room = parseBattleLink(first(params.room) ?? '')
  if (!room) redirect('/battle')

  const team = await getBattleTeam(first(params.team))

  return (
    <LiveBattle
      // Otra sala es otra partida: se monta de cero (conexión, ficha abierta, lado elegido…).
      key={room.roomId}
      roomId={room.roomId}
      formatId={room.formatId}
      builds={team?.builds ?? null}
      teamName={team?.name}
    />
  )
}
