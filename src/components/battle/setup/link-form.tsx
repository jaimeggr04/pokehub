'use client'

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle, ArrowRight, ClipboardPaste, Hand, History, Loader2, PlayCircle, Radio, X,
} from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'
import { DEFAULT_FORMAT, getFormat } from '@/lib/battle/formats'
import {
  LAST_TEAM_KEY, LINK_EXAMPLES, battleHref, detectLink, exampleHref, manualHref, type TeamOption,
} from '@/components/battle/setup/link'
import { TeamPickerAsync, TeamPickerSkeleton } from '@/components/battle/setup/team-picker'

function readLastTeam(): string | null {
  try {
    return window.localStorage.getItem(LAST_TEAM_KEY)
  } catch {
    return null
  }
}

function writeLastTeam(id: string | null) {
  try {
    if (id) window.localStorage.setItem(LAST_TEAM_KEY, id)
    else window.localStorage.removeItem(LAST_TEAM_KEY)
  } catch {
    // Sin almacenamiento (modo privado estricto): se elige cada vez y ya está.
  }
}

/**
 * Formulario principal de /battle: un campo para el enlace con «Pegar», el
 * equipo (opcional) y las tres salidas: seguir la partida, probar con una de
 * ejemplo o ir al modo manual.
 */
export function BattleLinkForm({
  teams,
  autoFocus = false,
}: {
  teams: Promise<TeamOption[]>
  /** Viene de la paleta de comandos («Seguir un combate»): el campo, listo para pegar. */
  autoFocus?: boolean
}) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const uid = useId()
  const inputId = `${uid}-link`
  const statusId = `${uid}-status`
  const legendId = `${uid}-team`

  const inputRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  // Mientras llega la página del combate, el botón lo dice (y se apaga solo al volver atrás).
  const [going, startGoing] = useTransition()

  const detected = useMemo(() => detectLink(text), [text])
  const invalid = touched && text.trim() !== '' && !detected
  const fieldState = detected ? 'valid' : invalid ? 'invalid' : undefined

  // El último equipo se lee al hidratar (el servidor no ve localStorage).
  useEffect(() => {
    setTeamId(readLastTeam())
  }, [])

  // Con ratón y teclado, el campo ya enfocado; en móvil no, que abriría el teclado.
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (autoFocus || fine) inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  const chooseTeam = useCallback((id: string | null) => {
    setTeamId(id)
    writeLastTeam(id)
  }, [])

  function go(href: string) {
    startGoing(() => router.push(href))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!detected) {
      inputRef.current?.focus()
      return
    }
    go(battleHref(detected, teamId))
  }

  async function paste() {
    if (!navigator.clipboard?.readText) {
      toast('Tu navegador no deja pegar desde aquí', {
        tone: 'info',
        description: 'Mantén pulsado el campo y elige «Pegar».',
      })
      inputRef.current?.focus()
      return
    }
    setPasting(true)
    try {
      const clip = (await navigator.clipboard.readText()).trim()
      if (!clip) {
        toast('No hay nada copiado', { tone: 'info', description: 'Copia antes el enlace del combate.' })
        inputRef.current?.focus()
        return
      }
      setText(clip)
      setTouched(true)
      // Si vale, el siguiente toque ya es «Seguir partida».
      if (detectLink(clip)) submitRef.current?.focus({ preventScroll: true })
      else inputRef.current?.focus()
    } catch {
      toast('No se pudo leer el portapapeles', {
        tone: 'info',
        description: 'Mantén pulsado el campo y elige «Pegar».',
      })
      inputRef.current?.focus()
    } finally {
      setPasting(false)
    }
  }

  // El modo manual hereda el formato del enlace si es uno de los conocidos.
  const manualFormat = (detected && getFormat(detected.format.id)) || DEFAULT_FORMAT
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.2 },
      }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Seguir una partida" className="card p-4 sm:p-5">
      <label htmlFor={inputId} className="block text-sm font-bold">
        Enlace del combate
      </label>

      <div className="battle-s-field mt-2" data-state={fieldState}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="url"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="play.pokemonshowdown.com/battle-…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={invalid || undefined}
          aria-describedby={statusId}
        />
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText('')
              setTouched(false)
              inputRef.current?.focus()
            }}
            aria-label="Borrar enlace"
            className="btn btn-ghost btn-icon size-11 text-muted"
          >
            <X aria-hidden size={18} />
          </button>
        ) : (
          <button type="button" onClick={paste} disabled={pasting} className="btn btn-soft h-11 shrink-0 px-4">
            {pasting ? (
              <Loader2 aria-hidden size={17} className="animate-spin" />
            ) : (
              <ClipboardPaste aria-hidden size={17} />
            )}
            Pegar
          </button>
        )}
      </div>

      {/* Qué se ha detectado, o por qué no vale. Se anuncia sin robar el foco. */}
      <div id={statusId} aria-live="polite" className="mt-2 min-h-6">
        <AnimatePresence mode="wait" initial={false}>
          {detected ? (
            <motion.div key={`ok-${detected.kind}-${detected.format.id}`} {...motionProps}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span
                  className={clsx(
                    'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold',
                    detected.kind === 'live' ? 'bg-success-soft text-success' : 'bg-brand-soft text-brand dark:text-ink',
                  )}
                >
                  {detected.kind === 'live' ? (
                    <Radio aria-hidden size={13} />
                  ) : (
                    <History aria-hidden size={13} />
                  )}
                  {detected.kind === 'live' ? 'Combate en directo' : 'Repetición'}
                </span>
                <span className="min-w-0 text-muted">
                  <span className="sr-only">Formato: </span>
                  {detected.format.label}
                </span>
              </p>
              {!detected.known && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle aria-hidden size={14} className="mt-px shrink-0" />
                  Formato sin probar: el asistente hará lo que pueda.
                </p>
              )}
            </motion.div>
          ) : invalid ? (
            <motion.div key="error" {...motionProps} className="rounded-xl bg-danger-soft p-3 text-sm">
              <p className="font-semibold text-danger">Ese enlace no es de un combate de Showdown.</p>
              <p className="mt-1 text-xs text-muted">Valen enlaces como estos:</p>
              <ul className="mt-1.5 grid gap-1.5">
                {LINK_EXAMPLES.map((example) => (
                  <li key={example}>
                    <code className="battle-s-code">{example}</code>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : (
            <motion.p key="hint" {...motionProps} className="text-xs text-muted">
              Vale el enlace del combate en directo o el de una repetición.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <fieldset className="mt-4">
        <legend id={legendId} className="flex w-full items-baseline gap-2 text-sm font-bold">
          ¿Con qué equipo juegas?
          <span className="text-xs font-medium text-muted">Opcional</span>
        </legend>
        <p className="mt-0.5 text-xs text-muted">Con tu equipo, los cálculos usan tus sets exactos.</p>
        <div className="mt-2">
          <Suspense fallback={<TeamPickerSkeleton />}>
            <TeamPickerAsync teams={teams} value={teamId} onChange={chooseTeam} labelledBy={legendId} />
          </Suspense>
        </div>
      </fieldset>

      <button ref={submitRef} type="submit" disabled={going} className="btn btn-primary btn-lg mt-4 w-full">
        {going ? <Loader2 aria-hidden size={19} className="animate-spin" /> : null}
        Seguir partida
        {!going && <ArrowRight aria-hidden size={19} />}
      </button>

      <div className="my-4 flex items-center gap-3 text-xs font-medium text-muted">
        <span aria-hidden className="h-px flex-1 bg-line" />
        ¿No estás jugando ahora?
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>

      <Link href={exampleHref()} className="btn btn-soft btn-lg w-full">
        <PlayCircle aria-hidden size={19} className="text-brand" />
        Probar con una partida de ejemplo
      </Link>

      <Link href={manualHref(manualFormat.id, teamId)} className="btn btn-ghost mt-2 w-full text-muted hover:text-ink">
        <Hand aria-hidden size={17} />
        Sin enlace: modo manual
      </Link>
    </form>
  )
}
