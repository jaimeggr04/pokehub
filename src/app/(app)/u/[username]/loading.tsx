import { Skeleton } from '@/components/ui/skeleton'
import { TeamCardSkeleton } from '@/components/team-card'

/**
 * Réplica del perfil mientras carga: mismas clases de rejilla y de cabecera
 * que page.tsx, así nada salta al llegar los datos. La banda es la real: no
 * depende de nadie y evita un bloque gris enorme.
 */
export default function Loading() {
  return (
    <div className="profile-layout mx-auto max-w-[1160px] px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        Cargando el perfil…
      </p>

      <div aria-hidden className="profile-hero card">
        <div className="profile-band" />

        <div className="profile-hero-body">
          <span className="profile-avatar">
            <span className="skeleton block rounded-full" />
          </span>

          <div className="profile-hero-id space-y-2.5">
            <Skeleton className="h-7 w-48 rounded-md md:h-8" />
            <Skeleton className="h-4 w-64 max-w-full rounded-md" />
          </div>

          <div className="profile-hero-bio space-y-2">
            <Skeleton className="h-4 w-full max-w-[36rem] rounded-md" />
            <Skeleton className="h-4 w-2/3 max-w-[24rem] rounded-md" />
          </div>

          <div className="profile-hero-actions">
            <Skeleton className="h-11 rounded-full sm:w-[7.5rem]" />
            <Skeleton className="h-11 rounded-full sm:w-[7.5rem]" />
          </div>

          <div className="profile-stats">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="profile-stat gap-1.5">
                <Skeleton className="h-3 w-12 rounded-md sm:w-14" />
                <Skeleton className="h-6 w-8 rounded-md sm:h-7" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden className="profile-aside">
        {/* Ficha */}
        <div className="card p-4 pt-5 sm:p-5 sm:pt-6">
          <Skeleton className="h-4 w-44 rounded-md" />
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="size-24 shrink-0 rounded-[1.25rem]" />
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 lg:gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 max-w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Medallas */}
        <div className="card @container p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
          <Skeleton className="mt-2.5 h-1.5 rounded-full" />
          <div className="mt-4 grid grid-cols-4 gap-x-1 gap-y-3 @xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 px-0.5 pb-1.5 pt-2">
                <Skeleton className="m-1 size-12 rounded-full" />
                <Skeleton className="h-2.5 w-12 max-w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden className="profile-main">
        <Skeleton className="mb-4 h-11 rounded-full" />
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <TeamCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
