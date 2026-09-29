'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { PokeballGlyph } from '@/components/team-card'
import { spriteCandidates } from '@/lib/battle/dex'

/**
 * Sprite de Showdown por nombre de especie ("Charizard-Mega-Y"). Prueba
 * varias carpetas porque las megaevoluciones nuevas de Champions no están en
 * todas; si ninguna tiene la imagen, deja una pokéball de trazo.
 */
export function ShowdownSprite({
  species,
  size = 64,
  className,
  flip = false,
}: {
  species: string
  size?: number
  className?: string
  /** Mirando a la izquierda (los del rival, como en los combates). */
  flip?: boolean
}) {
  const candidates = spriteCandidates(species)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => setAttempt(0), [species])

  if (attempt >= candidates.length) {
    return (
      <span
        aria-hidden
        className={clsx('grid place-items-center text-muted', className)}
        style={{ width: size, height: size }}
      >
        <PokeballGlyph className="size-1/2 opacity-40" />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- CDN externa con respaldo en cadena: next/image no aporta nada aquí.
    <img
      src={candidates[attempt]}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setAttempt((n) => n + 1)}
      className={clsx('object-contain [image-rendering:pixelated]', flip && '-scale-x-100', className)}
      style={{ width: size, height: size }}
    />
  )
}
