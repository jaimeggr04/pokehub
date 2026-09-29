'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { BigHeart } from '@/components/heart-burst'
import { LikeHeart, useLike } from '@/components/like-button'
import { ShareButton } from '@/components/share-button'
import { useSelectedPokemon } from '@/components/selected-pokemon'
import { TYPE_COLORS, itemSpriteUrl, prettify, spriteUrl } from '@/lib/pokemon'
import { compactNumber, timeAgo } from '@/lib/format'
import type { BuildRow, TeamWithAuthor } from '@/lib/database.types'

const PARTY_SIZE = 6
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_SLOP = 28
// Lo que ya hace algo al pulsarlo no cuenta para el doble toque.
const INTERACTIVE = 'a, button, input, textarea, select, label, [role="button"]'

const TYPES_ES: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta',
  ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador',
  psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón',
  dark: 'Siniestro', steel: 'Acero', fairy: 'Hada', stellar: 'Astral',
}

export function TeamCard({ team, index = 0 }: { team: TeamWithAuthor; index?: number }) {
  const { select, build: selected } = useSelectedPokemon()
  const like = useLike(team.id, Boolean(team.liked_by_me), team.like_count)
  const [bigHeart, setBigHeart] = useState(0)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const pointerType = useRef('mouse')
  const titleId = useId()

  const party = [...team.builds].sort((a, b) => a.slot - b.slot).slice(0, PARTY_SIZE)
  const href = `/team/${team.id}`
  const profileHref = `/u/${team.author.username}`
  const displayName = team.author.display_name?.trim()
  const showDisplayName = !!displayName && displayName.toLowerCase() !== team.author.username.toLowerCase()
  const description = team.description?.trim()

  function isInteractive(e: React.SyntheticEvent<HTMLElement>) {
    const hit = e.target instanceof Element ? e.target.closest(INTERACTIVE) : null
    return Boolean(hit && e.currentTarget.contains(hit))
  }

  // Doble toque o doble clic en el cuerpo de la tarjeta: sólo da "me gusta",
  // nunca lo quita, como en Instagram.
  function likeWithHeart() {
    like.like()
    setBigHeart((n) => n + 1)
  }

  // En táctil se mide a mano porque Safari en iOS no emite dblclick de forma
  // fiable. Si el dedo desplaza la página llega pointercancel y no cuenta.
  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse') return
    if (isInteractive(e)) {
      lastTap.current = null
      return
    }
    const prev = lastTap.current
    if (
      prev &&
      e.timeStamp - prev.time < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_SLOP
    ) {
      lastTap.current = null
      likeWithHeart()
      return
    }
    lastTap.current = { time: e.timeStamp, x: e.clientX, y: e.clientY }
  }

  return (
    <article
      aria-labelledby={titleId}
      data-team-id={team.id}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        lastTap.current = null
      }}
      // Con ratón, el dblclick nativo respeta la velocidad de doble clic del
      // sistema. Algunos navegadores también lo emiten al tocar: eso ya lo cubre
      // onPointerUp, así que aquí se ignora.
      onDoubleClick={(e) => {
        if (pointerType.current === 'mouse' && !isInteractive(e)) likeWithHeart()
      }}
      // Sin esto, el doble clic seleccionaría una palabra de la descripción.
      onMouseDown={(e) => {
        if (e.detail > 1 && !isInteractive(e)) e.preventDefault()
      }}
      style={{ '--i': index } as React.CSSProperties}
      className="card card-hover stagger-item relative touch-manipulation p-4 sm:p-5"
    >
      <header className="flex items-start gap-3">
        {/* Duplica el enlace del nombre: fuera del orden de tabulación y del árbol accesible. */}
        <Link href={profileHref} tabIndex={-1} aria-hidden className="pressable shrink-0 rounded-full">
          <Avatar src={team.author.avatar_url} name={team.author.username} size={42} />
        </Link>

        <div className="min-w-0 flex-1 pt-0.5">
          <Link
            href={profileHref}
            className="block truncate text-sm font-bold leading-tight transition-colors hover:text-brand"
          >
            {showDisplayName ? displayName : `@${team.author.username}`}
          </Link>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted">
            {showDisplayName && (
              <>
                <span className="truncate">@{team.author.username}</span>
                <span aria-hidden>·</span>
              </>
            )}
            {/* La hora relativa depende del reloj: puede diferir un minuto entre servidor y cliente. */}
            <time dateTime={team.created_at} className="shrink-0" suppressHydrationWarning>
              {timeAgo(team.created_at)}
            </time>
          </p>
        </div>

        <FormatChip format={team.format} />
      </header>

      <div className="mt-3">
        <h2 id={titleId} className="text-[17px] font-extrabold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-lg">
          {/* El botón "Ver equipo" es el enlace para teclado; éste es el atajo del ratón. */}
          <Link href={href} tabIndex={-1} className="transition-colors hover:text-brand">
            {team.name}
          </Link>
        </h2>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">{description}</p>
        )}
      </div>

      <ul className="mt-4 grid grid-cols-6 gap-1.5 sm:gap-2.5" aria-label={`Equipo de ${party.length} Pokémon`}>
        {Array.from({ length: PARTY_SIZE }, (_, slot) => {
          const build = party[slot]
          return build ? (
            <li key={build.id}>
              <PartySlot
                build={build}
                slot={slot}
                active={selected?.id === build.id}
                onSelect={() => select(build, team.name)}
              />
            </li>
          ) : (
            <li key={`empty-${slot}`} aria-hidden>
              <span
                style={{ '--s': slot } as React.CSSProperties}
                className="feed-slot-empty grid aspect-square w-full place-items-center rounded-xl border border-dashed border-line"
              >
                <PokeballGlyph className="size-2/5 text-muted opacity-40" />
              </span>
            </li>
          )
        })}
      </ul>

      {/* Con contadores muy largos en 360 px, "Ver equipo" baja de línea en vez de desbordar. */}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <div className="-ml-2 flex min-w-0 items-center text-muted">
          <button
            type="button"
            onClick={like.toggle}
            aria-pressed={like.liked}
            aria-label={`Me gusta (${like.count})`}
            title={like.liked ? 'Quitar me gusta' : 'Me gusta'}
            className="btn btn-ghost h-10 gap-1.5 px-2.5 hover:text-ink"
          >
            <span className={clsx('flex items-center gap-1.5 transition-colors', like.liked && 'text-brand')}>
              <LikeHeart liked={like.liked} burst={like.burst} size={19} />
              <AnimatedNumber value={like.count} className="text-sm font-semibold" />
            </span>
          </button>

          <Link
            href={`${href}#comentarios`}
            aria-label={`${compactNumber(team.comment_count)} comentarios`}
            title="Comentarios"
            className="btn btn-ghost h-10 gap-1.5 px-2.5 hover:text-ink"
          >
            <MessageCircle size={19} aria-hidden />
            <span className="text-sm font-semibold tabular-nums">{compactNumber(team.comment_count)}</span>
          </Link>

          <ShareButton path={href} title={team.name} variant="icon" />
        </div>

        <Link href={href} className="btn btn-primary group/cta ml-auto h-10 shrink-0 gap-1.5 px-4 text-[13px]">
          Ver equipo<span className="sr-only"> «{team.name}»</span>
          <ArrowRight
            size={16}
            aria-hidden
            className="transition-transform duration-(--dur) ease-(--ease-spring) group-hover/cta:translate-x-1 group-focus-visible/cta:translate-x-1"
          />
        </Link>
      </footer>

      <BigHeart trigger={bigHeart} />
    </article>
  )
}

