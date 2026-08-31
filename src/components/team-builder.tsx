'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ChevronDown, ChevronUp, ClipboardPaste, Loader2, Plus, Save, Sparkles,
  Trash2, X,
} from 'lucide-react'
import { TypeBadge } from '@/components/type-badge'
import { EntityPicker, type PickerOption } from '@/components/entity-picker'
import {
  getMoves, listItems, listPokemon, resolvePokemon,
  type MoveDetail, type PokemonDetail,
} from '@/lib/pokeapi'
import {
  MAX_EV, MAX_EVS_TOTAL, MAX_IV, NATURES, NATURE_NAMES, POKEMON_TYPES, STAT_KEYS, STAT_LABELS,
  computeStat, itemSpriteUrl, natureModifier, prettify, spriteUrl, statColor, type StatKey,
} from '@/lib/pokemon'
import { matchAbility, parseShowdownTeam, speciesCandidates } from '@/lib/showdown'
import { loadEsIndex, resolveName, resolveNature, translate, translateType } from '@/lib/showdown-i18n'
import { createTeam, updateTeam, type BuildInput, type TeamInput } from '@/app/actions/teams'
import type { BuildRow, Gender, TeamRow } from '@/lib/database.types'

/* ------------------------------- Estado local ------------------------------- */

interface Slot {
  key: string
  pokemon_id: number
  pokemon_name: string
  nickname: string
  gender: Gender
  level: number
  shiny: boolean
  ability: string
  item: string
  nature: string
  tera_type: string
  moves: [string, string, string, string]
  ivs: Record<StatKey, number>
  evs: Record<StatKey, number>
}

let keySeed = 0
const nextKey = () => `slot-${++keySeed}`

function emptySlot(): Slot {
  return {
    key: nextKey(),
    pokemon_id: 0,
    pokemon_name: '',
    nickname: '',
    gender: 'unknown',
    level: 50,
    shiny: false,
    ability: '',
    item: '',
    nature: 'hardy',
    tera_type: '',
    moves: ['', '', '', ''],
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }
}

function slotFromBuild(b: BuildRow): Slot {
  return {
    key: nextKey(),
    pokemon_id: b.pokemon_id,
    pokemon_name: b.pokemon_name,
    nickname: b.nickname ?? '',
    gender: b.gender,
    level: b.level,
    shiny: b.shiny,
    ability: b.ability ?? '',
    item: b.item ?? '',
    nature: b.nature ?? 'hardy',
    tera_type: b.tera_type ?? '',
    moves: [b.moves[0] ?? '', b.moves[1] ?? '', b.moves[2] ?? '', b.moves[3] ?? ''],
    ivs: { hp: b.hp_ivs, atk: b.atk_ivs, def: b.def_ivs, spa: b.spa_ivs, spd: b.spd_ivs, spe: b.spe_ivs },
    evs: { hp: b.hp_evs, atk: b.atk_evs, def: b.def_evs, spa: b.spa_evs, spd: b.spd_evs, spe: b.spe_evs },
  }
}

function toInput(s: Slot, index: number): BuildInput {
  return {
    slot: index + 1,
    pokemon_id: s.pokemon_id,
    pokemon_name: s.pokemon_name,
    nickname: s.nickname.trim() || null,
    gender: s.gender,
    level: s.level,
    shiny: s.shiny,
    ability: s.ability || null,
    item: s.item || null,
    nature: s.nature || null,
    tera_type: s.tera_type || null,
    moves: s.moves.filter(Boolean),
    hp_ivs: s.ivs.hp, atk_ivs: s.ivs.atk, def_ivs: s.ivs.def,
    spa_ivs: s.ivs.spa, spd_ivs: s.ivs.spd, spe_ivs: s.ivs.spe,
    hp_evs: s.evs.hp, atk_evs: s.evs.atk, def_evs: s.evs.def,
    spa_evs: s.evs.spa, spd_evs: s.evs.spd, spe_evs: s.evs.spe,
  }
}

