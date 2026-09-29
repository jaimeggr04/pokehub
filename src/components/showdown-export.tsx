'use client'

import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import { Check, ChevronDown, Copy, Download, FileText } from 'lucide-react'
import clsx from 'clsx'
import { CopyButton, useCopy } from '@/components/copy-button'
import { toast } from '@/components/ui/toast'
import { spriteUrl } from '@/lib/pokemon'

/** "Lluvia de Dragones (VGC)" -> "lluvia-de-dragones-vgc" */
export function slugify(text: string) {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'equipo-pokehub'
  )
}

const KEY_LINE = /^(Ability|Level|Shiny|Tera Type|EVs|IVs|Happiness|Gigantamax|Hidden Power|Dynamax Level|Pokeball):\s?(.*)$/
const STAT_LIST = /^(EVs|IVs)$/

/** Colorea números dentro de un reparto "252 HP / 4 Atk / 252 Spe". */
function spread(value: string) {
  return value.split(/(\d+)/).map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} className="team-code-num">
        {part}
      </span>
    ) : (
      <span key={i} className="team-code-dim">
        {part}
      </span>
    ),
  )
}

/** Resaltado ligero del formato de Showdown, línea a línea. */
function highlight(line: string, index: number): React.ReactNode {
  if (index === 0) {
    const at = line.lastIndexOf(' @ ')
    if (at === -1) return <span className="team-code-name">{line}</span>
    return (
      <>
        <span className="team-code-name">{line.slice(0, at)}</span>
        <span className="team-code-dim"> @ </span>
        <span className="team-code-item">{line.slice(at + 3)}</span>
      </>
    )
  }
  if (line.startsWith('- ')) {
    return (
      <>
        <span className="team-code-dash">- </span>
        {line.slice(2)}
      </>
    )
  }
  const nature = line.match(/^(\w+) Nature$/)
  if (nature) {
    return (
      <>
        <span className="team-code-nature">{nature[1]}</span>
        <span className="team-code-dim"> Nature</span>
      </>
    )
  }
  const pair = line.match(KEY_LINE)
  if (pair) {
    return (
      <>
        <span className="team-code-dim">{pair[1]}: </span>
        {STAT_LIST.test(pair[1]) ? spread(pair[2]) : pair[2]}
      </>
    )
  }
  return line
}

export interface ShowdownMember {
  pokemonId: number
  name: string
}

/**
 * El equipo en formato de Pokémon Showdown: copiar todo, descargar un .txt o
 * copiar un set suelto. En móvil empieza plegado (son unas 50 líneas).
 * `members` va en el mismo orden que los bloques del texto y pone el sprite.
 */
export function ShowdownExport({
  text,
  teamName,
  members = [],
}: {
  text: string
  teamName: string
  members?: ShowdownMember[]
}) {
  const reduceMotion = useReducedMotion()
  const bodyId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const previousHeight = useRef<number | null>(null)
  const [expanded, setExpanded] = useState(false)

  const blocks = text.split(/\n{2,}/).filter((block) => block.trim())
  const filename = `${slugify(teamName)}.txt`
  const lineCount = text ? text.split('\n').length : 0
  const collapsible = blocks.length > 1

  // Se anima la altura real entre plegado y desplegado (una sola vez por clic).
  useLayoutEffect(() => {
    const el = bodyRef.current
    const from = previousHeight.current
    previousHeight.current = null
    if (!el || from === null || reduceMotion) return
    const to = el.offsetHeight
    if (Math.abs(from - to) < 2) return
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 450,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
    })
  }, [expanded, reduceMotion])

  function toggle() {
    previousHeight.current = bodyRef.current?.offsetHeight ?? null
    const next = !expanded
    setExpanded(next)
    // Al plegar, el botón sube con el contenido: que no se quede fuera de la vista.
    if (!next) {
      requestAnimationFrame(() =>
        toggleRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }),
      )
    }
  }

  function download() {
    try {
      const blob = new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Safari necesita que la URL siga viva un momento tras el clic.
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      toast('Descarga lista', { tone: 'success', description: filename })
    } catch {
      toast('No se pudo descargar el archivo', { tone: 'error', description: 'Prueba a copiar el texto.' })
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted shadow-card">
            <FileText size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold">{filename}</p>
            <p className="text-xs text-muted">
              {blocks.length} {blocks.length === 1 ? 'set' : 'sets'} · {lineCount} líneas
            </p>
          </div>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <CopyButton
            text={text}
            label="Copiar"
            copiedLabel="¡Copiado!"
            size="sm"
            className="flex-1 sm:flex-none"
            toastMessage="Equipo copiado"
            toastDescription="En Showdown: Teambuilder › New Team › Import from text."
          />
          <button type="button" onClick={download} className="btn btn-soft btn-sm flex-1 sm:flex-none">
            <Download size={15} aria-hidden />
            Descargar .txt
          </button>
        </div>
      </div>

      <div
        id={bodyId}
        ref={bodyRef}
        className={clsx('team-code-body', collapsible && !expanded && 'max-md:max-h-[19rem]')}
      >
        <ul className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2 xl:grid-cols-3">
          {blocks.map((block, i) => (
            <CodeBlock
              key={i}
              block={block}
              slot={i + 1}
              member={blocks.length === members.length ? members[i] : undefined}
            />
          ))}
        </ul>
        {collapsible && !expanded && (
          <div aria-hidden className="team-code-fade pointer-events-none absolute inset-x-0 bottom-0 h-24 md:hidden" />
        )}
      </div>

      {collapsible && (
        <button
          ref={toggleRef}
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex h-12 w-full items-center justify-center gap-1.5 border-t border-line text-sm font-semibold text-muted transition-colors hover:text-ink md:hidden"
        >
          {expanded ? 'Mostrar menos' : `Ver los ${blocks.length} sets`}
          <ChevronDown
            size={16}
            aria-hidden
            className={clsx('transition-transform duration-(--dur) ease-(--ease-out-expo)', expanded && 'rotate-180')}
          />
        </button>
      )}
    </div>
  )
}

function CodeBlock({ block, slot, member }: { block: string; slot: number; member?: ShowdownMember }) {
  const { copied, copy } = useCopy()
  const lines = block.split('\n')
  const name = member?.name ?? lines[0].split(' @ ')[0]

  return (
    <li className="team-code-block min-w-0">
      <div className="flex h-11 items-center gap-2 pl-3 pr-1.5">
        {member && (
          <Image
            src={spriteUrl(member.pokemonId)}
            alt=""
            width={96}
            height={96}
            unoptimized
            draggable={false}
            className="-my-2 size-11 shrink-0 object-contain [image-rendering:pixelated]"
          />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Set {slot}</span>
        <button
          type="button"
          onClick={() => copy(block, { message: `Set de ${name} copiado` })}
          data-copied={copied || undefined}
          aria-label={`Copiar el set de ${name}`}
          title="Copiar este set"
          className="team-code-copy ml-auto grid size-10 shrink-0 place-items-center rounded-full"
        >
          {copied ? (
            <Check size={16} strokeWidth={2.75} aria-hidden className="animate-pop" />
          ) : (
            <Copy size={16} aria-hidden />
          )}
        </button>
      </div>
      {/* Saltos de línea reales: si se selecciona a mano, se copia tal cual. */}
      <pre className="team-code-pre px-3 pb-3 font-mono sm:px-4 sm:pb-4">
        <code>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {highlight(line, i)}
              {i < lines.length - 1 && '\n'}
            </Fragment>
          ))}
        </code>
      </pre>
    </li>
  )
}
