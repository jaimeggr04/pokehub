'use client'

import { Fragment, memo, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle, ChartColumn, CheckCircle2, ChevronDown, ClipboardPaste, Dices, LogOut, Plus, RotateCcw,
  Save, Send, Undo2, X,
} from 'lucide-react'
import clsx from 'clsx'
import { ChoiceDialog, type DialogChoice } from '@/components/builder/choice-dialog'
import { ImportPanel } from '@/components/builder/import-panel'
import {
  FORMATS, MAX_SLOTS, emptySlot, evsLeft, showdownFormatLabel, slotFromBuild, slotFromRandom, slotName,
  teamSnapshot, toInput, type Slot, type SlotPatch,
} from '@/components/builder/model'
import { SaveBar, SaveCard } from '@/components/builder/save-bar'
import { pinElement, scrollToElement, topObstruction } from '@/components/builder/scroll'
import { SlotEditor } from '@/components/builder/slot-editor'
import { NAME_MAX, TeamDetails } from '@/components/builder/team-details'
import { TeamPanel } from '@/components/builder/team-panel'
import { useCatalog } from '@/components/builder/use-catalog'
import { useLeaveGuard } from '@/components/builder/use-leave-guard'
import { TeamAnalysis } from '@/components/team-analysis'
import { toast } from '@/components/ui/toast'
import { resolvePokemon } from '@/lib/pokeapi'
import { NATURE_NAMES, prettify } from '@/lib/pokemon'
import { randomTeam, type RandomBuild } from '@/lib/random-team'
import { matchAbility, parseShowdownTeam, speciesCandidates } from '@/lib/showdown'
import { loadEsIndex, resolveName, resolveNature, translate, translateType } from '@/lib/showdown-i18n'
import { createTeam, updateTeam, type TeamInput } from '@/app/actions/teams'
import type { BuildRow, TeamRow } from '@/lib/database.types'

// El análisis sólo depende de qué Pokémon hay: mover un slider de EVs no debe
// volver a pintar la tabla de tipos entera.
const MemoAnalysis = memo(TeamAnalysis)

const NO_POSITIONS: ReadonlySet<number> = new Set()
const BACK = '__back__'
const UNDO_MS = 8000

/** La acción redirige al terminar bien: esa "excepción" es la señal de éxito. */
function isRedirect(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest.startsWith('NEXT_REDIRECT')
  )
}

