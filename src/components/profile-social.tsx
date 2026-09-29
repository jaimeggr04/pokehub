'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Link2, Pencil, Share2 } from 'lucide-react'
import clsx from 'clsx'
import { FollowButton } from '@/components/follow-button'
import { MessageUserButton } from '@/components/message-user-button'
import { useShare } from '@/components/share-button'
import { AnimatedNumber } from '@/components/ui/animated-number'

export type ProfileCounts = {
  teams: number
  followers: number
  following: number
  likesReceived: number
}

/**
 * Acciones y contadores de la cabecera. Van juntos porque el botón de seguir
 * mueve el contador de seguidores al instante, sin esperar al servidor.
 *
 * Devuelve dos hermanos (acciones y contadores) que se colocan cada uno en su
 * área de la rejilla de la cabecera.
 */
export function ProfileSocial({
  targetId,
  username,
  isMe,
  following,
  counts,
}: {
  targetId: string
  username: string
  isMe: boolean
  /** Si quien mira ya sigue a este entrenador, según el servidor. */
  following: boolean
  counts: ProfileCounts
}) {
  // Lo que marca el botón ahora mismo. El ajuste se calcula contra lo que dijo
  // el servidor: cuando la revalidación trae el recuento nuevo (y `following`
  // coincide con el botón), la diferencia vuelve sola a cero sin sumar dos veces.
  const [followingNow, setFollowingNow] = useState(following)
  const followers = Math.max(0, counts.followers + Number(followingNow) - Number(following))

  const stats = [
    { key: 'teams', label: 'Equipos', value: counts.teams },
    { key: 'followers', label: 'Seguidores', value: followers },
    { key: 'following', label: 'Siguiendo', value: counts.following },
    {
      key: 'likes',
      label: (
        <>
          Me gusta<span className="max-sm:sr-only"> recibidos</span>
        </>
      ),
      value: counts.likesReceived,
    },
  ]

  return (
    <>
      <div className="profile-hero-actions">
        {isMe ? (
          <Link href="/settings" className="btn btn-soft">
            <Pencil size={16} aria-hidden className="shrink-0" />
            Editar perfil
          </Link>
        ) : (
          <>
            <FollowButton
              targetId={targetId}
              following={following}
              username={username}
              size="md"
              onFollowingChange={setFollowingNow}
            />
            <MessageUserButton targetId={targetId} username={username} />
          </>
        )}
      </div>

      <dl className="profile-stats">
        {stats.map((stat) => (
          <div key={stat.key} className="profile-stat">
            <dt className="mt-0.5 max-w-full truncate text-[11px] font-medium text-muted sm:text-xs">{stat.label}</dt>
            <dd>
              <AnimatedNumber value={stat.value} countUp className="text-lg font-extrabold leading-tight sm:text-xl" />
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}

/**
 * Compartir el perfil desde la banda. Con la hoja nativa donde existe (móvil)
 * y copiando el enlace en el resto; en móvil sólo se ve el icono.
 */
export function ProfileShareButton({ username, name }: { username: string; name: string }) {
  const { share, copied, canShare } = useShare(`/u/${username}`, `${name} (@${username}) en PokeHub`)
  const label = copied ? 'Enlace copiado' : canShare ? 'Compartir perfil' : 'Copiar enlace'
  const Icon = copied ? Check : canShare ? Share2 : Link2

  return (
    <button type="button" onClick={share} title={label} className="profile-band-btn">
      {/* La key vuelve a montar el icono en cada cambio para que entre con un pop. */}
      <Icon key={copied ? 'ok' : 'idle'} size={17} aria-hidden className={clsx('shrink-0', copied && 'animate-pop')} />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  )
}