const FORMATS = ['VGC Reg H', 'VGC Reg G', 'Doubles OU', 'Singles OU', 'Ubers', 'Little Cup', 'Casual']

/**
 * Traduce el código de formato de Showdown ("gen9vgc2024regh") a la etiqueta que
 * usa PokeHub ("VGC Reg H"). Si no encaja con ningún patrón conocido devuelve
 * null y se deja el formato que hubiera puesto el usuario.
 */
function showdownFormatLabel(code: string | null): string | null {
  if (!code) return null
  const reg = code.match(/vgc\d*reg([a-z])/i)
  if (reg) return `VGC Reg ${reg[1].toUpperCase()}`
  if (/doubles ?ou/i.test(code) || /doublesou/i.test(code)) return 'Doubles OU'
  if (/ubers/i.test(code)) return 'Ubers'
  if (/\blc\b|littlecup/i.test(code)) return 'Little Cup'
  if (/ou$/i.test(code)) return 'Singles OU'
  return null
}

/** "adamant" -> "Adamant (+Atk, −SpA)": la naturaleza deja de ser un nombre suelto. */
function natureLabel(name: string) {
  const mod = NATURES[name]
  if (!mod) return `${prettify(name)} (neutra)`
  return `${prettify(name)} (+${STAT_LABELS[mod[0]]}, −${STAT_LABELS[mod[1]]})`
}

/* --------------------------------- Componente -------------------------------- */