function PartySlot({
  build,
  slot,
  active,
  onSelect,
}: {
  build: BuildRow
  slot: number
  active: boolean
  onSelect: () => void
}) {
  const [itemFailed, setItemFailed] = useState(false)
  const name = prettify(build.pokemon_name)
  const nickname = build.nickname?.trim()
  const label = nickname && nickname.toLowerCase() !== name.toLowerCase() ? `${nickname} (${name})` : name
  const item = itemFailed ? null : itemSpriteUrl(build.item)
  const tera = build.tera_type ? TYPE_COLORS[build.tera_type] : undefined
  const teraName = build.tera_type ? (TYPES_ES[build.tera_type] ?? prettify(build.tera_type)) : null

  const details = [
    label,
    build.shiny && 'variocolor',
    build.item && `con ${prettify(build.item)}`,
    teraName && `teratipo ${teraName}`,
  ].filter(Boolean)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={label}
      style={{ '--s': slot } as React.CSSProperties}
      className="feed-slot relative block aspect-square w-full rounded-xl bg-surface-2 shadow-card"
    >
      <span className="feed-slot-pop absolute inset-0">
        <Image
          src={spriteUrl(build.pokemon_id, build.shiny)}
          alt=""
          width={96}
          height={96}
          unoptimized
          draggable={false}
          className="feed-sprite pointer-events-none absolute left-1/2 top-1/2 h-[118%] w-[118%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      </span>

      {tera && (
        <span
          aria-hidden
          className="absolute left-1.5 top-1.5 size-2 rotate-45 rounded-[2px] shadow-[0_0_0_1.5px_var(--surface-2)]"
          style={{ backgroundColor: tera.bg }}
        />
      )}

      {build.shiny && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-bg-elevated text-warning shadow-card"
        >
          <Sparkles size={10} strokeWidth={2.5} />
        </span>
      )}

      {item && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-bg-elevated shadow-card sm:size-6"
        >
          <Image
            src={item}
            alt=""
            width={30}
            height={30}
            unoptimized
            draggable={false}
            onError={() => setItemFailed(true)}
            className="size-full [image-rendering:pixelated]"
          />
        </span>
      )}

      <span className="sr-only">{details.join(', ')}</span>
    </button>
  )
}

