import { requireProfile } from '@/lib/session'
import { listMyTeams } from '@/lib/battle/teams.server'
import { BATTLE_S_CONTAINER, BattleHero } from '@/components/battle/setup/battle-hero'
import { BattleSteps } from '@/components/battle/setup/steps'
import { BattleLinkForm } from '@/components/battle/setup/link-form'
import { LinkHelp } from '@/components/battle/setup/link-help'
import { toTeamOption } from '@/components/battle/setup/team-option'

export const metadata = {
  title: 'Asistente de partida',
  description: 'Pega el enlace de tu combate de Pokémon Showdown y juega con consejos en directo.',
}

export default async function BattlePage({
  searchParams,
}: {
  searchParams: Promise<{ pegar?: string }>
}) {
  const [{ pegar }, { userId }] = await Promise.all([searchParams, requireProfile()])
  // Sin await: la portada sale ya y la fila de equipos llega por streaming.
  const teams = listMyTeams(userId)
    .then((list) => list.map(toTeamOption))
    .catch(() => [])

  return (
    <div className={BATTLE_S_CONTAINER}>
      <div className="battle-s-grid">
        <BattleHero className="battle-s-area-hero stagger-item" />
        <BattleSteps className="battle-s-area-steps" />
        <div className="battle-s-area-form stagger-item" style={{ '--i': 2 } as React.CSSProperties}>
          <BattleLinkForm teams={teams} autoFocus={pegar !== undefined} />
        </div>
        <LinkHelp className="battle-s-area-help" />
      </div>
    </div>
  )
}
