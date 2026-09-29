'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowDownUp, Check, CloudRain, CloudSun, Mountain, Snowflake, Sun, X } from 'lucide-react'
import clsx from 'clsx'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { EntityPicker, type PickerOption } from '@/components/entity-picker'
import { ItemIcon } from '@/components/pokemon-details'
import { ShowdownSprite } from '@/components/battle/showdown-sprite'
import type { MonProfile } from '@/lib/battle/advice'
import type { DamageResult, FieldState, MonSet } from '@/lib/battle/calc'
import { genFor, toID } from '@/lib/battle/dex'
import type { BattleFormat } from '@/lib/battle/formats'
import { allHits, bigRange, flipField, hasStab, koTone, moveMeta, plainKo, showsKoLabel, typeEffect } from './damage'
import {
  CATEGORY, DamageBar, HpBar, SectionTitle, Term, TypeChip, hpOf, itemSlug, jargonForLabel, pctText,
} from './shared'

/*
 * Calculadora rápida: atacante, ataque y defensor, y el resultado en grande.
 * Por defecto calcula todos los ataques del atacante y enseña el que más
 * pega; tocando cualquier otro de la lista pasa a ser el principal.
 */

type Weather = NonNullable<FieldState['weather']>

const WEATHERS: { value: Weather; label: string; Icon: typeof Sun }[] = [
  { value: '', label: 'Sin clima', Icon: CloudSun },
  { value: 'Sun', label: 'Sol', Icon: Sun },
  { value: 'Rain', label: 'Lluvia', Icon: CloudRain },
  { value: 'Sand', label: 'Arena', Icon: Mountain },
  { value: 'Snow', label: 'Nieve', Icon: Snowflake },
]

export function CalcSheet({
  open,
  onClose,
  format,
  attackers,
  defenders,
  field,
}: {
  open: boolean
  onClose: () => void
  format: BattleFormat
  attackers: MonProfile[]
  defenders: MonProfile[]
  /** Campo con el lado de `attackers` como atacante. */
  field?: FieldState
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Calculadora de daño" showTitle>
      <Calculator format={format} attackers={attackers} defenders={defenders} field={field} />
    </BottomSheet>
  )
}

