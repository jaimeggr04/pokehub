'use client'

import { useMemo } from 'react'
import type { BuildRow } from '@/lib/database.types'
import { formatFromId } from '@/lib/battle/formats'
import { useShowdownBattle } from '@/lib/battle/use-showdown-battle'
import { BattleBoard } from '@/components/battle/board/battle-board'
import { useMySide, useMyTeam } from '@/components/battle/board/use-my-side'

/** Partida en directo: se conecta a Showdown como espectador y pinta el tablero. */
export function LiveBattle({
  roomId,
  formatId,
  builds,
  teamName,
}: {
  roomId: string
  formatId: string
  builds: BuildRow[] | null
  teamName?: string
}) {
  const format = useMemo(() => formatFromId(formatId), [formatId])
  const { state, status, error, retry } = useShowdownBattle(roomId)
  const myTeam = useMyTeam(format, builds)
  const { mySide, choose } = useMySide(roomId, state, myTeam)

  return (
    <BattleBoard
      state={state}
      format={format}
      mySide={mySide}
      onChooseSide={choose}
      myTeam={myTeam}
      teamName={teamName}
      mode="live"
      connection={{ status, error, retry }}
    />
  )
}
