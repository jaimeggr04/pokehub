'use client'

import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatRoomSkeleton } from '@/components/chat-room'

/**
 * La lista tiene su propio esqueleto en el layout; esto cubre el panel
 * derecho. Al entrar directamente en un chat desde otra sección, este límite
 * puede mostrarse antes que el de [id], así que decide por la ruta.
 */
export default function MessagesLoading() {
  const pathname = usePathname()
  if (pathname.replace(/\/$/, '') !== '/messages') return <ChatRoomSkeleton />

  return (
    <div
      aria-busy="true"
      className="chat-wallpaper card flex flex-col items-center justify-center gap-4 px-8 lg:chat-pane-h"
    >
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <Skeleton className="h-20 w-20 rounded-full" />
      <Skeleton className="h-6 w-44 rounded-lg" />
      <Skeleton className="h-3.5 w-72 max-w-full rounded-md" />
      <Skeleton className="h-3.5 w-56 max-w-full rounded-md" />
      <Skeleton className="mt-2 h-11 w-48 rounded-full" />
    </div>
  )
}