export function TeamBuilder({
  team,
  builds,
}: {
  team?: TeamRow
  builds?: BuildRow[]
}) {
  const editing = Boolean(team)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [name, setName] = useState(team?.name ?? '')
  const [format, setFormat] = useState(team?.format ?? FORMATS[0])
  const [description, setDescription] = useState(team?.description ?? '')
  const [isPublic, setIsPublic] = useState(team?.is_public ?? true)
  const [slots, setSlots] = useState<Slot[]>(
    builds && builds.length
      ? [...builds].sort((a, b) => a.slot - b.slot).map(slotFromBuild)
      : [emptySlot()],
  )
  const [importOpen, setImportOpen] = useState(false)

  const [dex, setDex] = useState<{ id: number; name: string }[]>([])
  const [items, setItems] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    listPokemon().then(setDex).catch(() => {})
    listItems().then(setItems).catch(() => {})
  }, [])

  // Las listas completas (~1300 Pokémon, ~2100 objetos) sólo se transforman una
  // vez; el picker ya se encarga de filtrar y paginar sobre el resultado.
  const dexOptions = useMemo<PickerOption[]>(
    () =>
      dex.map((d) => ({
        value: d.name,
        label: prettify(d.name),
        icon: spriteUrl(d.id),
        hint: d.id <= 10000 ? `#${String(d.id).padStart(4, '0')}` : undefined,
      })),
    [dex],
  )

  const itemOptions = useMemo<PickerOption[]>(
    () => items.map((i) => ({ value: i.name, label: prettify(i.name), icon: itemSpriteUrl(i.name) })),
    [items],
  )

  const dexByName = useMemo(() => new Map(dex.map((d) => [d.name, d.id])), [dex])
  const itemNames = useMemo(() => items.map((i) => i.name), [items])

  function patch(index: number, changes: Partial<Slot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)))
  }

  const filled = slots.filter((s) => s.pokemon_id > 0)

  function save() {
    setError(null)
    if (!name.trim()) {
      setError('Ponle un nombre al equipo antes de publicarlo.')
      return
    }
    if (filled.length === 0) {
      setError('Añade al menos un Pokémon al equipo.')
      return
    }

    const payload: TeamInput = {
      name: name.trim(),
      description,
      format,
      is_public: isPublic,
      builds: filled.map(toInput),
    }

    startTransition(async () => {
      const res = team ? await updateTeam(team.id, payload) : await createTeam(payload)
      if (res?.error) setError(res.error)
    })
  }

  /**
   * Importa un equipo de Showdown resolviendo cada especie contra la PokéAPI.
   * La habilidad se reconcilia con la lista real de la especie: Showdown la
   * escribe con espacios y mayúsculas, y algunas formas la exportan distinta,
   * así que sin este paso el campo se quedaba vacío.
   */
  async function importShowdown(text: string) {
    // El diccionario español pesa ~100 KB: sólo se carga al importar.
    const esIndex = await loadEsIndex().catch(() => null)

    // Ojo: no llamar `team` a esto, que taparía la prop `team` del componente.
    const imported = parseShowdownTeam(text, { isSpecies: (s) => dexByName.has(s) })
    const parsed = imported.builds
    if (parsed.length === 0) {
      setError('No se ha reconocido ningún Pokémon en el texto pegado.')
      return
    }

    const resolved: Slot[] = []
    const failed: string[] = []
    const untranslated = new Set<string>()

    for (const p of parsed.slice(0, 6)) {
      const speciesName = translate(esIndex, 'species', p.pokemon_name)
      const candidates = speciesCandidates(speciesName)
      // Atajo: si el nombre ya está en la Pokédex cacheada, evita el 404 previo.
      const known = candidates.find((c) => dexByName.has(c))
      const species = await resolvePokemon(known ? [known, ...candidates] : candidates)

      if (!species) {
        failed.push(prettify(p.pokemon_name))
        continue
      }

      // Habilidad: el conjunto de candidatos es de 2-3, así que aquí se puede
      // aproximar con un umbral bajo sin miedo a equivocarse.
      const ability = resolveName(p.ability ?? '', 'abilities', esIndex, species.abilities, 0.42, true)
      if (p.ability && !ability.matched) untranslated.add(prettify(p.ability))

      const moves = p.moves.map((m) => {
        const r = resolveName(m, 'moves', esIndex, species.moves, 0.62)
        if (m && !r.matched) untranslated.add(prettify(m))
        return r.value
      })

      // Los objetos se comparan contra el catálogo entero, así que el umbral
      // aproximado va alto: con ~2100 candidatos, uno bajo inventaría objetos.
      const item = resolveName(p.item ?? '', 'items', esIndex, itemNames, 0.92)
      if (p.item && !item.matched) untranslated.add(prettify(p.item))

      const nature = resolveNature(p.nature ?? '', esIndex, NATURE_NAMES)
      if (p.nature && !nature.matched) untranslated.add(prettify(p.nature))

      resolved.push({
        ...emptySlot(),
        pokemon_id: species.id,
        pokemon_name: species.name,
        nickname: p.nickname ?? '',
        gender: p.gender,
        level: p.level,
        shiny: p.shiny,
        ability: matchAbility(ability.value, species.abilities),
        item: item.value,
        nature: nature.value,
        tera_type: translateType(p.tera_type ?? ''),
        moves: [moves[0] ?? '', moves[1] ?? '', moves[2] ?? '', moves[3] ?? ''],
        ivs: p.ivs,
        evs: p.evs,
      })
    }

    if (resolved.length === 0) {
      setError('No se han podido identificar esos Pokémon en la PokéAPI.')
      return
    }

    setSlots(resolved)
    setImportOpen(false)
    setError(null)

    // La cabecera "=== [formato] Nombre ===" trae datos del equipo: se aprovechan
    // sólo si el usuario no ha escrito nada todavía, para no pisarle lo suyo.
    if (imported.name && !name.trim()) setName(imported.name.slice(0, 40))
    const mapped = showdownFormatLabel(imported.format)
    if (mapped && format === FORMATS[0]) setFormat(mapped)

    const partes = [`Importados ${resolved.length} Pokémon`]
    if (parsed.length > 6) partes.push(`se ignoraron ${parsed.length - 6} por el límite de 6`)
    if (failed.length) partes.push(`no se reconocieron: ${failed.join(', ')}`)
    if (untranslated.size) {
      // Los equipos traducidos a mano traen nombres que no están en ningún
      // diccionario. Se importa el resto y se dice exactamente qué revisar.
      const lista = [...untranslated].slice(0, 8).join(', ')
      const resto = untranslated.size > 8 ? ` y ${untranslated.size - 8} más` : ''
      partes.push(`revisa a mano: ${lista}${resto}`)
    }
    setNotice(partes.join(' · ') + '.')
  }

  return (
    <div className="mx-auto max-w-[1100px] px-3 sm:px-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">
          {editing ? 'Editar equipo' : 'Nuevo equipo'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold shadow-card transition hover:bg-line"
          >
            <ClipboardPaste size={16} /> Importar de Showdown
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5 disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editing ? 'Guardar cambios' : 'Publicar equipo'}
          </button>
        </div>
      </div>

      {importOpen && <ImportPanel onImport={importShowdown} onClose={() => setImportOpen(false)} />}

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 flex items-start justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            <X size={15} />
          </button>
        </p>
      )}

      {/* Datos del equipo */}
      <section className="mb-5 grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card md:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nombre del equipo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="p. ej. Rain Team 2026"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Formato</span>
          <input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            list="formats"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none focus:border-brand"
          />
          <datalist id="formats">
            {FORMATS.map((f) => <option key={f} value={f} />)}
          </datalist>
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Descripción <span className="font-normal text-muted">({description.length}/1000)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Cuenta la estrategia del equipo, los matchups complicados, cómo se juega…"
            className="w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="flex items-center gap-2.5 md:col-span-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand)]"
          />
          <span className="text-sm">Visible para toda la comunidad</span>
        </label>
      </section>

      <TeamOverview slots={slots} />

      {/* Slots */}
      <div className="flex flex-col gap-4">
        {slots.map((slot, i) => (
          <SlotEditor
            key={slot.key}
            index={i}
            slot={slot}
            dexOptions={dexOptions}
            itemOptions={itemOptions}
            duplicate={
              slot.pokemon_id > 0 &&
              slots.some((o, j) => j !== i && o.pokemon_id === slot.pokemon_id)
            }
            onChange={(c) => patch(i, c)}
            onRemove={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
            onMove={(dir) =>
              setSlots((prev) => {
                const next = [...prev]
                const j = i + dir
                if (j < 0 || j >= next.length) return prev
                ;[next[i], next[j]] = [next[j], next[i]]
                return next
              })
            }
            canRemove={slots.length > 1}
          />
        ))}
      </div>

      {slots.length < 6 && (
        <button
          type="button"
          onClick={() => setSlots((prev) => [...prev, emptySlot()])}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface/60 py-6 text-sm font-semibold text-muted transition hover:border-brand hover:text-brand"
        >
          <Plus size={18} /> Añadir Pokémon ({slots.length}/6)
        </button>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-surface-2 px-5 py-2.5 text-sm font-semibold shadow-card transition hover:bg-line"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5 disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {editing ? 'Guardar cambios' : 'Publicar equipo'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ Resumen del equipo ---------------------------- */

/** Tira con los seis huecos: da contexto de qué falta sin bajar por la página. */
function TeamOverview({ slots }: { slots: Slot[] }) {
  const filled = slots.filter((s) => s.pokemon_id > 0)
  if (filled.length === 0) return null

  return (
    <section className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <span className="text-xs font-semibold text-muted">Equipo ({filled.length}/6)</span>
      <ul className="flex flex-wrap gap-2">
        {slots.map((s, i) => (
          <li
            key={s.key}
            title={s.pokemon_name ? prettify(s.pokemon_name) : `Hueco ${i + 1} vacío`}
            className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 shadow-card"
          >
            {s.pokemon_id ? (
              <Image
                src={spriteUrl(s.pokemon_id, s.shiny)}
                alt={prettify(s.pokemon_name)}
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 [image-rendering:pixelated] object-contain"
              />
            ) : (
              <span className="text-sm text-muted">{i + 1}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------ Panel de importar ----------------------------- */

function ImportPanel({
  onImport,
  onClose,
}: {
  onImport: (text: string) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  // Análisis en vivo: es puro tratamiento de texto (sin red), así que se puede
  // hacer en cada tecla y decirle al usuario cuántos Pokémon se han reconocido
  // antes de importar.
  const preview = useMemo(() => (text.trim() ? parseShowdownTeam(text) : null), [text])
  const found = preview?.builds.length ?? 0

  return (
    <section className="mb-5 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">Pega tu equipo de Pokémon Showdown</h2>
        <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={'=== [gen9vgc2024regh] Mi equipo ===\n\nPelipper (F) @ Damp Rock\nAbility: Drizzle\nLevel: 50\nEVs: 252 HP / 4 Def / 252 Spe\nTimid Nature\n- Hurricane\n- Scald\n- Tailwind\n- Protect'}
        className="min-h-[22rem] w-full resize-y whitespace-pre overflow-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {text.trim() && (
          <span className={found === 0 ? 'font-semibold text-red-500' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
            {found === 0
              ? 'No se ha reconocido ningún Pokémon'
              : `${found} Pokémon detectado${found === 1 ? '' : 's'}`}
          </span>
        )}
        {preview?.name && <span className="text-muted">Equipo: «{preview.name}»</span>}
        {found > 6 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} /> Sólo se importarán los 6 primeros
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-muted">
        Se reconocen la cabecera del equipo, motes, género, objeto, habilidad, naturaleza, nivel,
        Teratipo, IVs/EVs y hasta cuatro movimientos. Sustituye a los Pokémon que tengas ahora.
      </p>

      <button
        type="button"
        disabled={busy || found === 0}
        onClick={async () => {
          setBusy(true)
          await onImport(text)
          setBusy(false)
        }}
        className="mt-2 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Importar
      </button>
    </section>
  )
}

/* -------------------------------- Editor de slot ------------------------------- */

function SlotEditor({
  index, slot, dexOptions, itemOptions, duplicate, onChange, onRemove, onMove, canRemove,
}: {
  index: number
  slot: Slot
  dexOptions: PickerOption[]
  itemOptions: PickerOption[]
  duplicate: boolean
  onChange: (changes: Partial<Slot>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  canRemove: boolean
}) {
  const [species, setSpecies] = useState<PokemonDetail | null>(null)
  const [moveInfo, setMoveInfo] = useState<Record<string, MoveDetail>>({})

  useEffect(() => {
    if (!slot.pokemon_id) {
      setSpecies(null)
      return
    }
    let alive = true
    resolvePokemon([String(slot.pokemon_id)])
      .then((p) => { if (alive) setSpecies(p) })
      .catch(() => {})
    return () => { alive = false }
  }, [slot.pokemon_id])

  // Detalles de los movimientos elegidos, para pintar tipo y categoría.
  const chosenMoves = slot.moves.filter(Boolean).join(',')
  useEffect(() => {
    const names = chosenMoves ? chosenMoves.split(',') : []
    if (names.length === 0) return
    let alive = true
    getMoves(names)
      .then((list) => {
        if (!alive) return
        setMoveInfo((prev) => {
          const next = { ...prev }
          for (const m of list) next[m.name] = m
          return next
        })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [chosenMoves])

  const abilityOptions = useMemo<PickerOption[]>(
    () =>
      (species?.abilityDetails ?? []).map((a) => ({
        value: a.name,
        label: prettify(a.name),
        iconNode: <span className="h-8 w-8 shrink-0" aria-hidden />,
        hint: a.hidden ? 'Oculta' : undefined,
      })),
    [species],
  )

  // Acotar los movimientos al learnset real es lo que hace el selector usable:
  // se pasa de ~900 opciones a las que la especie puede aprender de verdad.
  const moveOptions = useMemo<PickerOption[]>(
    () =>
      (species?.moves ?? []).map((m) => {
        const info = moveInfo[m]
        return {
          value: m,
          label: prettify(m),
          iconNode: info ? (
            <TypeBadge type={info.type} size="sm" className="w-16 shrink-0 justify-center" />
          ) : (
            <span className="h-8 w-16 shrink-0" aria-hidden />
          ),
          hint: info?.power ? `${info.power}` : undefined,
        }
      }),
    [species, moveInfo],
  )

  const teraOptions = useMemo<PickerOption[]>(
    () =>
      POKEMON_TYPES.map((t) => ({
        value: t,
        label: prettify(t),
        iconNode: <TypeBadge type={t} size="sm" className="w-16 shrink-0 justify-center" />,
      })),
    [],
  )

  const natureOptions = useMemo<PickerOption[]>(
    () =>
      NATURE_NAMES.map((n) => ({
        value: n,
        label: natureLabel(n),
        iconNode: <span className="h-8 w-2 shrink-0" aria-hidden />,
      })),
    [],
  )

  const evUsed = STAT_KEYS.reduce((a, k) => a + slot.evs[k], 0)
  const evLeft = MAX_EVS_TOTAL - evUsed

  function pickSpecies(value: string) {
    if (!value) {
      onChange({ pokemon_id: 0, pokemon_name: '', ability: '', moves: ['', '', '', ''] })
      return
    }
    const found = dexOptions.find((d) => d.value === value)
    if (!found) return
    // Al cambiar de especie, habilidad y movimientos dejan de ser válidos.
    resolvePokemon([value]).then((p) => {
      if (p) onChange({ pokemon_id: p.id, pokemon_name: p.name, ability: '', moves: ['', '', '', ''] })
    })
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <header className="mb-3 flex items-start gap-3">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-2 shadow-card">
          {slot.pokemon_id ? (
            <Image
              src={spriteUrl(slot.pokemon_id, slot.shiny)}
              alt={prettify(slot.pokemon_name)}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 [image-rendering:pixelated] object-contain"
            />
          ) : (
            <span className="text-xl text-muted">{index + 1}</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <EntityPicker
            label={`Pokémon ${index + 1}`}
            value={slot.pokemon_name}
            options={dexOptions}
            onSelect={pickSpecies}
            placeholder="Busca un Pokémon…"
            emptyText="Ningún Pokémon coincide"
            pixelated
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {species?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
            {duplicate && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle size={11} /> Repetido
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} aria-label="Subir" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
            <ChevronUp size={16} />
          </button>
          <button type="button" onClick={() => onMove(1)} aria-label="Bajar" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink">
            <ChevronDown size={16} />
          </button>
          {canRemove && (
            <button type="button" onClick={onRemove} aria-label="Quitar Pokémon" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-red-500 hover:text-white">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Text label="Mote" value={slot.nickname} onChange={(v) => onChange({ nickname: v })} maxLength={20} />

        <EntityPicker
          label="Habilidad"
          value={slot.ability}
          options={abilityOptions}
          onSelect={(v) => onChange({ ability: v })}
          placeholder={species ? 'Elige una habilidad' : 'Elige antes el Pokémon'}
          disabled={!species}
          disabledHint="Elige antes el Pokémon"
          emptyText="Esta especie no tiene más habilidades"
        />

        <EntityPicker
          label="Objeto"
          value={slot.item}
          options={itemOptions}
          onSelect={(v) => onChange({ item: v })}
          placeholder="Sin objeto"
          emptyText="Ningún objeto coincide"
        />

        <EntityPicker
          label="Naturaleza"
          value={slot.nature}
          options={natureOptions}
          onSelect={(v) => onChange({ nature: v || 'hardy' })}
          placeholder="Elige naturaleza"
          allowClear={false}
        />

        <EntityPicker
          label="Teratipo"
          value={slot.tera_type}
          options={teraOptions}
          onSelect={(v) => onChange({ tera_type: v })}
          placeholder="Sin Teratipo"
        />

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Nivel</span>
            <input
              type="number"
              min={1}
              max={100}
              value={slot.level}
              onChange={(e) => onChange({ level: clampNum(e.target.value, 1, 100, 50) })}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Género</span>
            <select
              value={slot.gender}
              onChange={(e) => onChange({ gender: e.target.value as Gender })}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-1 text-sm outline-none focus:border-brand"
            >
              <option value="unknown">—</option>
              <option value="male">♂</option>
              <option value="female">♀</option>
            </select>
          </label>
          <label className="flex flex-col">
            <span className="mb-1 block text-xs font-semibold">Shiny</span>
            <button
              type="button"
              onClick={() => onChange({ shiny: !slot.shiny })}
              aria-pressed={slot.shiny}
              className={`flex h-11 items-center justify-center rounded-xl border transition ${
                slot.shiny
                  ? 'border-brand bg-brand/15 text-brand'
                  : 'border-line bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              <Sparkles size={16} fill={slot.shiny ? 'currentColor' : 'none'} />
            </button>
          </label>
        </div>
      </div>

      {/* Movimientos */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {slot.moves.map((m, i) => (
          <EntityPicker
            key={i}
            label={`Movimiento ${i + 1}`}
            value={m}
            options={moveOptions}
            onSelect={(v) => {
              const moves = [...slot.moves] as Slot['moves']
              moves[i] = v
              onChange({ moves })
            }}
            placeholder={species ? 'Busca un movimiento…' : 'Elige antes el Pokémon'}
            disabled={!species}
            disabledHint="Elige antes el Pokémon"
            emptyText="Este Pokémon no aprende ese movimiento"
          />
        ))}
      </div>

      {/* IVs / EVs */}
      <div className="mt-4 rounded-xl bg-surface-2 p-3 shadow-pressed">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span>IVs y EVs</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } })}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:bg-line hover:text-ink"
            >
              Reiniciar EVs
            </button>
            <span className={evLeft < 0 ? 'text-red-500' : 'text-muted'}>
              {evUsed}/{MAX_EVS_TOTAL} EVs · quedan {evLeft}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {STAT_KEYS.map((k) => {
            const total = species
              ? computeStat(k, species.baseStats[k], slot.ivs[k], slot.evs[k], slot.level, slot.nature)
              : null
            const mod = natureModifier(slot.nature, k)
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span
                  className="w-8 shrink-0 font-bold"
                  style={{ color: mod > 1 ? '#e11d48' : mod < 1 ? '#2563eb' : undefined }}
                  title={mod > 1 ? 'Potenciada por la naturaleza' : mod < 1 ? 'Reducida por la naturaleza' : undefined}
                >
                  {STAT_LABELS[k]}
                </span>
                <input
                  type="number" min={0} max={MAX_IV} value={slot.ivs[k]}
                  onChange={(e) => onChange({ ivs: { ...slot.ivs, [k]: clampNum(e.target.value, 0, MAX_IV, 31) } })}
                  aria-label={`IV de ${STAT_LABELS[k]}`}
                  className="h-8 w-14 shrink-0 rounded-lg border border-line bg-bg-elevated px-1.5 text-center outline-none focus:border-brand"
                />
                <input
                  type="range" min={0} max={MAX_EV} step={4} value={slot.evs[k]}
                  onChange={(e) => onChange({ evs: { ...slot.evs, [k]: Number(e.target.value) } })}
                  aria-label={`EV de ${STAT_LABELS[k]}`}
                  className="min-w-0 flex-1 accent-[var(--brand)]"
                />
                <input
                  type="number" min={0} max={MAX_EV} step={4} value={slot.evs[k]}
                  onChange={(e) => onChange({ evs: { ...slot.evs, [k]: clampNum(e.target.value, 0, MAX_EV, 0) } })}
                  aria-label={`EV de ${STAT_LABELS[k]} (número)`}
                  className="h-8 w-16 shrink-0 rounded-lg border border-line bg-bg-elevated px-1.5 text-center outline-none focus:border-brand"
                />
                <span
                  className="w-9 shrink-0 text-right font-bold tabular-nums"
                  style={{ color: total ? statColor(total) : undefined }}
                >
                  {total ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function clampNum(raw: string, min: number, max: number, fallback: number) {
  const n = Number(raw)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

/* ------------------------------ Campos reutilizables ----------------------------- */

function Text({
  label, value, onChange, maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Opcional"
        className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  )
}
