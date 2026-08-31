'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-extrabold">Algo ha fallado</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
