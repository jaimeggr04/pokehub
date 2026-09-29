'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calculator, ChevronDown, Gauge, Lightbulb, RefreshCw, Swords, Users } from 'lucide-react'
import {
  previewPlan, speedInsights, turnTips,
  type MonProfile, type TurnContext,
} from '@/lib/battle/advice'
import type { FieldState, MonSet, SideConditions } from '@/lib/battle/calc'
import type { BattleFormat } from '@/lib/battle/formats'
import { activeMons as activeOf, foe, type BattleState, type SideId } from '@/lib/battle/live'
import { forget, nextTurn, reveal, setActive, setHp } from '@/lib/battle/manual'
import { useBattleProfiles, useUsage } from '@/lib/battle/use-battle-profiles'
import type { ConnectionStatus } from '@/lib/battle/use-showdown-battle'
import { MonDetailSheet } from '@/components/battle/detail/mon-detail-sheet'
import { CalcSheet } from '@/components/battle/detail/calc-sheet'
import { SpeedPanel } from '@/components/battle/detail/speed-panel'
import { TeamRoster } from '@/components/battle/detail/team-roster'
import { EmptyState } from '@/components/ui/empty-state'
import { BoardHeader } from '@/components/battle/board/board-header'
import { BattleLog } from '@/components/battle/board/battle-log'
import { BattleResult } from '@/components/battle/board/battle-result'
import { BoardSkeleton } from '@/components/battle/board/board-skeleton'
import { FieldView } from '@/components/battle/board/field-view'
import { ManualBar } from '@/components/battle/board/manual-bar'
import { JargonHints, SectionTitle } from '@/components/battle/board/parts'
import { PreviewPanel } from '@/components/battle/board/preview-panel'
import { SidePicker } from '@/components/battle/board/side-picker'
import { TipList } from '@/components/battle/board/tip-list'

/*
 * El tablero del asistente de partida. Recibe el estado del combate (en
 * directo, de una repetición o del modo manual, que tienen la misma forma) y
 * decide qué enseñar según la fase: el plan en la vista previa, el campo y
 * los consejos durante el combate y el resultado al final.
 *
 * Todo lo que se calcula aquí sale de funciones puras de lib/battle: el
 * tablero sólo elige qué es lo importante en cada momento y lo ordena.
 */

export type BattleBoardProps = {
  state: BattleState
  format: BattleFormat
  /** null: pregunta «¿Cuál eres tú?» con los dos nombres. */
  mySide: SideId | null
  onChooseSide: (side: SideId) => void
  /** Tus sets exactos si elegiste equipo de PokeHub. */
  myTeam: MonSet[] | null
  teamName?: string
  mode: 'live' | 'replay' | 'manual'
  connection?: { status: ConnectionStatus; error: string | null; retry: () => void }
  /** Barra de turnos de la repetición. */
  replayControls?: React.ReactNode
  manual?: { setState: (update: (s: BattleState) => BattleState) => void }
}

const WEATHERS = new Set(['Sun', 'Rain', 'Sand', 'Snow', 'Harsh Sunshine', 'Heavy Rain', 'Strong Winds'])
const TERRAINS = new Set(['Electric', 'Grassy', 'Psychic', 'Misty'])

function sideConditions(state: BattleState, side: SideId): SideConditions {
  const c = state.sides[side].conditions
  return {
    reflect: c.reflect !== undefined,
    lightScreen: c.lightscreen !== undefined,
    auroraVeil: c.auroraveil !== undefined,
    tailwind: c.tailwind !== undefined,
  }
}

/** El campo visto desde quien ataca: sus condiciones son las del atacante y las del otro lado, las del defensor. */
export function fieldStateFor(state: BattleState, attacker: SideId): FieldState {
  const weather = state.field.weather && WEATHERS.has(state.field.weather) ? state.field.weather : ''
  const terrain = state.field.terrain && TERRAINS.has(state.field.terrain) ? state.field.terrain : ''
  return {
    weather: weather as FieldState['weather'],
    terrain: terrain as FieldState['terrain'],
    attackerSide: sideConditions(state, attacker),
    defenderSide: sideConditions(state, foe(attacker)),
  }
}

/** Los activos de un lado primero y después el resto de los que siguen en pie. */
function relevantProfiles(state: BattleState, side: SideId, profiles: MonProfile[], onlyActive = false) {
  const s = state.sides[side]
  const active = s.active.filter((i): i is number => i !== null && i !== undefined && !s.team[i]?.fainted)
  const rest = s.team.map((_, i) => i).filter((i) => !active.includes(i) && !s.team[i].fainted)
  const order = onlyActive && active.length ? active : [...active, ...rest]
  return order.map((i) => profiles[i]).filter((p): p is MonProfile => Boolean(p))
}

function bringCountOf(format: BattleFormat) {
  return format.gameType === 'doubles' ? 4 : format.id.includes('bss') ? 3 : 6
}

