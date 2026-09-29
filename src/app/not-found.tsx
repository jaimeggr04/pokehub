import Link from 'next/link'
import { Home, Search } from 'lucide-react'
import { NotFoundArt, StatusScreen } from '@/components/status-screen'

export const metadata = { title: 'Página no encontrada' }

export default function NotFound() {
  return (
    <StatusScreen
      art={<NotFoundArt />}
      eyebrow="Error 404"
      title="Esta página se ha escapado"
      description="Se ha metido entre la hierba alta y no hay manera de encontrarla. Puede que el enlace esté roto o que el equipo o el entrenador ya no existan."
      actions={
        <>
          <Link href="/home" className="btn btn-primary btn-lg">
            <Home size={18} aria-hidden />
            Volver al inicio
          </Link>
          <Link href="/search" className="btn btn-soft btn-lg">
            <Search size={18} aria-hidden />
            Buscar
          </Link>
        </>
      }
    />
  )
}
