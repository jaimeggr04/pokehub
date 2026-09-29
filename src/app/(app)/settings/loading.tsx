import { Skeleton } from '@/components/ui/skeleton'

/** Réplica de Configuración mientras carga: misma anchura, cabecera, índice y tarjetas. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-3 sm:px-4 md:pt-4">
      <p role="status" className="sr-only">
        Cargando la configuración…
      </p>

      <div aria-hidden>
        {/* Título */}
        <Skeleton className="h-8 w-52 rounded-lg sm:h-9" />
        <Skeleton className="mt-2 h-3.5 w-full max-w-80 rounded-md" />

        {/* Vista previa del perfil */}
        <div className="card mt-5 overflow-hidden">
          <Skeleton className="h-24 rounded-none sm:h-28" />
          <div className="flex flex-col items-center gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6">
            <div className="-mt-12 rounded-full bg-surface p-1.5 sm:-mt-14">
              <Skeleton className="size-[104px] rounded-full" />
            </div>
            <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-3.5 w-56 rounded-md" />
              <Skeleton className="h-3.5 w-full max-w-md rounded-md" />
            </div>
            <Skeleton className="h-9 w-40 rounded-full" />
          </div>
        </div>

        {/* Chips (móvil) */}
        <div className="mt-5 flex gap-1 overflow-hidden rounded-full border border-line p-1 md:hidden">
          {[80, 104, 84, 76, 132].map((w, i) => (
            <Skeleton key={i} className="h-10 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>

        <div className="mt-4 grid gap-5 md:mt-5 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          {/* Carril */}
          <div className="hidden md:block">
            <div className="card flex flex-col gap-1 p-2">
              <Skeleton className="mx-3 mb-1 mt-2.5 h-2.5 w-14 rounded" />
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Secciones */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className="card p-5 sm:p-6">
              <SectionHeading />
              <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-line p-4 sm:flex-row sm:p-5">
                <Skeleton className="size-24 rounded-full" />
                <div className="flex w-full flex-1 flex-col items-center gap-2 sm:items-start">
                  <Skeleton className="h-4 w-60 max-w-full rounded-md" />
                  <Skeleton className="h-3 w-72 max-w-full rounded-md" />
                  <Skeleton className="mt-1 h-9 w-32 rounded-full" />
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FieldSkeleton />
                <FieldSkeleton />
              </div>
              <div className="mt-4">
                <Skeleton className="mb-2 h-3.5 w-20 rounded-md" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <SectionHeading />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl sm:h-24" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeading() {
  return (
    <div className="mb-5 flex items-start gap-3.5">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-3 w-52 max-w-full rounded-md" />
      </div>
    </div>
  )
}

function FieldSkeleton() {
  return (
    <div>
      <Skeleton className="mb-2 h-3.5 w-32 rounded-md" />
      <Skeleton className="h-11 rounded-xl" />
    </div>
  )
}