type FocusTarget = { kind: 'card'; key: string } | { kind: 'undo' } | { kind: 'notice' }

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
  const reduceMotion = Boolean(useReducedMotion())
  const [pending, startTransition] = useTransition()
  const { dex, catalog, dexByName, itemNames, failed: catalogFailed, retry: retryCatalog } = useCatalog()

  const [name, setName] = useState(team?.name ?? '')
  const [format, setFormat] = useState(team?.format ?? FORMATS[0])
  const [description, setDescription] = useState(team?.description ?? '')
  const [isPublic, setIsPublic] = useState(team?.is_public ?? true)
  const [slots, setSlots] = useState<Slot[]>(() =>
    builds && builds.length ? [...builds].sort((a, b) => a.slot - b.slot).map(slotFromBuild) : [emptySlot()],
  )
  // En un equipo nuevo, el primer hueco ya abierto: es lo primero que hay que rellenar.
  const [openKey, setOpenKey] = useState<string | null>(() => (editing ? null : (slots[0]?.key ?? null)))
  // Hueco recién añadido: su selector de especie se abre solo al montarse.
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState<string[] | null>(null)
  const [saveError, setSaveError] = useState<{ message: string; at: string } | null>(null)
  const [nameMissing, setNameMissing] = useState(false)
  const [rolling, setRolling] = useState<ReadonlySet<number>>(NO_POSITIONS)
  const [askSurprise, setAskSurprise] = useState(false)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [removed, setRemoved] = useState<{ slot: Slot; index: number } | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)

  const importId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const analysisRef = useRef<HTMLElement>(null)
  const cards = useRef(new Map<string, HTMLElement>())
  const pendingFocus = useRef<FocusTarget | null>(null)

  // Copias para los manejadores estables (los editores van memoizados).
  const slotsRef = useRef(slots)
  const openKeyRef = useRef(openKey)
  useEffect(() => {
    slotsRef.current = slots
    openKeyRef.current = openKey
  })

  // Cambios sin guardar: la huella de lo que se enviaría contra la del principio.
  const snapshot = teamSnapshot({ name, format, description, isPublic, slots })
  const [baseline] = useState(snapshot)
  const dirty = snapshot !== baseline
  // Un error de guardado deja de valer en cuanto se toca algo.
  const error = saveError && saveError.at === snapshot ? saveError.message : null

  const filled = slots.filter((s) => s.pokemon_id > 0)
  const surprising = rolling.size > 0

  const duplicates = useMemo(() => {
    const set = new Set<number>()
    slots.forEach((s, i) => {
      if (s.pokemon_id > 0 && slots.some((o, j) => j !== i && o.pokemon_id === s.pokemon_id)) set.add(i)
    })
    return set
  }, [slots])

  const membersKey = filled.map((s) => `${s.pokemon_id}:${s.pokemon_name}`).join('|')
  const members = useMemo(
    () =>
      membersKey
        ? membersKey.split('|').map((entry) => {
            const [id, slug] = entry.split(':')
            return { pokemonId: Number(id), name: prettify(slug) }
          })
        : [],
    [membersKey],
  )

  /* ----------------------------- Foco y desplazamiento ----------------------------- */

  // El foco se mueve después de pintar: el elemento de destino puede no existir aún.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target.kind === 'undo') undoRef.current?.focus({ preventScroll: true })
    else if (target.kind === 'notice') noticeRef.current?.focus({ preventScroll: true })
    else cards.current.get(target.key)?.querySelector<HTMLElement>('[data-slot-toggle]')?.focus({ preventScroll: true })
  })

  const registerCard = useCallback((key: string, el: HTMLElement | null) => {
    if (el) cards.current.set(key, el)
    else cards.current.delete(key)
  }, [])

  /** Lleva un hueco bajo la cabecera. Espera un frame: si es nuevo, aún no está montado. */
  const scrollToCard = useCallback(
    (key: string) => {
      requestAnimationFrame(() => {
        const el = cards.current.get(key)
        if (el) scrollToElement(el, { reduce: reduceMotion })
      })
    },
    [reduceMotion],
  )

  /* ---------------------------------- Huecos ---------------------------------- */

  const patchSlot = useCallback((key: string, changes: SlotPatch) => {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...changes } : s)))
    setJustAdded((k) => (k === key ? null : k))
  }, [])

  const toggleSlot = useCallback(
    (key: string) => {
      const opening = openKeyRef.current !== key
      setOpenKey(opening ? key : null)
      setJustAdded(null)
      if (opening) {
        scrollToCard(key)
        return
      }
      // Al plegar desde abajo del panel, la cabecera puede haber quedado por
      // encima de la pantalla: se vuelve a ella y se le devuelve el foco.
      pendingFocus.current = { kind: 'card', key }
      const el = cards.current.get(key)
      if (el && el.getBoundingClientRect().top < topObstruction()) scrollToCard(key)
    },
    [scrollToCard],
  )

  const selectSlot = useCallback(
    (key: string) => {
      setOpenKey(key)
      setJustAdded(null)
      pendingFocus.current = { kind: 'card', key }
      scrollToCard(key)
    },
    [scrollToCard],
  )

  const addSlot = useCallback(() => {
    if (slotsRef.current.length >= MAX_SLOTS) return
    const slot = emptySlot()
    setSlots((prev) => (prev.length >= MAX_SLOTS ? prev : [...prev, slot]))
    setOpenKey(slot.key)
    setJustAdded(slot.key)
    setRemoved(null)
    scrollToCard(slot.key)
  }, [scrollToCard])

  const nextSlot = useCallback(
    (key: string) => {
      const list = slotsRef.current
      const next = list[list.findIndex((s) => s.key === key) + 1]
      if (!next) {
        addSlot()
        return
      }
      setOpenKey(next.key)
      if (next.pokemon_id) {
        setJustAdded(null)
        pendingFocus.current = { kind: 'card', key: next.key }
      } else {
        setJustAdded(next.key)
      }
      scrollToCard(next.key)
    },
    [addSlot, scrollToCard],
  )

  // La tarjeta pulsada se queda bajo el dedo y es la vecina la que da la
  // vuelta. pinElement mide antes de reordenar, así que va primero.
  const moveSlot = useCallback((key: string, dir: -1 | 1, card: HTMLElement | null) => {
    const list = slotsRef.current
    const i = list.findIndex((s) => s.key === key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    if (card) pinElement(card)
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSlots(next)
  }, [])

  const removeSlot = useCallback((key: string) => {
    const list = slotsRef.current
    const index = list.findIndex((s) => s.key === key)
    if (index < 0 || list.length <= 1) return
    const slot = list[index]
    const rest = list.filter((s) => s.key !== key)
    setSlots(rest)
    setOpenKey((k) => (k === key ? null : k))
    // Un hueco vacío no merece "deshacer": se va y el foco pasa al vecino.
    if (slot.pokemon_id) {
      setRemoved({ slot, index })
      pendingFocus.current = { kind: 'undo' }
    } else {
      setRemoved(null)
      const neighbour = rest[Math.min(index, rest.length - 1)]
      if (neighbour) pendingFocus.current = { kind: 'card', key: neighbour.key }
    }
  }, [])

  function undoRemove() {
    if (!removed || slots.length >= MAX_SLOTS) return
    const { slot, index } = removed
    setSlots((prev) => (prev.length >= MAX_SLOTS ? prev : [...prev.slice(0, index), slot, ...prev.slice(index)]))
    setRemoved(null)
    pendingFocus.current = { kind: 'card', key: slot.key }
  }

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  /* -------------------------------- Sorpréndeme -------------------------------- */

  function requestSurprise() {
    if (surprising) return
    if (filled.length === 0) void surprise('replace')
    else setAskSurprise(true)
  }

  async function surprise(mode: 'fill' | 'replace') {
    const current = slotsRef.current
    const keep = mode === 'fill' ? current.filter((s) => s.pokemon_id > 0) : []
    const count = MAX_SLOTS - keep.length
    if (count <= 0) return

    // Qué huecos del panel giran mientras tanto: los libres, o todos si se empieza de cero.
    const positions = new Set<number>()
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (mode === 'replace' || !current[i]?.pokemon_id) positions.add(i)
    }
    setRolling(positions)
    setRemoved(null)
    setJustAdded(null)

    try {
      const results: (RandomBuild | null)[] = await randomTeam(
        count,
        new Set(keep.map((s) => s.pokemon_id)),
        dex,
      ).catch(() => [])
      const fresh = results.filter((b): b is RandomBuild => b !== null)
      if (fresh.length === 0) {
        toast('No se pudo generar el equipo', {
          tone: 'error',
          description: 'La PokéAPI no ha respondido. Comprueba tu conexión e inténtalo otra vez.',
        })
        return
      }

      let next: Slot[]
      if (mode === 'replace') {
        next = fresh.map((b) => slotFromRandom(b))
      } else {
        // Los huecos vacíos se rellenan en su sitio (conservan la clave y no
        // se remontan) y lo que sobre se añade al final.
        const queue = [...fresh]
        next = slotsRef.current.map((s) => {
          if (s.pokemon_id) return s
          const b = queue.shift()
          return b ? slotFromRandom(b, s.key) : s
        })
        for (const b of queue) if (next.length < MAX_SLOTS) next.push(slotFromRandom(b))
      }
      setSlots(next)
      setOpenKey(null)

      const missing = count - fresh.length
      toast(missing ? `Sorpresa a medias: ${fresh.length} de ${count}` : '¡Equipo sorpresa listo!', {
        tone: missing ? 'info' : 'success',
        description: missing
          ? 'La PokéAPI no ha respondido para todos. Vuelve a probar para completar el equipo.'
          : 'Es un punto de partida: revisa cada Pokémon y ajústalo a tu gusto.',
      })
    } finally {
      setRolling(NO_POSITIONS)
    }
  }

  const surpriseChoices: DialogChoice[] = [
    {
      label: 'Completar el equipo',
      description:
        filled.length >= MAX_SLOTS
          ? 'Ya tienes seis Pokémon: no queda hueco libre.'
          : `Mantiene tus ${filled.length} Pokémon y rellena ${MAX_SLOTS - filled.length === 1 ? 'el hueco libre' : `los ${MAX_SLOTS - filled.length} huecos libres`}.`,
      icon: <Plus size={20} aria-hidden />,
      tone: 'primary',
      disabled: filled.length >= MAX_SLOTS,
      onSelect: () => void surprise('fill'),
    },
    {
      label: 'Empezar de cero',
      description: `Sustituye a ${filled.length === 1 ? 'tu Pokémon' : `tus ${filled.length} Pokémon`} por seis al azar.`,
      icon: <Dices size={20} aria-hidden />,
      tone: 'danger',
      onSelect: () => void surprise('replace'),
    },
  ]

  /* ------------------------------ Importar Showdown ----------------------------- */

  function importFailed(message: string) {
    toast(message, { tone: 'error', description: 'Revisa el texto pegado e inténtalo otra vez.' })
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
      importFailed('No se ha reconocido ningún Pokémon en el texto pegado.')
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
      importFailed('No se han podido identificar esos Pokémon en la PokéAPI.')
      return
    }

    setSlots(resolved)
    setImportOpen(false)
    setSaveError(null)
    // Plegados: así se ve el resumen y los avisos de los seis de un vistazo.
    setOpenKey(null)
    setJustAdded(null)
    setRemoved(null)

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
    setNotice(partes)
    // El panel desaparece con el foco dentro: pasa al aviso, que se lee entero.
    pendingFocus.current = { kind: 'notice' }
  }

  /* --------------------------------- Guardar --------------------------------- */

  function fail(message: string) {
    setSaveError({ message, at: snapshot })
  }

  function save() {
    if (pending) return
    setSaveError(null)

    if (!name.trim()) {
      setNameMissing(true)
      fail('Falta el nombre del equipo.')
      nameRef.current?.focus()
      return
    }
    if (filled.length === 0) {
      fail('Añade al menos un Pokémon al equipo.')
      const first = slots[0]
      if (first) selectSlot(first.key)
      return
    }
    const overIndex = slots.findIndex((s) => evsLeft(s) < 0)
    if (overIndex >= 0) {
      const over = slots[overIndex]
      fail(`${slotName(over, overIndex)} se pasa de ${-evsLeft(over)} EVs.`)
      selectSlot(over.key)
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
      try {
        const res = team ? await updateTeam(team.id, payload) : await createTeam(payload)
        if (res?.error) {
          fail(res.error)
          toast(editing ? 'No se han podido guardar los cambios' : 'No se ha podido publicar el equipo', {
            tone: 'error',
            description: res.error,
          })
        }
      } catch (err) {
        if (isRedirect(err)) {
          // Ya no hay nada que proteger: la acción nos lleva al equipo.
          setLeaving(true)
          toast(editing ? 'Cambios guardados' : '¡Equipo publicado!', {
            tone: 'success',
            description: editing ? undefined : 'Ya lo puede ver la comunidad.',
          })
        } else {
          fail('No se ha podido conectar con el servidor.')
          toast('Sin conexión con el servidor', {
            tone: 'error',
            description: 'Tus cambios siguen aquí. Inténtalo de nuevo en unos segundos.',
          })
        }
        // La redirección la tiene que recoger Next para navegar.
        unstable_rethrow(err)
      }
    })
  }

  // Ctrl/⌘ + S guarda en vez de abrir el "Guardar página" del navegador.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /* ------------------------------ Salir sin guardar ------------------------------ */

  useLeaveGuard(dirty && !pending && !leaving, setLeaveTo)

  function leave(href: string) {
    setLeaving(true)
    if (href !== BACK) router.push(href)
    else if (window.history.length > 1) router.back()
    else router.push(team ? `/team/${team.id}` : '/home')
  }

  function cancel() {
    if (dirty) setLeaveTo(BACK)
    else leave(BACK)
  }

  const leaveChoices: DialogChoice[] = [
    {
      label: 'Salir sin guardar',
      description: editing ? 'Los cambios de este equipo se perderán.' : 'El equipo que estás creando se perderá.',
      icon: <LogOut size={20} aria-hidden />,
      tone: 'danger',
      onSelect: () => {
        if (leaveTo) leave(leaveTo)
      },
    },
    {
      label: editing ? 'Guardar cambios' : 'Publicar equipo',
      description: editing ? 'Se guardan y vas al equipo.' : 'Se publica y vas al equipo.',
      icon: editing ? <Save size={20} aria-hidden /> : <Send size={20} aria-hidden />,
      tone: 'soft',
      onSelect: save,
    },
  ]

  /* ---------------------------------- Vista ---------------------------------- */

  function openAnalysis() {
    setAnalysisOpen(true)
    requestAnimationFrame(() => {
      if (analysisRef.current) scrollToElement(analysisRef.current, { reduce: reduceMotion })
    })
  }

  const saveProps = {
    editing,
    pending,
    dirty,
    filled: filled.length,
    error,
    onSave: save,
    onCancel: cancel,
  }

  const undoRow = removed && (
    <motion.div
      key={`undo-${removed.slot.key}`}
      layout="position"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-14 items-center gap-3 rounded-card border-2 border-dashed border-line px-4 py-2 text-sm"
    >
      <span className="min-w-0 flex-1 text-muted">
        <strong className="font-semibold text-ink">{slotName(removed.slot, removed.index)}</strong> ha vuelto a su
        Poké Ball.
      </span>
      {slots.length < MAX_SLOTS && (
        <button ref={undoRef} type="button" onClick={undoRemove} className="btn btn-soft btn-sm shrink-0">
          <Undo2 size={15} aria-hidden /> Deshacer
        </button>
      )}
    </motion.div>
  )

  const reviewNotice = notice && notice.length > 1

  return (
    <div className="builder-root mx-auto max-w-[1180px] px-3 sm:px-4 md:pt-4">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Creador de equipos</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
            {editing ? 'Editar equipo' : 'Nuevo equipo'}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted [overflow-wrap:anywhere]">
            {team ? (
              <>
                Estás editando <strong className="font-semibold text-ink">«{team.name}»</strong>.
              </>
            ) : (
              'Elige hasta seis Pokémon, ajusta sus builds y compártelo con la comunidad.'
            )}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            aria-expanded={importOpen}
            aria-controls={importId}
            onClick={() => setImportOpen((v) => !v)}
            disabled={surprising}
            className={clsx('btn btn-soft', importOpen && 'bg-brand-soft text-brand')}
          >
            <ClipboardPaste size={16} aria-hidden />
            Importar<span className="max-sm:hidden"> de Showdown</span>
          </button>
          <button
            type="button"
            onClick={requestSurprise}
            disabled={surprising}
            aria-busy={surprising || undefined}
            aria-haspopup={filled.length > 0 ? 'dialog' : undefined}
            className="btn btn-soft builder-dice"
          >
            <Dices size={17} aria-hidden />
            {surprising ? 'Generando…' : 'Sorpréndeme'}
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {importOpen && (
          <motion.div
            key="import"
            id={importId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { height: { type: 'spring', stiffness: 360, damping: 40 }, opacity: { duration: 0.2 } }}
            // Margen negativo con padding: el recorte del despliegue no se come la sombra.
            className="-mx-2 overflow-hidden px-2"
          >
            <div className="pb-5 pt-0.5">
              <ImportPanel filledCount={filled.length} onImport={importShowdown} onClose={() => setImportOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          className={clsx(
            'card mb-5 flex animate-fade-up items-start gap-3 p-4 outline-none',
            reviewNotice ? 'border-warning/50 bg-warning-soft' : 'border-success/50 bg-success-soft',
          )}
        >
          <span
            aria-hidden
            className={clsx(
              'grid size-9 shrink-0 place-items-center rounded-full',
              reviewNotice ? 'bg-warning text-white dark:text-black' : 'bg-success text-white dark:text-black',
            )}
          >
            {reviewNotice ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          </span>
          <div className="min-w-0 flex-1 pt-1.5 text-sm">
            <p className="font-bold">{notice[0]}.</p>
            {notice.length > 1 && (
              <ul className="mt-1.5 space-y-1 [overflow-wrap:anywhere]">
                {notice.slice(1).map((parte) => (
                  <li key={parte} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" />
                    {parte.charAt(0).toUpperCase() + parte.slice(1)}.
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="btn btn-ghost btn-icon btn-sm -mr-1 -mt-1 text-muted hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {catalogFailed && (
        <div role="alert" className="card mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-warning/50 bg-warning-soft p-4 text-sm">
          <AlertTriangle size={18} aria-hidden className="shrink-0 text-warning" />
          <p className="min-w-0 flex-1">
            No se ha podido cargar la Pokédex completa. Puedes seguir editando lo que ya tienes.
          </p>
          <button type="button" onClick={retryCatalog} className="btn btn-soft btn-sm">
            <RotateCcw size={14} aria-hidden /> Reintentar
          </button>
        </div>
      )}

      {/* Misma rejilla que builder-skeleton.tsx: si cambia aquí, cambiarla también allí. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Primero en el DOM: en móvil el equipo va arriba; en escritorio, en la columna lateral. */}
        <aside aria-label="Resumen del equipo" className="min-w-0 lg:col-start-2 lg:row-start-1 lg:self-stretch">
          <div className="builder-rail space-y-4">
            <TeamPanel
              slots={slots}
              openKey={openKey}
              rolling={rolling}
              duplicates={duplicates}
              onSelect={selectSlot}
              onAdd={addSlot}
            >
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Tipos del equipo</h3>
                  <button
                    type="button"
                    onClick={openAnalysis}
                    className="rounded-md text-xs font-semibold text-brand hover:underline"
                  >
                    Análisis completo
                  </button>
                </div>
                <MemoAnalysis members={members} compact />
              </div>
            </TeamPanel>
            <SaveCard {...saveProps} />
          </div>
        </aside>

        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <TeamDetails
            name={name}
            format={format}
            description={description}
            isPublic={isPublic}
            nameError={nameMissing && !name.trim() ? 'Ponle un nombre al equipo antes de guardarlo.' : null}
            nameRef={nameRef}
            onName={(v) => setName(v.slice(0, NAME_MAX))}
            onFormat={setFormat}
            onDescription={setDescription}
            onPublic={setIsPublic}
          />

          <section aria-labelledby="builder-slots-title">
            <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
              <h2 id="builder-slots-title" className="text-lg font-extrabold">
                Pokémon
              </h2>
              <p className="text-xs text-muted">
                {filled.length === 0
                  ? 'Aún no hay ninguno'
                  : `${filled.length} de ${MAX_SLOTS}${duplicates.size ? ' · hay repetidos' : ''}`}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {slots.map((slot, i) => (
                <Fragment key={slot.key}>
                  {removed && removed.index === i && undoRow}
                  <SlotEditor
                    slot={slot}
                    index={i}
                    count={slots.length}
                    open={openKey === slot.key}
                    duplicate={duplicates.has(i)}
                    autoPick={justAdded === slot.key}
                    catalog={catalog}
                    onToggle={toggleSlot}
                    onPatch={patchSlot}
                    onMove={moveSlot}
                    onRemove={removeSlot}
                    onNext={nextSlot}
                    registerCard={registerCard}
                  />
                </Fragment>
              ))}
              {removed && removed.index >= slots.length && undoRow}

              {slots.length < MAX_SLOTS && (
                <motion.button
                  layout="position"
                  type="button"
                  onClick={addSlot}
                  disabled={surprising}
                  className="group flex min-h-16 w-full items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface/50 px-4 py-4 text-sm font-semibold text-muted transition-colors duration-(--dur) hover:border-brand hover:bg-brand-soft hover:text-brand disabled:opacity-60"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-surface-2 shadow-card transition-transform duration-(--dur) ease-(--ease-spring) group-hover:rotate-90">
                    <Plus size={16} strokeWidth={2.6} aria-hidden />
                  </span>
                  Añadir Pokémon
                  <span className="font-normal tabular-nums">
                    ({slots.length}/{MAX_SLOTS})
                  </span>
                </motion.button>
              )}
            </div>
          </section>

          <section ref={analysisRef} aria-labelledby="builder-analysis-title">
            <h2 id="builder-analysis-title">
              <button
                type="button"
                aria-expanded={analysisOpen}
                aria-controls="builder-analysis"
                onClick={() => setAnalysisOpen((v) => !v)}
                className="card card-hover flex w-full items-center gap-3 p-4 text-left"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <ChartColumn size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">Análisis completo</span>
                  <span className="block text-xs font-normal text-muted">
                    Debilidades, resistencias, velocidad y estadísticas del equipo
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden
                  className={clsx('shrink-0 text-muted transition-transform duration-(--dur-slow) ease-(--ease-spring)', analysisOpen && 'rotate-180')}
                />
              </button>
            </h2>
            {analysisOpen && (
              <div id="builder-analysis" className="mt-4 animate-fade-in">
                <MemoAnalysis members={members} />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Hueco para que la barra fija no tape el final de la página. */}
      <div aria-hidden className="h-16 lg:hidden" />
      <SaveBar {...saveProps} />

      <ChoiceDialog
        open={askSurprise}
        onClose={() => setAskSurprise(false)}
        title="¿Qué hacemos con tu equipo?"
        description="«Sorpréndeme» genera Pokémon al azar con builds de competitivo como punto de partida."
        choices={surpriseChoices}
      />

      <ChoiceDialog
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title={editing ? '¿Salir sin guardar los cambios?' : '¿Salir sin publicar el equipo?'}
        choices={leaveChoices}
        cancelLabel="Seguir editando"
      />
    </div>
  )
}