export function BattleBoard({
  state,
  format,
  mySide,
  onChooseSide,
  myTeam,
  teamName,
  mode,
  connection,
  replayControls,
  manual,
}: BattleBoardProps) {
  // Como espectador (o hasta que elijas), el jugador 1 hace de "tú".
  const me: SideId = mySide ?? 'p1'
  const them = foe(me)
  const { usage, loading: usageLoading, failed: usageFailed } = useUsage(format.id)
  const profiles = useBattleProfiles(state, format, usage, mySide, myTeam)

  // La ficha recuerda a quién enseña aunque se cierre: así la animación de
  // salida no se queda en blanco.
  const [detail, setDetail] = useState<{ side: SideId; index: number } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const openDetail = (side: SideId, index: number) => {
    setDetail({ side, index })
    setDetailOpen(true)
  }

  const hasTeams = state.sides.p1.team.length > 0 && state.sides.p2.team.length > 0

  const plan = useMemo(
    () =>
      state.phase === 'preview' && profiles[me].length && profiles[them].length
        ? previewPlan(format, usage, profiles[me], profiles[them])
        : null,
    [state.phase, format, usage, profiles, me, them],
  )

  const ctx: TurnContext = useMemo(
    () => ({ format, state, mySide: me, usage, profiles }),
    [format, state, me, usage, profiles],
  )
  const tips = useMemo(() => (state.phase === 'battle' ? turnTips(ctx) : []), [ctx, state.phase])
  const insights = useMemo(() => (state.phase === 'preview' ? [] : speedInsights(ctx)), [ctx, state.phase])

  const speedField = {
    trickRoom: state.field.trickRoom !== null,
    myTailwind: state.sides[me].conditions.tailwind !== undefined,
    theirTailwind: state.sides[them].conditions.tailwind !== undefined,
  }

  const calcButton = (
    <button type="button" onClick={() => setCalcOpen(true)} className="btn btn-soft shrink-0 px-4">
      <Calculator aria-hidden size={16} />
      Calcular
    </button>
  )

  /* ---------- Sin datos todavía ---------- */

  const failedToConnect =
    mode === 'live' &&
    connection &&
    (connection.status === 'unavailable' || (connection.status === 'closed' && connection.error)) &&
    !hasTeams

  if (failedToConnect) {
    return (
      <div className="mx-auto max-w-[1100px] px-3 sm:px-4 md:pt-4">
        <EmptyState
          icon={<Swords size={28} />}
          title="No podemos seguir este combate"
          description={connection.error ?? 'Showdown no nos deja entrar en esta sala.'}
          action={
            <>
              <button type="button" onClick={connection.retry} className="btn btn-primary">
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

  if (state.phase === 'connecting' || !hasTeams) {
    return <BoardSkeleton label="Entrando en el combate…" withDock={Boolean(replayControls)} />
  }

  /* ---------- Tablero ---------- */

  const detailProfile = detail ? (profiles[detail.side][detail.index] ?? null) : null
  const detailSide = detail?.side ?? me
  const setState = manual?.setState

  const onField = [me, them].flatMap((side) => activeOf(state.sides[side]).map((a) => a.mon))
  const fieldJargon = [
    ...(onField.some((m) => Object.values(m.boosts).some(Boolean)) ? ['boosts'] : []),
    ...(onField.some((m) => m.mega) ? ['mega'] : []),
  ]

  const bringCount = bringCountOf(format)
  const rosterTitle = (side: SideId) => {
    const team = state.sides[side].team
    const total = Math.min(bringCount, team.length)
    const fainted = team.filter((m) => m.fainted).length
    const seen = team.filter((m) => m.brought).length
    const standing = Math.max(0, total - fainted)
    const hidden = side === them && seen < total ? ` · ${total - seen} sin ver` : ''
    return `${standing} de ${total} en pie${hidden}`
  }

  const teams = (
    <section aria-labelledby="teams-heading">
      <SectionTitle id="teams-heading" icon={<Users size={16} />}>
        Equipos
      </SectionTitle>
      <div className="space-y-2">
        {([them, me] as const).map((side) => (
          <div key={side} className="card p-3">
            <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-bold">
              <span className={side === me ? 'text-brand' : 'text-danger'}>
                {side === me ? (mySide ? 'Tu equipo' : state.sides[side].name) : mySide ? 'Su equipo' : state.sides[side].name}
              </span>
              <span className="text-xs font-semibold text-muted">{rosterTitle(side)}</span>
            </h3>
            <TeamRoster
              profiles={profiles[side]}
              side={side === me ? 'mine' : 'theirs'}
              activeIndexes={state.sides[side].active.filter((i): i is number => i !== null && i !== undefined)}
              onSelect={(index) => openDetail(side, index)}
            />
          </div>
        ))}
      </div>
    </section>
  )

  const speed = (
    <details className="battle-fold card">
      <summary>
        <Gauge aria-hidden size={18} className="text-brand" />
        Velocidad: quién va antes
        {insights.length > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-fg">
            {insights.length}
            <span className="sr-only"> deducciones</span>
          </span>
        )}
        <ChevronDown aria-hidden size={18} className="battle-fold-chevron" />
      </summary>
      <div className="px-3 pb-3">
        <SpeedPanel
          format={format}
          mine={relevantProfiles(state, me, profiles[me], true)}
          theirs={relevantProfiles(state, them, profiles[them], true)}
          insights={insights}
          field={speedField}
        />
      </div>
    </details>
  )

  const log = <BattleLog log={state.log} me={me} />

  let body: React.ReactNode
  if (state.phase === 'preview' && plan) {
    body = (
      <PreviewPanel
        plan={plan}
        mine={profiles[me]}
        theirs={profiles[them]}
        me={me}
        onOpen={openDetail}
        usageLoading={usageLoading}
        usageFailed={usageFailed}
        doubles={format.gameType === 'doubles'}
        calcButton={calcButton}
        onStart={setState ? () => setState(nextTurn) : undefined}
      />
    )
  } else if (state.phase === 'ended') {
    body = (
      <div className="space-y-3">
        <BattleResult state={state} mySide={mySide} me={me} mode={mode} />
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {teams}
          <div className="space-y-3">
            {speed}
            {log}
          </div>
        </div>
      </div>
    )
  } else {
    const noActives = !state.sides[me].active.some((i) => i !== null) || !state.sides[them].active.some((i) => i !== null)
    body = (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <div className="min-w-0 space-y-3">
          {setState && <ManualBar state={state} me={me} setState={setState} />}

          <section aria-labelledby="field-heading">
            <SectionTitle id="field-heading" icon={<Swords size={16} />} aside={calcButton}>
              En el campo
            </SectionTitle>
            <FieldView
              state={state}
              me={me}
              profiles={profiles}
              onOpen={openDetail}
              names={{
                mine: mySide ? 'Tú' : state.sides[me].name || 'Jugador 1',
                theirs: mySide
                  ? state.sides[them].name && state.sides[them].name !== 'Rival'
                    ? `Rival · ${state.sides[them].name}`
                    : 'Rival'
                  : state.sides[them].name || 'Jugador 2',
              }}
              manual={
                setState && {
                  onPick: (side, slot, index) => setState((s) => setActive(s, side, slot, index)),
                }
              }
            />
            {fieldJargon.length > 0 && <JargonHints className="mt-2" keys={fieldJargon} />}
          </section>

          <section aria-labelledby="tips-heading">
            <SectionTitle
              id="tips-heading"
              icon={<Lightbulb size={16} />}
              aside={
                usageLoading ? (
                  <span role="status" className="text-xs text-muted">
                    Cargando estadísticas…
                  </span>
                ) : undefined
              }
            >
              Consejos del turno
            </SectionTitle>
            {tips.length > 0 ? (
              <TipList tips={tips} label="Consejos del turno" />
            ) : (
              <p className="card px-4 py-3 text-sm text-muted">
                {noActives
                  ? setState
                    ? 'Pon en el campo a los Pokémon de cada lado y aquí saldrán los consejos.'
                    : 'Esperando a que salgan los Pokémon…'
                  : 'Nada urgente este turno: nadie puede debilitar a nadie de un golpe.'}
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          {teams}
          {speed}
          {log}
        </div>
      </div>
    )
  }

  const reconnecting =
    mode === 'live' && connection && connection.error && state.phase !== 'ended' ? connection : null

  return (
    <div className="mx-auto max-w-[1100px] space-y-3 px-3 sm:px-4 md:pt-4">
      <BoardHeader
        state={state}
        format={format}
        me={me}
        mySide={mySide}
        mode={mode}
        connection={connection}
        teamName={teamName}
      />

      {reconnecting && (
        <div role="alert" className="flex items-center gap-3 rounded-card bg-danger-soft px-4 py-2 text-sm text-danger">
          <p className="min-w-0 flex-1">{reconnecting.error} Lo que ves puede no estar al día.</p>
          <button type="button" onClick={reconnecting.retry} className="btn btn-danger shrink-0">
            Reintentar
          </button>
        </div>
      )}

      {!mySide && mode !== 'manual' && <SidePicker state={state} onChoose={onChooseSide} />}

      {body}

      {replayControls && <div className="battle-dock">{replayControls}</div>}

      <MonDetailSheet
        open={detailOpen && detailProfile !== null}
        onClose={() => setDetailOpen(false)}
        profile={detailProfile}
        side={detailSide === me ? 'mine' : 'theirs'}
        format={format}
        opponents={relevantProfiles(state, foe(detailSide), profiles[foe(detailSide)], true)}
        field={fieldStateFor(state, detailSide)}
        manual={
          setState && detail
            ? {
                onReveal: (kind, value) => setState((s) => reveal(s, detail.side, detail.index, kind, value)),
                onForget: (move) => setState((s) => forget(s, detail.side, detail.index, move)),
                onHp: (hp) => setState((s) => setHp(s, detail.side, detail.index, hp)),
              }
            : undefined
        }
      />
      <CalcSheet
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        format={format}
        attackers={relevantProfiles(state, me, profiles[me])}
        defenders={relevantProfiles(state, them, profiles[them])}
        field={fieldStateFor(state, me)}
      />
    </div>
  )
}
