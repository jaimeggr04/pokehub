'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Film, RefreshCw } from 'lucide-react'
import type { BuildRow } from '@/lib/database.types'
import { formatFromId } from '@/lib/battle/formats'
import { createBattleState, type BattleState } from '@/lib/battle/live'
import { fetchReplay, replaySnapshots } from '@/lib/battle/replay'
import { EmptyState } from '@/components/ui/empty-state'
import { BattleBoard } from '@/components/battle/board/battle-board'
import { BoardSkeleton } from '@/components/battle/board/board-skeleton'
import { ReplayControls } from '@/components/battle/board/replay-controls'
import { useMySide, useMyTeam } from '@/components/battle/board/use-my-side'

/*
 * Repetición de Showdown con el asistente: se descarga en el navegador (el
 * servidor de repeticiones lo permite) y se parte en un estado por turno
 * para avanzar y retroceder. Empieza en la vista previa, como una partida.
 */

type Loaded = { formatId: string; snapshots: BattleState[] }

function stepLabel(s: BattleState) {
  if (s.phase === 'preview') return 'Vista previa'
  if (s.phase === 'ended') return 'Final'
  return `Turno ${s.turn}`
}

export function ReplayBattle({
  replayId,
  builds,
  teamName,
}: {
  replayId: string
  builds: BuildRow[] | null
  teamName?: string
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState(0)

  useEffect(() => {
    let alive = true
    fetchReplay(replayId).then((replay) => {
      if (!alive) return
      if (!replay) {
        setFailed(true)
        return
      }
      setLoaded({ formatId: replay.formatId, snapshots: replaySnapshots(replay.id, replay.log) })
      setFailed(false)
      setStep(0)
    })
    return () => {
      alive = false
    }
  }, [replayId, attempt])

  const format = useMemo(() => formatFromId(loaded?.formatId ?? replayId.split('-')[0]), [loaded, replayId])
  const snapshots = loaded?.snapshots
  const empty = useMemo(() => createBattleState(replayId), [replayId])
  const state = snapshots?.[Math.min(step, snapshots.length - 1)] ?? empty
  // El lado se deduce con el estado final: es el que más Pokémon ha revelado.
  const reference = snapshots?.[snapshots.length - 1] ?? empty
  const myTeam = useMyTeam(format, builds)
  const { mySide, choose } = useMySide(replayId, reference, myTeam)
  const labels = useMemo(() => snapshots?.map(stepLabel) ?? [], [snapshots])

  if (failed) {
    return (
      <div className="mx-auto max-w-[1100px] px-3 sm:px-4 md:pt-4">
        <EmptyState
          icon={<Film size={28} />}
          title="No encontramos esa repetición"
          description="Puede que el enlace esté mal, que la repetición sea privada o que Showdown no responda ahora mismo."
          action={
            <>
              <button
                type="button"
                onClick={() => {
                  setFailed(false)
                  setAttempt((n) => n + 1)
                }}
                className="btn btn-primary"
              >
                <RefreshCw aria-hidden size={16} />
                Reintentar
              </button>
              <Link href="/battle" className="btn btn-soft">
                Pegar otro enlace
              </Link>
            </>
          }
        />
      </div>
    )
  }

  if (!snapshots?.length) return <BoardSkeleton label="Cargando la repetición…" withDock />

  return (
    <BattleBoard
      state={state}
      format={format}
      mySide={mySide}
      onChooseSide={choose}
      myTeam={myTeam}
      teamName={teamName}
      mode="replay"
      replayControls={<ReplayControls index={Math.min(step, labels.length - 1)} labels={labels} onChange={setStep} />}
    />
  )
}
