'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Hand, History, PencilLine, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { BattleBoard } from '@/components/battle/board/battle-board'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { Skeleton } from '@/components/ui/skeleton'
import { TeamPicker } from '@/components/battle/setup/team-picker'
import { SpeciesSlots, TEAM_SIZE, emptySlots, toSlots, useSpeciesOptions } from '@/components/battle/setup/species-slots'
import { toTeamOption } from '@/components/battle/setup/team-option'
import { manualHref } from '@/components/battle/setup/link'
import { DEFAULT_FORMAT, FORMATS, getFormat, type BattleFormat } from '@/lib/battle/formats'
import { setFromBuild, type MonSet } from '@/lib/battle/calc'
import { createManualState } from '@/lib/battle/manual'
import { useUsage } from '@/lib/battle/use-battle-profiles'
import type { BattleState } from '@/lib/battle/live'
import type { BattleTeam } from '@/lib/battle/teams.server'

/*
 * Modo manual del asistente: se prepara la partida (formato, tu equipo y los
 * seis del rival) y luego se juega en el mismo tablero que en directo, pero
 * marcando tú lo que pasa. Todo se guarda en sessionStorage: recargar o
 * bloquear el móvil a mitad de partida no la pierde.
 */

const STORAGE_KEY = 'pokehub-battle-manual'

type Game = {
  v: 1
  formatId: string
  teamId: string | null
  /** Tus especies tal como se eligieron (del equipo o a mano). */
  mine: string[]
  theirs: string[]
  state: BattleState
}

function readGame(): Game | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const game = JSON.parse(raw) as Partial<Game>
    const valid =
      game?.v === 1 &&
      typeof game.formatId === 'string' &&
      Array.isArray(game.mine) &&
      Array.isArray(game.theirs) &&
      Boolean(game.state?.sides?.p1 && game.state.sides.p2)
    return valid ? (game as Game) : null
  } catch {
    return null
  }
}

function writeGame(game: Game) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(game))
  } catch {
    // Sin almacenamiento: la partida sigue, sólo que no sobrevive a una recarga.
  }
}

/** Sets de la calculadora de un equipo de PokeHub; los que no existen en el formato se quedan fuera. */
function teamSets(team: BattleTeam | null, format: BattleFormat): MonSet[] | null {
  if (!team) return null
  return team.builds.map((b) => setFromBuild(format, b)).filter((s): s is MonSet => s !== null)
}

export function ManualBattle({
  teams,
  formatId,
  teamId,
}: {
  teams: BattleTeam[]
  /** Ya validado en el servidor. */
  formatId: string
  teamId: string | null
}) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [game, setGame] = useState<Game | null>(null)
  /** Partida guardada que no se está jugando: se ofrece retomarla. */
  const [saved, setSaved] = useState<Game | null>(null)
  /** Al volver del tablero, la preparación sale con lo que había. */
  const [draft, setDraft] = useState<Game | null>(null)

  // sessionStorage sólo existe en el navegador: se mira al hidratar.
  useEffect(() => {
    const stored = readGame()
    if (stored && stored.formatId === formatId && stored.teamId === teamId) setGame(stored)
    else setSaved(stored)
    setChecked(true)
  }, [formatId, teamId])

  function play(next: Game) {
    writeGame(next)
    setGame(next)
    setSaved(null)
    // La URL refleja la partida: al recargar, se retoma sin preguntar.
    router.replace(manualHref(next.formatId, next.teamId), { scroll: false })
    window.scrollTo({ top: 0 })
  }

  if (!checked) return <ManualSkeleton />

  if (game) {
    return (
      <ManualBoard
        key={`${game.formatId}-${game.teamId}-${game.state.roomId}`}
        game={game}
        team={teams.find((t) => t.id === game.teamId) ?? null}
        onEdit={(current) => {
          setSaved(current)
          setDraft(current)
          setGame(null)
          window.scrollTo({ top: 0 })
        }}
      />
    )
  }

  return (
    <ManualSetup
      teams={teams}
      initial={draft ?? { formatId, teamId, mine: [], theirs: [] }}
      resume={saved}
      onResume={() => saved && play(saved)}
      onStart={play}
    />
  )
}

/* ------------------------------------------------------------------ */

