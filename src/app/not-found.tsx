import Link from 'next/link'
import { PokeballIcon } from '@/components/pokeball'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <PokeballIcon className="mx-auto h-20 w-20" />
        <h1 className="mt-5 text-3xl font-extrabold">404 — Aquí no hay nada</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          La página que buscas se ha escapado entre la hierba alta.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