// Color de la ficha de formato: se toma de la paleta de tipos para que cada
// formato tenga su tono reconocible. El orden importa ("Doubles OU" es dobles).
const FORMAT_TONES: [RegExp, string][] = [
  [/\bvgc\b/i, TYPE_COLORS.water.bg],
  [/\b(doubles|dobles)\b/i, TYPE_COLORS.ice.bg],
  [/\b(ubers|ag)\b/i, TYPE_COLORS.poison.bg],
  [/\b(little ?cup|lc)\b/i, TYPE_COLORS.fairy.bg],
  [/\bmono/i, TYPE_COLORS.ground.bg],
  [/\b(singles|ou|uu|ru|nu|pu|zu)\b/i, TYPE_COLORS.fire.bg],
  [/\bcasual\b/i, TYPE_COLORS.grass.bg],
]

function FormatChip({ format }: { format: string }) {
  const label = format.trim()
  if (!label) return null
  const tone = FORMAT_TONES.find(([pattern]) => pattern.test(label))?.[1] ?? TYPE_COLORS.normal.bg

  return (
    <span
      title={`Formato: ${label}`}
      style={{ '--chip': tone } as React.CSSProperties}
      className="feed-format inline-flex h-6 max-w-[8.5rem] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold sm:max-w-[11rem]"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--chip)" />
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Pokéball de trazo (currentColor): sirve sobre cualquier fondo, también sobre el de marca. */
export function PokeballGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12H9M15 12h6.5" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Esqueleto con la misma geometría que TeamCard: al cargar no salta nada. */
export function TeamCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      aria-hidden
      style={{ '--i': index } as React.CSSProperties}
      className="card stagger-item p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-[42px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4.5 w-3/5 rounded-md" />
        <Skeleton className="h-3.5 w-11/12 rounded-md" />
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1.5 sm:gap-2.5">
        {Array.from({ length: PARTY_SIZE }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="h-8 w-14 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  )
}
