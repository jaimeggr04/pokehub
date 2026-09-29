import { Skeleton } from '@/components/ui/skeleton'

/**
 * Réplica del creador mientras carga: misma rejilla y mismos huecos que
 * team-builder.tsx, para que nada salte al llegar la página. Si cambia la
 * maqueta allí, hay que cambiarla también aquí.
 */
export function BuilderSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[1180px] px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        {label}
      </p>

      <div aria-hidden>
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-8 w-56 rounded-lg md:h-9" />
            <Skeleton className="h-3.5 w-72 max-w-[80vw] rounded-md" />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Skeleton className="h-11 rounded-full sm:w-44" />
            <Skeleton className="h-11 rounded-full sm:w-40" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
          {/* Panel del equipo */}
          <div className="lg:col-start-2 lg:row-start-1">
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-3 w-8 rounded-md" />
              </div>
              <Skeleton className="mb-3 h-1.5 rounded-full" />
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2 lg:grid-cols-3 lg:gap-2.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-2xl lg:aspect-[5/6]" />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" />
                ))}
              </div>
            </div>
            <div className="card mt-4 hidden space-y-2 p-4 lg:block">
              <Skeleton className="h-3 w-32 rounded-md" />
              <Skeleton className="h-12 rounded-full" />
              <Skeleton className="h-11 rounded-full" />
            </div>
          </div>

          <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
            {/* Datos del equipo */}
            <div className="card space-y-4 p-4 sm:p-5">
              <Skeleton className="h-5 w-40 rounded-md" />
              <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>

            {/* Huecos */}
            <Skeleton className="h-5 w-32 rounded-md" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="card flex items-center gap-3 p-3.5">
                <Skeleton className="size-14 shrink-0 rounded-2xl sm:size-16" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-full max-w-sm rounded-md" />
                </div>
                <Skeleton className="size-9 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
