import { Swords } from 'lucide-react'
import clsx from 'clsx'

/** Contenedor de la portada; loading.tsx usa el mismo para no dar saltos. */
export const BATTLE_S_CONTAINER = 'mx-auto w-full max-w-5xl px-3 sm:px-4 md:pt-4'

/** Qué hace el asistente, en dos líneas. */
export function BattleHero({ className }: { className?: string }) {
  return (
    <header className={clsx('battle-s-hero', className)}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        <Swords size={13} strokeWidth={2.75} aria-hidden className="text-brand" />
        Asistente de partida
      </p>
      <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
        Tu <span className="text-gradient-brand">copiloto</span> para Showdown
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted sm:text-base">
        Sigue tu combate en directo, adivina el equipo rival y te dice qué traer, quién se mueve antes y
        qué KO tienes.
      </p>
    </header>
  )
}
