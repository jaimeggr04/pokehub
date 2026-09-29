import { Skeleton } from '@/components/ui/skeleton'
import { BATTLE_S_CONTAINER, BattleHero } from '@/components/battle/setup/battle-hero'
import { BattleSteps } from '@/components/battle/setup/steps'
import { LinkHelp } from '@/components/battle/setup/link-help'

/**
 * Réplica de /battle mientras llega. Lo que no depende de datos (cabecera,
 * pasos y guía) sale ya de verdad; sólo el formulario es esqueleto.
 */
export default function Loading() {
  return (
    <div className={BATTLE_S_CONTAINER}>
      <p role="status" className="sr-only">
        Cargando el asistente de partida…
      </p>
      <div className="battle-s-grid">
        <BattleHero className="battle-s-area-hero" />
        <BattleSteps className="battle-s-area-steps" />
        <div aria-hidden className="battle-s-area-form card p-4 sm:p-5">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="mt-2 h-[3.25rem] w-full rounded-2xl" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-md" />
          <Skeleton className="mt-5 h-4 w-44 rounded-md" />
          <div className="mt-3 flex gap-2 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[4.75rem] w-[9.5rem] shrink-0 rounded-[0.875rem]" />
            ))}
          </div>
          <Skeleton className="mt-4 h-12 w-full rounded-full" />
          <Skeleton className="mt-10 h-12 w-full rounded-full" />
          <Skeleton className="mt-2 h-11 w-full rounded-full" />
        </div>
        <LinkHelp className="battle-s-area-help" />
      </div>
    </div>
  )
}
