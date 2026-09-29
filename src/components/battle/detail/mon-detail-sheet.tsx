'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Eye, Gauge, Plus, Scale, X, Zap } from 'lucide-react'
import clsx from 'clsx'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { EntityPicker, type PickerOption } from '@/components/entity-picker'
import { ItemIcon } from '@/components/pokemon-details'
import { TYPE_COLORS } from '@/lib/pokemon'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import { bestHit, compareSpeed, statsOf, type Chance, type MonProfile, type SpeedVerdict } from '@/lib/battle/advice'
import { speedOf, type DamageResult, type FieldState } from '@/lib/battle/calc'
import { genFor, maxInvest, toID, type StatTable } from '@/lib/battle/dex'
import type { BattleFormat } from '@/lib/battle/formats'
import { bigRange, flipField, koTone, moveMeta, plainKo, showsKoLabel, typesOf } from './damage'
import {
  CATEGORY, HpBar, SectionTitle, StatusChip, Term, TypeChip, hpOf, itemSlug, jargonForLabel, pctText,
} from './shared'

/*
 * Ficha de un Pokémon en mitad de la partida. Lo primero que se ve es lo que
 * decide el turno (cuánto pega y quién va antes contra cada rival); debajo,
 * sus ataques, objeto, habilidad y estadísticas, separando lo confirmado de lo
 * que se estima con las estadísticas de uso.
 */

type Manual = {
  onReveal: (kind: 'move' | 'item' | 'ability', value: string) => void
  onForget: (move: string) => void
  onHp: (hp: number) => void
}

export function MonDetailSheet({
  open,
  onClose,
  profile,
  side,
  format,
  opponents,
  field,
  manual,
}: {
  open: boolean
  onClose: () => void
  profile: MonProfile | null
  side: 'mine' | 'theirs'
  format: BattleFormat
  opponents: MonProfile[]
  /** Campo con el lado de este Pokémon como atacante. */
  field?: FieldState
  manual?: Manual
}) {
  // Se conserva el último perfil para que la hoja no se vacíe mientras se cierra.
  const [shown, setShown] = useState(profile)
  if (profile && profile !== shown) setShown(profile)
  const p = profile ?? shown

  return (
    <BottomSheet open={open && Boolean(p)} onClose={onClose} title={p ? `Ficha de ${p.species}` : 'Ficha'}>
      {p && <MonDetail profile={p} side={side} format={format} opponents={opponents} field={field} manual={manual} />}
    </BottomSheet>
  )
}

