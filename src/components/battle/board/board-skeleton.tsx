import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { Skeleton } from '@/components/ui/skeleton'

/*
 * Réplica del tablero mientras llega el combate: misma cabecera, mismo campo
 * (dos huecos por lado) y los primeros consejos, con las mismas medidas que
 * las piezas reales para que nada salte al cargar. Sin 'use client': la usan
 * también los loading.tsx del servidor.
 */

function MonSkeleton() {
  return (
    <div className="flex min-h-[6.5rem] flex-col gap-2 rounded-[0.875rem] border border-line bg-bg-elevated p-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

export function BoardSkeleton({ label, withDock = false }: { label: string; withDock?: boolean }) {
  return (
    <div className="mx-auto max-w-[1100px] space-y-3 px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        {label}
      </p>

      <div aria-hidden className="space-y-3">
        {/* Cabecera: formato + conexión, jugadores con el turno en medio. */}
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-10 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
            <div className="flex flex-col items-end space-y-1.5">
              <Skeleton className="h-3 w-10 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <div className="space-y-3">
            <div className="flex min-h-11 items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="battle-arena space-y-2 p-2.5 sm:p-3">
              <Skeleton className="h-3 w-24 rounded-md" />
              <div className="grid grid-cols-2 gap-2">
                <MonSkeleton />
                <MonSkeleton />
              </div>
              <div className="grid place-items-center py-2">
                <PokeballSpinner size={40} label={label} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MonSkeleton />
                <MonSkeleton />
              </div>
              <Skeleton className="h-3 w-10 rounded-md" />
            </div>

            <div className="flex min-h-11 items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-5 w-40 rounded-md" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-14 items-center gap-3 rounded-[0.875rem] border border-line bg-bg-elevated px-4">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <Skeleton className="h-4 flex-1 rounded-md" style={{ maxWidth: `${80 - i * 15}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex min-h-11 items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-12 rounded-card" />
            <Skeleton className="h-12 rounded-card" />
          </div>
        </div>

        {withDock && (
          <div className="battle-dock">
            <Skeleton className="h-[7.25rem] rounded-card" />
          </div>
        )}
      </div>
    </div>
  )
}
