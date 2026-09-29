'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import { IdCard, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { CryButton } from '@/components/cry-button'
import { PokeballIcon } from '@/components/pokeball'
import { cryUrl, prettify, spriteUrl } from '@/lib/pokemon'
import type { PartnerPokemon } from '@/lib/achievements'

/**
 * Ficha de entrenador, como la de los juegos: nº de ID y el Pokémon compañero
 * (el más usado en sus equipos). Todo llega calculado del servidor; aquí sólo
 * vive el salto del compañero al escuchar su grito.
 */
export function ProfileTrainerCard({
  trainerNo,
  partner,
  isMe,
  className,
}: {
  trainerNo: string
  partner: PartnerPokemon | null
  isMe: boolean
  className?: string
}) {
  const titleId = useId()
  const [hops, setHops] = useState(0)
  const [spriteFailed, setSpriteFailed] = useState(false)
  const name = partner ? prettify(partner.name) : null

  return (
    <section
      aria-labelledby={titleId}
      className={clsx('profile-idcard card overflow-hidden p-4 pt-5 sm:p-5 sm:pt-6', className)}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        <IdCard size={17} aria-hidden />
        Ficha de entrenador
      </h2>

      <div className="mt-4 flex items-center gap-4">
        <div className="profile-stage">
          {partner && !spriteFailed ? (
            <span aria-hidden className="profile-partner">
              <Image
                src={spriteUrl(partner.id, partner.shiny)}
                alt=""
                width={96}
                height={96}
                unoptimized
                draggable={false}
                onError={() => setSpriteFailed(true)}
                data-hop={hops > 0 ? hops % 2 : undefined}
                className="profile-partner-sprite pointer-events-none absolute left-1/2 top-1/2 size-[7.5rem] max-w-none -translate-x-1/2 -translate-y-[58%] [image-rendering:pixelated]"
              />
            </span>
          ) : (
            <PokeballIcon className="relative size-11 -translate-y-1 animate-float" />
          )}

          {partner?.shiny && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 grid size-6 animate-pop place-items-center rounded-full bg-bg-elevated text-warning shadow-card"
            >
              <Sparkles size={13} strokeWidth={2.5} />
            </span>
          )}

          {partner && name && (
            <CryButton
              src={cryUrl(partner.id)}
              name={name}
              size="sm"
              onPlay={() => setHops((n) => n + 1)}
              className="absolute! -bottom-2 -right-2"
            />
          )}
        </div>

        <dl className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 lg:gap-3">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span aria-hidden>Nº ID</span>
              <span className="sr-only">Número de ID</span>
            </dt>
            <dd className="profile-idno mt-0.5 text-2xl font-extrabold leading-none text-ink">{trainerNo}</dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Compañero</dt>
            {partner && name ? (
              <dd className="mt-1">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-base font-bold leading-tight">{name}</span>
                  {partner.shiny && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-semibold text-warning">
                      <Sparkles size={11} strokeWidth={2.5} aria-hidden />
                      Variocolor
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{usageText(partner, isMe)}</span>
              </dd>
            ) : (
              <dd className="mt-1">
                <span className="block text-base font-bold leading-tight">Todavía sin compañero</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {isMe
                    ? 'Tu Pokémon más usado en tus equipos será tu compañero.'
                    : 'Aparecerá cuando publique su primer equipo.'}
                </span>
              </dd>
            )}
          </div>
        </dl>
      </div>
    </section>
  )
}

function usageText(partner: PartnerPokemon, isMe: boolean): string {
  const whose = isMe ? 'tus' : 'sus'
  if (partner.totalTeams === 1) return isMe ? 'En tu único equipo' : 'En su único equipo'
  if (partner.teams === partner.totalTeams) return `En todos ${whose} equipos`
  return `En ${partner.teams} de ${whose} ${partner.totalTeams} equipos`
}