function MonDetail({
  profile,
  side,
  format,
  opponents,
  field,
  manual,
}: {
  profile: MonProfile
  side: 'mine' | 'theirs'
  format: BattleFormat
  opponents: MonProfile[]
  field?: FieldState
  manual?: Manual
}) {
  const state = profile.state
  const hp = hpOf(profile)
  const types = typesOf(format, profile.species)
  const theirs = side === 'theirs'
  const boosts = Object.entries(state?.boosts ?? {}).filter(([, v]) => v)

  return (
    <div className="pb-2">
      {/* Cabecera: quién es y cómo está */}
      <header className="flex items-center gap-3">
        <div className="battle-d-sprite-well size-20">
          <ShowdownSprite species={profile.species} size={72} flip={theirs} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            <span className={theirs ? 'battle-d-foe' : 'text-brand'}>{theirs ? 'Rival' : 'Tu Pokémon'}</span>
            {state?.mega && ' · Megaevolucionado'}
          </p>
          <p className="truncate text-xl font-extrabold leading-tight">{profile.species}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {types.map((t) => (
              <TypeChip key={t} type={t} />
            ))}
            <StatusChip status={state?.status} />
            {boosts.map(([stat, v]) => (
              <span key={stat} className={clsx('battle-d-chip', v > 0 ? 'battle-d-chip--good' : 'battle-d-chip--bad')}>
                {v > 0 ? `+${v}` : `−${-v}`} {STAT_SHORT[stat as keyof StatTable] ?? stat}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <HpBar hp={hp} className="flex-1" label={`Vida de ${profile.species}`} />
            <span className="w-14 text-right text-sm font-bold tabular-nums">
              {state?.fainted ? 'KO' : state?.hp === null && theirs ? '—' : `${Math.round(hp)} %`}
            </span>
          </div>
        </div>
      </header>

      {manual && <HpControl hp={hp} species={profile.species} onHp={manual.onHp} />}

      <Matchups profile={profile} side={side} format={format} opponents={opponents} field={field} />
      <Moves profile={profile} side={side} format={format} manual={manual} />
      <ItemAbility profile={profile} side={side} format={format} manual={manual} />
      <Stats profile={profile} side={side} format={format} />
    </div>
  )
}

const STAT_SHORT: Record<keyof StatTable, string> = { hp: 'PS', atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DfE', spe: 'Vel' }
const STAT_LONG: Record<keyof StatTable, string> = {
  hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'Ataque Especial', spd: 'Defensa Especial', spe: 'Velocidad',
}

/* ------------------------------------------------------------------ */
/* Vida (modo manual)                                                   */
/* ------------------------------------------------------------------ */

function HpControl({ hp, species, onHp }: { hp: number; species: string; onHp: (hp: number) => void }) {
  const [draft, setDraft] = useState(Math.round(hp))
  useEffect(() => setDraft(Math.round(hp)), [hp])
  const commit = (v: number) => {
    if (v !== Math.round(hp)) onHp(v)
  }

  return (
    <section aria-labelledby="battle-d-hp-title" className="battle-d-panel mt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="battle-d-hp-title" className="text-sm font-bold">
          Ajustar vida
        </h3>
        <span className="text-lg font-extrabold tabular-nums">{draft} %</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={draft}
        aria-label={`Vida de ${species} en %`}
        aria-valuetext={`${draft} %`}
        className="battle-d-range mt-2"
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={(e) => commit(Number(e.currentTarget.value))}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
        onBlur={(e) => commit(Number(e.currentTarget.value))}
      />
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[100, 75, 50, 25, 0].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={draft === v}
            className={clsx('battle-d-toggle justify-center', v === 0 && 'text-danger')}
            onClick={() => {
              setDraft(v)
              commit(v)
            }}
          >
            {v === 0 ? 'KO' : `${v} %`}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Contra los Pokémon del otro lado                                     */
/* ------------------------------------------------------------------ */

type Row = {
  opp: MonProfile
  out: DamageResult | null
  inc: DamageResult | null
  /** Quién va antes, visto desde el Pokémon de la ficha. */
  order: 'first' | 'second' | 'tie' | 'depends'
  speed: SpeedVerdict
}

function Matchups({
  profile,
  side,
  format,
  opponents,
  field,
}: {
  profile: MonProfile
  side: 'mine' | 'theirs'
  format: BattleFormat
  opponents: MonProfile[]
  field?: FieldState
}) {
  const rows = useMemo<Row[]>(() => {
    const ownTw = Boolean(field?.attackerSide?.tailwind)
    const oppTw = Boolean(field?.defenderSide?.tailwind)
    return opponents
      .filter((o) => !o.state?.fainted)
      .map((opp) => {
        const speed =
          side === 'mine'
            ? compareSpeed(format, profile, opp, { trickRoom: false, myTailwind: ownTw, theirTailwind: oppTw })
            : compareSpeed(format, opp, profile, { trickRoom: false, myTailwind: oppTw, theirTailwind: ownTw })
        const mineFirst = speed.result === 'you'
        const order: Row['order'] =
          speed.result === 'tie' ? 'tie' : speed.result === 'depends' ? 'depends' : (mineFirst === (side === 'mine')) ? 'first' : 'second'
        return {
          opp,
          out: bestHit(format, profile, opp, field),
          inc: bestHit(format, opp, profile, flipField(field)),
          order,
          speed,
        }
      })
  }, [profile, side, format, opponents, field])

  const title = side === 'theirs' ? 'Contra tus Pokémon' : 'Contra los del rival'
  if (!rows.length) return null

  return (
    <section aria-labelledby="battle-d-vs-title" className="mt-6">
      <SectionTitle id="battle-d-vs-title" hint="Mejor golpe de cada lado">
        {title}
      </SectionTitle>
      <ul className="grid gap-2">
        {rows.map((r, i) => (
          <MatchupRow key={`${r.opp.species}-${i}`} row={r} profile={profile} side={side} index={i} />
        ))}
      </ul>
    </section>
  )
}

const ORDER_TEXT: Record<Row['order'], string> = {
  first: 'Va antes',
  second: 'Va después',
  tie: 'Empate',
  depends: 'Depende',
}

function MatchupRow({ row, profile, side, index }: { row: Row; profile: MonProfile; side: 'mine' | 'theirs'; index: number }) {
  const { opp, out, inc, order, speed } = row
  const oppHp = hpOf(opp)
  const myHp = hpOf(profile)
  const OrderIcon = order === 'first' ? ArrowUp : order === 'second' ? ArrowDown : Scale

  return (
    <li className="battle-d-panel stagger-item" style={{ '--i': index } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <ShowdownSprite species={opp.species} size={40} flip={side === 'mine'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{opp.species}</p>
          <HpBar hp={oppHp} thin className="mt-1 max-w-28" label={`Vida de ${opp.species}`} />
        </div>
        <span className="battle-d-order" data-order={order} title={speed.text}>
          <OrderIcon aria-hidden size={14} strokeWidth={2.6} />
          {ORDER_TEXT[order]}
        </span>
      </div>

      {out ? (
        <div className="mt-2">
          <p className="battle-d-headline" data-tone={koTone(out)}>
            Le hace <strong>{bigRange(out.minPercent, out.maxPercent)}</strong>
          </p>
          <p className="text-sm font-semibold">
            {plainKo(out, oppHp)} <span className="font-normal text-muted">con {out.move}</span>
          </p>
          {showsKoLabel(out) && (
            <p className="mt-0.5 text-xs text-muted">
              <Term term={jargonForLabel(out.label)}>{out.label}</Term>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No tiene con qué dañarlo.</p>
      )}

      {inc && (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1 text-xs text-muted">
          <span className="font-semibold text-ink">Recibe {bigRange(inc.minPercent, inc.maxPercent)}</span>
          <span>
            de {inc.move} · {plainKo(inc, myHp)}
          </span>
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted">{speed.text}</p>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Ataques                                                              */
/* ------------------------------------------------------------------ */

function Moves({
  profile,
  side,
  format,
  manual,
}: {
  profile: MonProfile
  side: 'mine' | 'theirs'
  format: BattleFormat
  manual?: Manual
}) {
  const seen = new Set((profile.state?.moves ?? []).map(toID))
  const known = profile.moves.filter((m) => m.known)
  const likely = profile.moves.filter((m) => !m.known)
  const full = known.length >= 4

  const options = useMemo<PickerOption[]>(() => {
    if (!manual) return []
    const gen = genFor(format)
    const used = new Map((profile.usage?.moves ?? []).map(([n, pct]) => [toID(n), pct]))
    const all = [...gen.moves].map((m) => m.name as string)
    return all
      .filter((n) => !seen.has(toID(n)))
      .map((n) => ({ value: n, label: n, hint: used.has(toID(n)) ? pctText(used.get(toID(n)) ?? 0) : undefined }))
      .sort((a, b) => (used.get(toID(b.value)) ?? -1) - (used.get(toID(a.value)) ?? -1) || a.label.localeCompare(b.label))
    // `seen` se deriva de profile: basta con él como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, format, profile])

  return (
    <section aria-labelledby="battle-d-moves-title" className="mt-6">
      <SectionTitle
        id="battle-d-moves-title"
        hint={side === 'theirs' && likely.length ? 'El % es cuántos jugadores lo llevan' : undefined}
      >
        Ataques
      </SectionTitle>

      {side === 'theirs' && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success">
          <Eye aria-hidden size={14} /> Confirmados ({known.length}/4)
        </p>
      )}
      {known.length > 0 ? (
        <ul className="grid gap-1.5">
          {known.map((m) => (
            <MoveRow
              key={m.name}
              chance={m}
              format={format}
              tag={seen.has(toID(m.name)) ? 'Visto' : side === 'mine' ? 'Tu set' : 'Visto'}
              onForget={manual && seen.has(toID(m.name)) ? () => manual.onForget(m.name) : undefined}
            />
          ))}
        </ul>
      ) : (
        side === 'theirs' && <p className="battle-d-empty">Aún no ha usado ningún ataque.</p>
      )}

      {likely.length > 0 && !full && (
        <>
          <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Gauge aria-hidden size={14} /> {side === 'theirs' ? 'Probables (estimación por uso)' : 'Probables según uso'}
          </p>
          <ul className="grid gap-1.5">
            {likely.map((m) => (
              <MoveRow
                key={m.name}
                chance={m}
                format={format}
                onReveal={manual ? () => manual.onReveal('move', m.name) : undefined}
              />
            ))}
          </ul>
        </>
      )}

      {manual && !full && (
        <div className="mt-3">
          <EntityPicker
            label="Marcar otro ataque como visto"
            value=""
            options={options}
            allowClear={false}
            placeholder="Buscar ataque…"
            onSelect={(v) => v && manual.onReveal('move', v)}
          />
        </div>
      )}
    </section>
  )
}

function MoveRow({
  chance,
  format,
  tag,
  onReveal,
  onForget,
}: {
  chance: Chance
  format: BattleFormat
  tag?: string
  onReveal?: () => void
  onForget?: () => void
}) {
  const meta = moveMeta(format, chance.name)
  const cat = meta ? CATEGORY[meta.category] : null
  const body = (
    <>
      <span className="battle-d-move-type" style={typeVar(meta?.type)} aria-hidden />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{chance.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          {meta && <TypeChip type={meta.type} size="xs" />}
          {cat && (
            <span className="inline-flex items-center gap-0.5">
              <cat.Icon aria-hidden size={11} /> {cat.label}
            </span>
          )}
          {meta && meta.basePower > 0 && <span>· {meta.basePower} pot.</span>}
          {meta && meta.priority !== 0 && (
            <span className="font-semibold text-brand">
              ·{' '}
              {onReveal ? (
                // Dentro de un botón no cabe otro botón: aquí la explicación va sin desplegable.
                `Prioridad ${meta.priority > 0 ? `+${meta.priority}` : meta.priority}`
              ) : (
                <Term term="Prioridad">Prioridad {meta.priority > 0 ? `+${meta.priority}` : meta.priority}</Term>
              )}
            </span>
          )}
        </span>
      </span>
    </>
  )

  if (chance.known) {
    return (
      <li className="battle-d-move">
        {body}
        <span className="battle-d-chip battle-d-chip--good">
          <Check aria-hidden size={12} strokeWidth={3} /> {tag}
        </span>
        {onForget && (
          <button
            type="button"
            className="btn btn-ghost btn-icon -mr-1 size-11"
            aria-label={`Quitar ${chance.name} de los vistos`}
            onClick={onForget}
          >
            <X aria-hidden size={16} />
          </button>
        )}
      </li>
    )
  }

  const pctEl = (
    <span className="flex w-16 shrink-0 flex-col items-end gap-1">
      <span className="text-sm font-bold tabular-nums">{pctText(chance.pct)}</span>
      <span className="battle-d-pctbar" aria-hidden>
        <span style={{ width: `${Math.min(100, chance.pct)}%` }} />
      </span>
    </span>
  )

  if (onReveal) {
    return (
      <li>
        <button
          type="button"
          className="battle-d-move battle-d-move--probable pressable w-full"
          onClick={onReveal}
          aria-label={`Marcar ${chance.name} como visto (lo lleva el ${pctText(chance.pct)})`}
        >
          {body}
          {pctEl}
          <Plus aria-hidden size={16} className="shrink-0 text-brand" />
        </button>
      </li>
    )
  }

  return (
    <li className="battle-d-move battle-d-move--probable">
      {body}
      {pctEl}
    </li>
  )
}

function typeVar(type?: string) {
  const c = TYPE_COLORS[type ?? ''] ?? TYPE_COLORS.unknown
  return { '--type': c.bg } as React.CSSProperties
}

/* ------------------------------------------------------------------ */
/* Objeto y habilidad                                                   */
/* ------------------------------------------------------------------ */

function ItemAbility({
  profile,
  side,
  format,
  manual,
}: {
  profile: MonProfile
  side: 'mine' | 'theirs'
  format: BattleFormat
  manual?: Manual
}) {
  const state = profile.state
  const knownItem = profile.items.find((i) => i.known)
  const knownAbility = profile.abilities.find((a) => a.known)
  const gen = useMemo(() => genFor(format), [format])

  const itemOptions = useMemo<PickerOption[]>(() => {
    if (!manual) return []
    const used = new Map((profile.usage?.items ?? []).map(([n, pct]) => [toID(n), pct]))
    return [...gen.items]
      .map((i) => i.name as string)
      .map((n) => ({ value: n, label: n, hint: used.has(toID(n)) ? pctText(used.get(toID(n)) ?? 0) : undefined }))
      .sort((a, b) => (used.get(toID(b.value)) ?? -1) - (used.get(toID(a.value)) ?? -1) || a.label.localeCompare(b.label))
  }, [manual, gen, profile.usage])

  const abilityOptions = useMemo<PickerOption[]>(() => {
    if (!manual) return []
    const own = gen.species.get(toID(profile.species))
    const names = Object.values(own?.abilities ?? {}).filter(Boolean) as string[]
    const used = new Map((profile.usage?.abilities ?? []).map(([n, pct]) => [toID(n), pct]))
    const list = names.length ? names : [...gen.abilities].map((a) => a.name as string)
    return list.map((n) => ({ value: n, label: n, hint: used.has(toID(n)) ? pctText(used.get(toID(n)) ?? 0) : undefined }))
  }, [manual, gen, profile.species, profile.usage])

  return (
    <section aria-labelledby="battle-d-item-title" className="mt-6">
      <SectionTitle id="battle-d-item-title">Objeto y habilidad</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Objeto</p>
          {knownItem ? (
            <KnownRow icon={<ItemIcon item={itemSlug(knownItem.name)} size="sm" />} name={knownItem.name} tag={side === 'mine' && !state?.item ? 'Tu set' : 'Visto'} />
          ) : state?.lostItem ? (
            <KnownRow
              icon={<ItemIcon item={itemSlug(state.lostItem)} size="sm" />}
              name={state.lostItem}
              tag="Gastado"
              muted
            />
          ) : state?.item === null ? (
            <p className="battle-d-empty">Sin objeto.</p>
          ) : (
            <ChanceList
              items={profile.items.slice(0, 4)}
              icon={(n) => <ItemIcon item={itemSlug(n)} size="sm" />}
              onPick={manual ? (n) => manual.onReveal('item', n) : undefined}
            />
          )}
          {manual && !knownItem && (
            <div className="mt-2">
              <EntityPicker
                label="Marcar objeto visto"
                value=""
                options={itemOptions}
                allowClear={false}
                compact
                placeholder="Buscar objeto…"
                onSelect={(v) => v && manual.onReveal('item', v)}
              />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Habilidad</p>
          {knownAbility ? (
            <KnownRow icon={<Zap aria-hidden size={16} className="text-brand" />} name={knownAbility.name} tag={side === 'mine' && !state?.ability ? 'Tu set' : 'Vista'} />
          ) : (
            <ChanceList
              items={profile.abilities}
              icon={() => <Zap aria-hidden size={16} className="text-muted" />}
              onPick={manual ? (n) => manual.onReveal('ability', n) : undefined}
            />
          )}
          {manual && !knownAbility && abilityOptions.length > 1 && (
            <div className="mt-2">
              <EntityPicker
                label="Marcar habilidad vista"
                value=""
                options={abilityOptions}
                allowClear={false}
                compact
                onSelect={(v) => v && manual.onReveal('ability', v)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function KnownRow({ icon, name, tag, muted }: { icon: React.ReactNode; name: string; tag: string; muted?: boolean }) {
  return (
    <div className={clsx('battle-d-move', muted && 'opacity-70')}>
      <span className="grid size-7 place-items-center">{icon}</span>
      <span className={clsx('min-w-0 flex-1 truncate text-sm font-semibold', muted && 'line-through')}>{name}</span>
      <span className={clsx('battle-d-chip', muted ? 'battle-d-chip--bad' : 'battle-d-chip--good')}>
        {!muted && <Check aria-hidden size={12} strokeWidth={3} />} {tag}
      </span>
    </div>
  )
}

function ChanceList({
  items,
  icon,
  onPick,
}: {
  items: Chance[]
  icon: (name: string) => React.ReactNode
  onPick?: (name: string) => void
}) {
  if (!items.length) return <p className="battle-d-empty">Sin datos de uso.</p>
  return (
    <ul className="grid gap-1">
      {items.map((c) => {
        const inner = (
          <>
            <span className="grid size-7 shrink-0 place-items-center">{icon(c.name)}</span>
            <span className="min-w-0 flex-1 truncate text-left text-sm">{c.name}</span>
            <span className="text-sm font-bold tabular-nums">{pctText(c.pct)}</span>
            {onPick && <Plus aria-hidden size={16} className="shrink-0 text-brand" />}
          </>
        )
        return (
          <li key={c.name}>
            {onPick ? (
              <button
                type="button"
                className="battle-d-move battle-d-move--probable pressable w-full"
                aria-label={`Marcar ${c.name} como visto (${pctText(c.pct)})`}
                onClick={() => onPick(c.name)}
              >
                {inner}
              </button>
            ) : (
              <div className="battle-d-move battle-d-move--probable">{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Estadísticas y velocidad                                             */
/* ------------------------------------------------------------------ */

function Stats({ profile, side, format }: { profile: MonProfile; side: 'mine' | 'theirs'; format: BattleFormat }) {
  const stats = useMemo(() => statsOf(format, profile.set), [format, profile.set])
  const speed = useMemo(() => speedOf(format, profile.set), [format, profile.set])
  const theirs = side === 'theirs'
  const cap = format.statPoints ? 32 : 252
  const invest = profile.set.invest
  const spread = invest
    ? (Object.keys(STAT_SHORT) as (keyof StatTable)[])
        .filter((k) => (invest[k] ?? 0) > 0)
        .map((k) => `${invest[k]} ${STAT_SHORT[k]}`)
        .join(' / ')
    : ''
  const top = stats ? Math.max(...Object.values(stats), 1) : 1
  const scarfSpeed = Math.floor(profile.speed.typical * 1.5)
  const hasScarf = toID(profile.set.item ?? '') === 'choicescarf'
  const boost = profile.state?.boosts.spe ?? 0

  return (
    <section aria-labelledby="battle-d-stats-title" className="mt-6">
      <SectionTitle id="battle-d-stats-title" hint={theirs ? 'Del set más probable' : undefined}>
        Estadísticas
      </SectionTitle>

      {/* Velocidad: lo que más se consulta, en grande */}
      <div className="battle-d-panel">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Gauge aria-hidden size={14} /> Velocidad{boost ? ` (sin contar el ${boost > 0 ? '+' : '−'}${Math.abs(boost)})` : ''}
        </p>
        {theirs ? (
          <>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <SpeedCell label="Mínima" value={profile.speed.min} hint="Sin invertir" />
              <SpeedCell label="Típica" value={profile.speed.typical} hint="Reparto más usado" strong />
              <SpeedCell label="Máxima" value={profile.speed.max} hint="Toda la inversión" />
            </div>
            {profile.speed.scarf >= 1 && !profile.items.some((i) => i.known) && (
              <p className="mt-2 text-xs text-muted">
                Con <Term term="Pañuelo">Pañuelo</Term>:{' '}
                <strong className="text-ink tabular-nums">{scarfSpeed}</strong> · lo lleva el {pctText(profile.speed.scarf)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {speed}
            {hasScarf && <span className="ml-2 text-xs font-semibold text-muted">con Pañuelo incluido</span>}
          </p>
        )}
      </div>

      {stats && (
        <table className="mt-3 w-full text-[13px]">
          <caption className="sr-only">Estadísticas reales de {profile.species}</caption>
          <tbody>
            {(Object.keys(STAT_SHORT) as (keyof StatTable)[]).map((k) => (
              <tr key={k}>
                <th scope="row" className="w-12 py-1 text-left font-semibold">
                  <abbr title={STAT_LONG[k]} className="no-underline">
                    {STAT_SHORT[k]}
                  </abbr>
                </th>
                <td className="w-12 text-right font-extrabold tabular-nums">{stats[k]}</td>
                <td className="pl-3">
                  <span className="battle-d-statbar" aria-hidden>
                    <span style={{ width: `${(stats[k] / top) * 100}%` }} data-invested={(invest?.[k] ?? 0) > 0 || undefined} />
                  </span>
                </td>
                <td className="w-10 text-right text-[11px] tabular-nums text-muted">
                  {(invest?.[k] ?? 0) > 0 ? `+${invest?.[k]}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(profile.set.nature || spread) && (
        <p className="mt-2 text-xs text-muted">
          {theirs ? 'Reparto supuesto' : 'Reparto'}: {profile.set.nature ?? 'Neutra'}
          {spread && ` · ${spread}`} ·{' '}
          <Term term={format.statPoints ? 'Puntos' : 'EVs'}>
            {format.statPoints ? `puntos 0-${cap}` : `EVs 0-${maxInvest(format)}`}
          </Term>
        </p>
      )}
    </section>
  )
}

function SpeedCell({ label, value, hint, strong }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={clsx('rounded-xl px-1 py-1.5', strong && 'bg-brand-soft')}>
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className={clsx('font-extrabold tabular-nums', strong ? 'text-2xl' : 'text-lg')}>{value}</p>
      <p className="text-[10px] leading-tight text-muted">{hint}</p>
    </div>
  )
}
