'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RotateCcw } from 'lucide-react'
import { ErrorArt, StatusScreen } from '@/components/status-screen'

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
    <StatusScreen
      art={<ErrorArt />}
      eyebrow="¡El ataque falló!"
      title="Algo ha salido mal"
      description="Ha ocurrido un error inesperado al cargar esta página. Suele bastar con volver a intentarlo; si se repite, prueba de nuevo en unos minutos."
      actions={
        <>
          <button type="button" onClick={reset} className="btn btn-primary btn-lg">
            <RotateCcw size={18} aria-hidden />
            Reintentar
          </button>
          <Link href="/home" className="btn btn-soft btn-lg">
            <Home size={18} aria-hidden />
            Ir al inicio
          </Link>
        </>
      }
      // El identificador es lo único útil para buscar el fallo en los registros.
      footnote={
        error.digest ? (
          <>
            Código del error: <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono">{error.digest}</code>
          </>
        ) : null
      }
    />
  )
}