function Calculator({
  format,
  attackers,
  defenders,
  field,
}: {
  format: BattleFormat
  attackers: MonProfile[]
  defenders: MonProfile[]
  field?: FieldState
}) {
  const reduce = useReducedMotion()
  const [swapped, setSwapped] = useState(false)
  const [ai, setAi] = useState(0)
  const [di, setDi] = useState(0)
  const [chosenMove, setChosenMove] = useState<string | null>(null)
  const [extraMoves, setExtraMoves] = useState<string[]>([])
  const [crit, setCrit] = useState(false)
  const [helping, setHelping] = useState(false)
  const [screens, setScreens] = useState(false)
  const [weatherOverride, setWeatherOverride] = useState<Weather | null>(null)
  const [itemOverride, setItemOverride] = useState<string | null>(null)

  const atkList = (swapped ? defenders : attackers).filter((p) => !p.state?.fainted)
  const defList = (swapped ? attackers : defenders).filter((p) => !p.state?.fainted)
  const attacker = atkList[Math.min(ai, atkList.length - 1)] ?? null
  const defender = defList[Math.min(di, defList.length - 1)] ?? null

  const baseField = useMemo(() => (swapped ? flipField(field) : field), [swapped, field])
  const weather = weatherOverride ?? baseField?.weather ?? ''
  const calcField = useMemo<FieldState>(
    () => ({
      ...baseField,
      weather,
      attackerSide: { ...baseField?.attackerSide, helpingHand: helping || undefined },
      defenderSide: {
        ...baseField?.defenderSide,
        reflect: screens || baseField?.defenderSide?.reflect,
        lightScreen: screens || baseField?.defenderSide?.lightScreen,
      },
    }),
    [baseField, weather, helping, screens],
  )

  const moveNames = useMemo(() => {
    if (!attacker) return []
    const own = attacker.moves.filter((m) => m.known || m.pct >= 15).map((m) => m.name)
    return [...new Set([...own, ...extraMoves])]
  }, [attacker, extraMoves])

  const attackerSet = useMemo<MonSet | null>(
    () => (attacker ? { ...attacker.set, item: itemOverride ?? attacker.set.item } : null),
    [attacker, itemOverride],
  )

  const results = useMemo<DamageResult[]>(() => {
    if (!attackerSet || !defender) return []
    return allHits(format, attackerSet, defender.set, moveNames, calcField, crit)
  }, [format, attackerSet, defender, moveNames, calcField, crit])

  const main = results.find((r) => toID(r.move) === toID(chosenMove ?? '')) ?? results[0] ?? null
  const remaining = defender ? hpOf(defender) : 100

  const moveOptions = useMemo<PickerOption[]>(() => {
    const gen = genFor(format)
    const have = new Set(moveNames.map(toID))
    return [...gen.moves]
      .filter((m) => m.category !== 'Status' && !have.has(m.id))
      .map((m) => ({ value: m.name as string, label: m.name as string }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [format, moveNames])

  // Cambiar de atacante deshace lo que dependía de él.
  const pickAttacker = (i: number) => {
    setAi(i)
    setChosenMove(null)
    setItemOverride(null)
    setExtraMoves([])
  }

  if (!attacker || !defender) {
    return <p className="battle-d-empty">Aún no hay Pokémon a los dos lados para calcular.</p>
  }

  const knownItem = attacker.items.find((i) => i.known)?.name
  const itemChoices = [...new Set([attacker.set.item, ...attacker.items.slice(0, 5).map((i) => i.name)].filter(Boolean))] as string[]

  return (
    <div className="pb-2">
      {/* Quién ataca a quién */}
      <MonChooser label="Atacante" list={atkList} selected={atkList.indexOf(attacker)} onSelect={pickAttacker} />
      <div className="my-1 flex items-center justify-center">
        <button
          type="button"
          className="btn btn-soft btn-sm gap-1.5"
          onClick={() => {
            setSwapped((v) => !v)
            const a = ai
            setAi(di)
            setDi(a)
            setChosenMove(null)
            setItemOverride(null)
            setExtraMoves([])
          }}
        >
          <ArrowDownUp aria-hidden size={15} /> Intercambiar
        </button>
      </div>
      <MonChooser label="Defensor" list={defList} selected={defList.indexOf(defender)} onSelect={setDi} />

      {/* Resultado en grande */}
      <section aria-live="polite" aria-atomic="true" className="battle-d-result mt-4">
        {main ? (
          <motion.div
            key={`${main.move}-${attacker.species}-${defender.species}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="font-bold">{main.move}</span>
              <TypeChip type={main.moveType} size="xs" />
              <span className="text-xs text-muted">
                de {attacker.species} a {defender.species}
              </span>
            </p>
            <p className="battle-d-big mt-1" data-tone={koTone(main)}>
              {bigRange(main.minPercent, main.maxPercent)}
            </p>
            <p className="text-base font-bold leading-snug">{capitalize(plainKo(main, remaining))}</p>

            <div className="mt-3">
              <DamageBar remaining={remaining} min={main.minPercent} max={main.maxPercent} />
              <p className="mt-1 flex justify-between text-[11px] text-muted">
                <span>Le queda {Math.round(remaining)} %</span>
                <span>
                  <span className="battle-d-key battle-d-key--sure" aria-hidden /> seguro ·{' '}
                  <span className="battle-d-key battle-d-key--maybe" aria-hidden /> según la tirada
                </span>
              </p>
            </div>

            <ResultChips result={main} format={format} attacker={attacker.species} defender={defender.species} crit={crit} />

            {main.desc && (
              <details className="battle-d-desc mt-3">
                <summary>Cálculo de Showdown</summary>
                <p lang="en">{main.desc}</p>
              </details>
            )}
          </motion.div>
        ) : (
          <p className="text-sm text-muted">
            {attacker.species} no tiene ataques que dañen a {defender.species}. Prueba otro ataque abajo.
          </p>
        )}
      </section>

      {/* Ajustes rápidos */}
      <SectionTitle className="mt-6">Ajustes rápidos</SectionTitle>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ajustes del cálculo">
        <Toggle on={crit} onChange={setCrit} term="Crítico" />
        {format.gameType === 'doubles' && <Toggle on={helping} onChange={setHelping} term="Ayuda" />}
        <Toggle on={screens} onChange={setScreens} term="Pantallas" />
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Clima">
        {WEATHERS.map(({ value, label, Icon }) => (
          <button
            key={label}
            type="button"
            aria-pressed={weather === value}
            className="battle-d-toggle"
            onClick={() => setWeatherOverride(value)}
          >
            <Icon aria-hidden size={15} /> {label}
          </button>
        ))}
      </div>

      {itemChoices.length > 1 && (
        <>
          <SectionTitle className="mt-6" hint={knownItem ? 'Ya se le ha visto' : 'Según uso'}>¿Y si lleva…?</SectionTitle>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={`Objeto de ${attacker.species}`}>
            {itemChoices.map((name) => {
              const pct = attacker.items.find((i) => i.name === name)
              const current = (itemOverride ?? attacker.set.item) === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={current}
                  className="battle-d-toggle shrink-0"
                  onClick={() => setItemOverride(name === attacker.set.item ? null : name)}
                >
                  <ItemIcon item={itemSlug(name)} size="sm" />
                  <span className="whitespace-nowrap">{name}</span>
                  {pct && !pct.known && <span className="text-[11px] font-normal text-muted">{pctText(pct.pct)}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Todos los ataques */}
      <SectionTitle className="mt-6" hint="Toca uno para verlo arriba">Todos sus ataques</SectionTitle>
      <ul className="grid gap-1.5" role="list">
        {results.map((r) => {
          const selected = r === main
          const meta = moveMeta(format, r.move)
          const extra = extraMoves.includes(r.move)
          const probable = attacker.moves.find((m) => m.name === r.move)
          return (
            <li key={r.move} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={selected}
                className="battle-d-calcrow pressable"
                onClick={() => setChosenMove(r.move)}
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{r.move}</span>
                    {meta && <TypeChip type={meta.type} size="xs" />}
                    {probable && !probable.known && (
                      <span className="text-[10px] font-semibold text-warning">{pctText(probable.pct)}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">{r.label}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-extrabold tabular-nums" data-tone={koTone(r)}>
                    {bigRange(r.minPercent, r.maxPercent)}
                  </span>
                  <span className="battle-d-pctbar ml-auto mt-1 w-20" aria-hidden>
                    <span style={{ width: `${Math.min(100, (r.maxPercent / Math.max(remaining, 1)) * 100)}%` }} />
                  </span>
                </span>
                {selected && <Check aria-hidden size={16} className="shrink-0 text-brand" />}
              </button>
              {extra && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon size-11"
                  aria-label={`Quitar ${r.move} del cálculo`}
                  onClick={() => {
                    setExtraMoves((list) => list.filter((m) => m !== r.move))
                    if (chosenMove === r.move) setChosenMove(null)
                  }}
                >
                  <X aria-hidden size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-3">
        <EntityPicker
          label="Probar otro ataque"
          value=""
          options={moveOptions}
          allowClear={false}
          placeholder="Buscar ataque…"
          onSelect={(v) => {
            if (!v) return
            setExtraMoves((list) => [...list, v])
            setChosenMove(v)
          }}
        />
      </div>
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ResultChips({
  result,
  format,
  attacker,
  defender,
  crit,
}: {
  result: DamageResult
  format: BattleFormat
  attacker: string
  defender: string
  crit: boolean
}) {
  const stab = hasStab(format, attacker, result.moveType)
  const effect = typeEffect(format, result.moveType, defender)
  const cat = CATEGORY[result.category]
  return (
    <div className="mt-3 flex flex-wrap items-start gap-1.5">
      {showsKoLabel(result) ? (
        <span className="battle-d-chip">
          <Term term={jargonForLabel(result.label)}>{result.label}</Term>
        </span>
      ) : (
        <span className="battle-d-chip">{result.label}</span>
      )}
      <span className="battle-d-chip">
        <Term term="Rango">Rango de daño</Term>
      </span>
      {stab && (
        <span className="battle-d-chip battle-d-chip--brand">
          <Term term="STAB" />
        </span>
      )}
      {effect && (
        <span className={clsx('battle-d-chip', effect.value > 1 ? 'battle-d-chip--good' : 'battle-d-chip--bad')}>
          {effect.text}
        </span>
      )}
      <span className="battle-d-chip">
        <cat.Icon aria-hidden size={12} /> {cat.label}
      </span>
      {crit && <span className="battle-d-chip battle-d-chip--brand">Crítico</span>}
    </div>
  )
}

function Toggle({ on, onChange, term }: { on: boolean; onChange: (v: boolean) => void; term: string }) {
  return (
    <button type="button" aria-pressed={on} className="battle-d-toggle" onClick={() => onChange(!on)}>
      {on && <Check aria-hidden size={14} strokeWidth={3} />}
      {term}
    </button>
  )
}

/** Fila de sprites para elegir un Pokémon: con seis, tocar es más rápido que buscar. */
function MonChooser({
  label,
  list,
  selected,
  onSelect,
}: {
  label: string
  list: MonProfile[]
  selected: number
  onSelect: (i: number) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
        {label}: <span className="normal-case tracking-normal text-ink">{list[selected]?.species}</span>
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={label}>
        {list.map((p, i) => (
          <button
            key={`${p.species}-${i}`}
            type="button"
            aria-pressed={i === selected}
            aria-label={p.species}
            className="battle-d-monpick pressable"
            onClick={() => onSelect(i)}
          >
            <ShowdownSprite species={p.species} size={40} />
            <HpBar hp={hpOf(p)} thin className="w-10" label={`Vida de ${p.species}`} />
          </button>
        ))}
      </div>
    </div>
  )
}
