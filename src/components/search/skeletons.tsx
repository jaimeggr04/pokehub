import clsx from 'clsx'
import { Skeleton } from '@/components/ui/skeleton'
import { TeamCardSkeleton } from '@/components/team-card'

/*
 * Esqueletos de /search con la misma geometría que el contenido real, para
 * que al cargar no salte nada. Los usan la página (Suspense) y loading.tsx.
 */

/** Rejilla de la página: columna principal y lateral a partir de lg. */
export const SEARCH_GRID =
  'mx-auto grid max-w-[1180px] gap-6 px-3 sm:px-4 md:pt-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8'

/** Columna principal: a lo ancho del feed, para que las tarjetas no se estiren en tableta. */
export const SEARCH_MAIN = 'mx-auto w-full min-w-0 max-w-[760px] lg:max-w-none'

/** Carril lateral fijo al hacer scroll, a la altura del de la portada. */
export const SEARCH_RAIL = 'search-rail flex flex-col gap-4'

export function HeadingSkeleton() {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Skeleton className="size-9 rounded-xl" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-44 rounded-md" />
        <Skeleton className="h-3 w-56 rounded-md" />
      </div>
    </div>
  )
}

export function TrainerListSkeleton({ label = 'Cargando entrenadores…' }: { label?: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <HeadingSkeleton />
      <div aria-hidden className="grid gap-2 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{ '--i': i } as React.CSSProperties}
            className="stagger-item flex items-center gap-3 rounded-xl bg-surface-2 px-2.5 py-2 shadow-card"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3 w-40 max-w-full rounded-md" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TeamListSkeleton({ label = 'Buscando equipos…' }: { label?: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <HeadingSkeleton />
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <TeamCardSkeleton key={i} index={i} />
        ))}
      </div>
    </div>
  )
}

// Ficha de Pokémon popular: sprite cuadrado, nombre, equipos y barra; sale 2:3.
const POKE_TILE = 'aspect-[2/3] rounded-2xl'

/** Tarjeta de Pokémon populares de la columna lateral. */
export function PopularCardSkeleton() {
  return (
    <div aria-hidden className="card p-4">
      <Skeleton className="h-4 w-36 rounded-md" />
      <Skeleton className="mt-2.5 h-3 w-full rounded-md" />
      <Skeleton className="mt-1.5 h-3 w-2/3 rounded-md" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className={POKE_TILE} />
        ))}
      </div>
    </div>
  )
}

/** Sección de Pokémon populares de la columna principal (por debajo de lg). */
export function PopularRowSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={clsx('lg:hidden', className)}>
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
      <div className="-mx-3 flex gap-2.5 overflow-hidden px-3 pb-3 pt-3 sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0 sm:pb-0">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className={clsx(POKE_TILE, 'w-[5.75rem] shrink-0 sm:w-auto')} />
        ))}
      </div>
    </div>
  )
}

/** Cabecera de la página: título, cifras, cuadro de búsqueda y pestañas (como search-hero.tsx). */
export function SearchHeroSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <div className="mt-1.5 flex h-[30px] items-center sm:h-[37.5px]">
        <Skeleton className="h-7 w-64 max-w-full rounded-lg sm:h-8" />
      </div>
      {/* La descripción ocupa dos líneas en móvil y una desde sm. */}
      <div className="mt-1.5 flex h-10 flex-col justify-center gap-2 sm:h-5">
        <Skeleton className="h-3.5 w-full max-w-md rounded-md" />
        <Skeleton className="h-3.5 w-1/2 rounded-md sm:hidden" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-13 rounded-full sm:h-14" />
      <Skeleton className="mt-3 h-11 rounded-full" />
    </div>
  )
}