function ManualSetup({
  teams,
  initial,
  resume,
  onResume,
  onStart,
}: {
  teams: BattleTeam[]
  initial: Pick<Game, 'formatId' | 'teamId' | 'mine' | 'theirs'>
  resume: Game | null
  onResume: () => void
  onStart: (game: Game) => void
}) {
  const uid = useId()
  const [formatId, setFormatId] = useState(initial.formatId)
  const [teamId, setTeamId] = useState<string | null>(
    teams.some((t) => t.id === initial.teamId) ? initial.teamId : null,
  )
  const [mine, setMine] = useState(() =>
    initial.teamId && teams.some((t) => t.id === initial.teamId) ? emptySlots() : toSlots(initial.mine),
  )
  const [theirs, setTheirs] = useState(() => toSlots(initial.theirs))

  const format = getFormat(formatId) ?? DEFAULT_FORMAT
  const { usage, loading, failed } = useUsage(format.id)
  const { options, byId } = useSpeciesOptions(format, usage)
  const teamOptions = useMemo(() => teams.map(toTeamOption), [teams])

  const team = teams.find((t) => t.id === teamId) ?? null
  const sets = useMemo(() => teamSets(team, format), [team, format])
  const mySpecies = sets ? sets.map((s) => s.species) : mine.filter(Boolean)
  const theirSpecies = theirs.filter(Boolean)
  const dropped = team && sets ? team.builds.length - sets.length : 0
  const ready = mySpecies.length > 0 && theirSpecies.length > 0

  function start() {
    if (!ready) return
    onStart({
      v: 1,
      formatId: format.id,
      teamId,
      mine: mySpecies,
      theirs: theirSpecies,
      state: createManualState({ gameType: format.gameType, mySpecies, theirSpecies }),
    })
  }

  const ids = { format: `${uid}-format`, team: `${uid}-team`, rival: `${uid}-rival` }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 md:pt-4">
      <Link href="/battle" className="btn btn-ghost btn-sm -ml-3 text-muted hover:text-ink">
        <ArrowLeft aria-hidden size={16} />
        Asistente
      </Link>

      <header className="battle-s-hero mt-1">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <Hand size={13} strokeWidth={2.75} aria-hidden className="text-brand" />
          Modo manual
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          Prepara la <span className="text-gradient-brand">partida</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Para combates privados o sin enlace: tú marcas lo que ves y el asistente hace el resto.
        </p>
      </header>

      {resume && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 p-3 pl-4 animate-fade-in">
          <History aria-hidden size={18} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Tienes una partida a medias</span>
            <span className="block text-xs text-muted">
              Turno {resume.state.turn} · contra {resume.theirs.slice(0, 3).join(', ')}
              {resume.theirs.length > 3 ? '…' : ''}
            </span>
          </p>
          <button type="button" onClick={onResume} className="btn btn-soft">
            Seguirla
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4">
        {/* 1. Formato */}
        <section aria-labelledby={ids.format} className="card p-4 stagger-item" style={{ '--i': 1 } as React.CSSProperties}>
          <StepTitle id={ids.format} n={1}>
            Formato
          </StepTitle>
          <div role="radiogroup" aria-labelledby={ids.format} className="battle-s-chips mt-3">
            {FORMATS.map((f) => (
              <label key={f.id} className="battle-s-chip" title={f.label}>
                <input
                  type="radio"
                  name={`${uid}-format`}
                  value={f.id}
                  checked={f.id === format.id}
                  onChange={() => setFormatId(f.id)}
                  className="sr-only"
                />
                {f.short}
                <span className="text-xs font-medium text-muted">
                  {f.gameType === 'doubles' ? 'dobles' : 'individual'}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* 2. Tu equipo */}
        <section aria-labelledby={ids.team} className="card p-4 stagger-item" style={{ '--i': 2 } as React.CSSProperties}>
          <StepTitle id={ids.team} n={2}>
            Tu equipo
          </StepTitle>
          <div className="mt-2">
            <TeamPicker
              teams={teamOptions}
              value={teamId}
              onChange={setTeamId}
              labelledBy={ids.team}
              noneLabel="Elegir a mano"
              noneHint="Seis especies sueltas"
            />
          </div>

          {team && sets ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ul aria-label={`Pokémon de ${team.name}`} className="flex flex-wrap">
                {sets.map((s) => (
                  <li key={s.species} title={s.species}>
                    <ShowdownSprite species={s.species} size={48} />
                    <span className="sr-only">{s.species}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setMine(toSlots(sets.map((s) => s.species)))
                  setTeamId(null)
                }}
                className="btn btn-ghost btn-sm text-muted hover:text-ink"
              >
                <PencilLine aria-hidden size={15} />
                Cambiar a mano
              </button>
              {dropped > 0 && (
                <p className="flex w-full items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle aria-hidden size={14} className="mt-px shrink-0" />
                  {dropped === 1
                    ? '1 Pokémon de tu equipo no existe en este formato y se queda fuera.'
                    : `${dropped} Pokémon de tu equipo no existen en este formato y se quedan fuera.`}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <SpeciesSlots side="mine" value={mine} onChange={setMine} options={options} byId={byId} loading={loading} />
            </div>
          )}
        </section>

        {/* 3. Rival */}
        <section aria-labelledby={ids.rival} className="card p-4 stagger-item" style={{ '--i': 3 } as React.CSSProperties}>
          <StepTitle id={ids.rival} n={3}>
            Equipo rival
          </StepTitle>
          <p className="mt-1 text-xs text-muted">
            Los seis de la vista previa.{' '}
            {failed
              ? 'Sin estadísticas de uso ahora mismo: van por orden alfabético.'
              : `Salen primero los más usados en ${format.short}.`}
          </p>
          <div className="mt-3">
            <SpeciesSlots side="theirs" value={theirs} onChange={setTheirs} options={options} byId={byId} loading={loading} />
          </div>
        </section>
      </div>

      {/* Siempre a mano, también en móvil, por encima de la barra inferior. */}
      <div className="sticky bottom-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom)+0.75rem)] z-10 mt-4 md:bottom-4">
        <div className="glass flex items-center gap-3 rounded-full border border-line p-1.5 pl-4 shadow-float">
          <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite">
            <span className={clsx('font-semibold', mySpecies.length ? 'text-ink' : undefined)}>
              Tú {mySpecies.length}/{TEAM_SIZE}
            </span>
            {' · '}
            <span className={clsx('font-semibold', theirSpecies.length ? 'text-ink' : undefined)}>
              Rival {theirSpecies.length}/{TEAM_SIZE}
            </span>
            {!ready && <span className="block truncate">Elige al menos uno por lado</span>}
          </p>
          <button type="button" onClick={start} disabled={!ready} className="btn btn-primary">
            Empezar
            <ArrowRight aria-hidden size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

function StepTitle({ id, n, children }: { id: string; n: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-base font-bold">
      <span aria-hidden className="grid size-6 place-items-center rounded-full bg-brand text-xs font-extrabold text-brand-fg">
        {n}
      </span>
      {children}
    </h2>
  )
}

/* ------------------------------------------------------------------ */

function ManualBoard({
  game,
  team,
  onEdit,
}: {
  game: Game
  team: BattleTeam | null
  onEdit: (current: Game) => void
}) {
  const format = getFormat(game.formatId) ?? DEFAULT_FORMAT
  const [state, setState] = useState<BattleState>(game.state)
  const myTeam = useMemo(() => teamSets(team, format), [team, format])

  useEffect(() => {
    writeGame({ ...game, state })
  }, [game, state])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/battle" className="btn btn-ghost btn-sm -ml-3 text-muted hover:text-ink">
          <ArrowLeft aria-hidden size={16} />
          Asistente
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold">
          Modo manual <span className="font-medium text-muted">· {format.short}</span>
        </h1>
        <button
          type="button"
          onClick={() => onEdit({ ...game, state })}
          className="btn btn-soft btn-sm"
        >
          <RotateCcw aria-hidden size={15} />
          Cambiar equipos
        </button>
      </div>

      <BattleBoard
        state={state}
        format={format}
        mySide="p1"
        onChooseSide={() => {}}
        myTeam={myTeam}
        teamName={team?.name}
        mode="manual"
        manual={{ setState }}
      />
    </div>
  )
}

export function ManualSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        Preparando el modo manual…
      </p>
      <div aria-hidden>
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="mt-3 h-3 w-28 rounded-md" />
        <Skeleton className="mt-2 h-8 w-60 rounded-md" />
        <Skeleton className="mt-2 h-4 w-full max-w-md rounded-md" />
        <div className="mt-5 grid grid-cols-1 gap-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    </div>
  )
}
