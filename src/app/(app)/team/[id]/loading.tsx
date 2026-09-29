'use client'

import { usePathname } from 'next/navigation'
import { BuildCardSkeleton } from '@/components/build-card'
import { PokeballSpinner } from '@/components/ui/pokeball-spinner'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Réplica de la página de equipo mientras carga: misma cabecera, misma barra
 * de secciones y las primeras fichas, con los mismos huecos que page.tsx.
 *
 * De cliente sólo por una razón: este loading también envuelve a
 * /team/[id]/edit, que es hijo de este segmento y no tiene uno propio. Allí
 * la réplica de la ficha engañaría, así que se muestra la pokéball de carga.
 */
export default function Loading() {
  const pathname = usePathname()

  if (pathname?.endsWith('/edit')) {
    return (
      <div className="grid min-h-[50vh] place-items-center md:pt-4">
        <PokeballSpinner size={56} label="Cargando el editor…" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        Cargando el equipo…
      </p>

      <div aria-hidden>
        <HeroSkeleton />

        {/* Barra de secciones: una píldora en móvil, dos grupos alrededor de la pokéball en md+. */}
        <div className="mb-6 md:mb-8">
          <Skeleton className="h-12 rounded-full md:hidden" />
          <div className="hidden grid-cols-[1fr_7rem_1fr] items-center md:grid">
            <Skeleton className="h-12 w-[15.5rem] justify-self-end rounded-full" />
            <span />
            <Skeleton className="h-12 w-[17.5rem] justify-self-start rounded-full" />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-4 w-full max-w-sm rounded-md" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <BuildCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:mb-6">
      <div className="team-hero-band px-4 pt-4 sm:px-6 sm:pt-6 lg:grid lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-end lg:gap-8 lg:px-8 lg:pt-7">
        <div className="min-w-0 lg:self-center lg:pb-7">
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-[31px] w-4/5 max-w-xs rounded-lg sm:h-10 lg:h-11" />
          <div className="mt-3 flex items-center gap-2.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
        </div>

        {/* Mismas medidas que la alineación real (team-lineup-item y su margen del 18 %). */}
        <div className="mt-4 flex justify-center pb-1 sm:mt-5 lg:mt-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="team-lineup-item" style={{ '--i': i } as React.CSSProperties}>
              <div className="-mx-[18%] grid aspect-square place-items-center">
                <Skeleton className="size-1/2 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
          <Skeleton className="h-4 w-3/5 max-w-md rounded-md" />
        </div>
        <div className="flex gap-2 border-t border-line pt-4">
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-16 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </div>
  )
}
