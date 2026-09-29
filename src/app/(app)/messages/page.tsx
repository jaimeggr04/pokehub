import Link from 'next/link'
import { Search, Sparkles } from 'lucide-react'
import { PokeballIcon } from '@/components/pokeball'

export const metadata = { title: 'Mensajes' }

/**
 * La lista de chats la pinta el layout. Esta página es el panel derecho en
 * escritorio mientras no hay ninguna conversación abierta (en móvil no se ve).
 */
export default function MessagesPage() {
  return (
    <section
      aria-labelledby="messages-welcome"
      className="chat-wallpaper card relative flex flex-col items-center justify-center overflow-hidden px-8 text-center lg:chat-pane-h"
    >
      <div aria-hidden className="relative mb-8 h-28 w-40">
        <span className="absolute left-1/2 top-3 -translate-x-1/2">
          <PokeballIcon className="h-20 w-20 animate-float" />
        </span>
        <span className="absolute bottom-0 left-1/2 h-2.5 w-14 -translate-x-1/2 animate-float-shadow rounded-[50%] bg-black/15 blur-[2px] dark:bg-black/40" />
        <span className="chat-welcome-bubble absolute -left-2 top-0 rounded-2xl rounded-bl-md bg-surface-2 px-3 py-1.5 text-sm font-semibold shadow-card">
          ¿Combate?
        </span>
        <span className="chat-welcome-bubble is-late absolute -right-3 top-9 rounded-2xl rounded-br-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg shadow-card">
          ¡Vamos! ⚡
        </span>
      </div>

      <h2 id="messages-welcome" className="text-2xl font-extrabold tracking-tight">
        Tus mensajes
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Elige una conversación de la lista o busca a otro entrenador para retarle, pedirle consejo o
        intercambiar equipos.
      </p>
      <Link href="/search?tipo=entrenadores" className="btn btn-primary mt-6">
        <Search size={16} aria-hidden />
        Buscar entrenadores
      </Link>
      <p className="mt-8 inline-flex max-w-sm items-start gap-2 rounded-2xl bg-brand-soft px-4 py-2.5 text-left text-xs text-ink">
        <Sparkles size={15} aria-hidden className="mt-px shrink-0 text-brand" />
        <span>
          Toca la pokéball junto a la caja de texto para compartir uno de tus equipos: llegará como
          tarjeta con sus seis Pokémon.
        </span>
      </p>
    </section>
  )
}
