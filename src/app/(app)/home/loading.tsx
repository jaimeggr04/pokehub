import { Skeleton } from '@/components/ui/skeleton'
import { TeamCardSkeleton } from '@/components/team-card'

/** Réplica de la página de inicio mientras carga: misma rejilla, mismos huecos. */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-[1700px] gap-5 px-3 sm:px-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_23rem] 2xl:grid-cols-[24rem_minmax(0,1fr)_25rem] 2xl:gap-6">
      <p role="status" className="sr-only">
        Cargando el inicio…
      </p>

      <aside aria-hidden className="hidden lg:block">
        <div className="feed-rail">
          <div className="card flex min-h-[420px] flex-col items-center justify-center gap-3 p-8">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-52 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
        </div>
      </aside>

      <section aria-hidden className="mx-auto w-full min-w-0 max-w-[680px] md:pt-4 lg:max-w-[760px]">
        {/* Saludo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className="size-14 shrink-0 rounded-full sm:size-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-44 rounded-md sm:h-7" />
            <Skeleton className="h-3.5 w-full max-w-72 rounded-md" />
          </div>
        </div>

        {/* Historias de entrenadores (sólo por debajo de xl) */}
        <div className="-mx-3 mt-5 sm:mx-0 xl:hidden">
          <div className="flex h-10 items-center px-3 sm:px-0">
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <div className="flex gap-1 overflow-hidden px-3 pb-1 pt-1">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 px-1 py-1.5">
                <Skeleton className="size-[67px] rounded-full" />
                <Skeleton className="h-2.5 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Pestañas */}
        <Skeleton className="mb-4 mt-5 h-11 rounded-full" />

        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <TeamCardSkeleton key={i} index={i} />
          ))}
        </div>
      </section>

      <aside aria-hidden className="hidden xl:block">
        <div className="feed-rail">
          <Skeleton className="h-11 shrink-0 rounded-full" />
          <div className="card space-y-2 p-4">
            <Skeleton className="mx-auto mb-3 h-4 w-52 rounded-md" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[52px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-52 shrink-0 rounded-card" />
        </div>
      </aside>
    </div>
  )
}
