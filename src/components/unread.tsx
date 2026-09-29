'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { getUnreadConversationIds, openConversationId } from '@/lib/unread'
import { toast } from '@/components/ui/toast'
import type { MessageRow } from '@/lib/database.types'

export const UNREAD_REFRESH_EVENT = 'pokehub:unread-refresh'

type UnreadContextValue = { count: number; refresh: () => void }

const UnreadContext = createContext<UnreadContextValue>({ count: 0, refresh: () => {} })

// Agrupa los disparadores que llegan juntos (cambio de ruta + evento del chat).
const REFRESH_DELAY = 250
// Sólo si el canal en tiempo real falla: sondeo tranquilo para no quedarse a cero.
const FALLBACK_POLL = 60_000
// Una ráfaga de mensajes del mismo chat no debe apilar avisos.
const TOAST_COOLDOWN = 8_000

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

function preview(body: string) {
  const text = body.replace(/\s+/g, ' ').trim()
  return text.length > 90 ? `${text.slice(0, 89)}…` : text
}

/**
 * Mantiene vivo el número de chats sin leer. Parte del cálculo del servidor
 * y se recalcula al navegar, cuando el chat avisa de que ha marcado como leído
 * y cuando llega un mensaje por Realtime.
 */
export function UnreadProvider({
  userId,
  initialIds,
  children,
}: {
  userId: string
  initialIds: string[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [ids, setIds] = useState<string[]>(initialIds)

  // Si el layout se vuelve a pintar en el servidor (router.refresh, acciones),
  // su recuento es el más fresco que hay.
  const [serverIds, setServerIds] = useState(initialIds)
  if (!sameIds(serverIds, initialIds)) {
    setServerIds(initialIds)
    setIds(initialIds)
  }

  const pathnameRef = useRef(pathname)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestRequest = useRef(0)

  const refresh = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const request = ++latestRequest.current
      const next = await getUnreadConversationIds(createClient(), userId)
      // Un error de red no debe borrar el globo: se conserva el último valor.
      if (next === null || request !== latestRequest.current) return
      setIds((prev) => (sameIds(prev, next) ? prev : next))
    }, REFRESH_DELAY)
  }, [userId])

  useEffect(() => () => clearTimeout(timer.current), [])

  // Al navegar. La primera ruta no: el recuento del servidor acaba de llegar.
  useEffect(() => {
    if (pathnameRef.current === pathname) return
    const left = openConversationId(pathnameRef.current)
    pathnameRef.current = pathname
    // El chat del que se sale ya se marcó como leído: sin esto el globo
    // volvería a contarlo un instante, hasta que llegue el recálculo.
    if (left && left !== openConversationId(pathname)) {
      setIds((prev) => (prev.includes(left) ? prev.filter((id) => id !== left) : prev))
    }
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener(UNREAD_REFRESH_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(UNREAD_REFRESH_EVENT, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    const supabase = createClient()
    const lastToast = new Map<string, number>()
    let poll: ReturnType<typeof setInterval> | undefined

    async function announce(message: MessageRow) {
      const path = pathnameRef.current ?? ''
      // En Mensajes ya se ve la lista; con la pestaña oculta nadie lo leería.
      if (path.startsWith('/messages') || document.hidden) return
      const now = Date.now()
      if (now - (lastToast.get(message.conversation_id) ?? 0) < TOAST_COOLDOWN) return
      lastToast.set(message.conversation_id, now)

      const { data } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', message.sender_id)
        .maybeSingle()
      const name = data?.display_name || (data?.username ? `@${data.username}` : 'Alguien')
      toast(`${name} te ha escrito`, { description: preview(message.body) })
    }

    // RLS ya filtra: sólo llegan mensajes de conversaciones en las que participo.
    // Tema único por montaje: supabase reutiliza un canal con el mismo nombre, y
    // el del montaje anterior (StrictMode, recargas) puede estar aún cerrándose.
    const channel = supabase
      .channel(`unread:${userId}:${Math.random().toString(36).slice(2, 10)}`)
      .on<MessageRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new
          if (!message?.conversation_id || message.sender_id === userId) return
          // El chat abierto se marca como leído solo; contarlo sería un falso aviso.
          if (message.conversation_id === openConversationId(pathnameRef.current)) return
          setIds((prev) =>
            prev.includes(message.conversation_id) ? prev : [message.conversation_id, ...prev],
          )
          refresh()
          void announce(message)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearInterval(poll)
          poll = undefined
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !poll) {
          poll = setInterval(refresh, FALLBACK_POLL)
        }
      })

    return () => {
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  // La conversación abierta no cuenta aunque el servidor aún no la haya marcado.
  const openId = openConversationId(pathname)
  const count = openId ? ids.filter((id) => id !== openId).length : ids.length
  const value = useMemo(() => ({ count, refresh }), [count, refresh])

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

/** Recuento y recálculo manual. Fuera del proveedor devuelve 0. */
export function useUnread(): UnreadContextValue {
  return useContext(UnreadContext)
}

export function useUnreadCount(): number {
  return useContext(UnreadContext).count
}

/**
 * Globo con el número de chats sin leer. Entra con un pequeño salto y el
 * número "rueda" al cambiar. Es decorativo: quien lo usa añade el texto para
 * lectores de pantalla («3 sin leer») donde tenga sentido.
 */
export function UnreadBadge({
  tone = 'brand',
  max = 9,
  className,
}: {
  /** onBrand: blanco con texto de marca, para la cabecera. */
  tone?: 'brand' | 'onBrand'
  max?: number
  className?: string
}) {
  const count = useUnreadCount()
  const label = count > max ? `${max}+` : String(count)

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key="badge"
          aria-hidden
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 640, damping: 20, delay: 0.1 }}
          className={clsx(
            'pointer-events-none grid h-[18px] min-w-[18px] place-items-center overflow-hidden rounded-full px-1 text-[10px] font-bold leading-none tabular-nums shadow-card ring-2',
            tone === 'onBrand' ? 'bg-brand-fg text-brand ring-brand' : 'bg-brand text-brand-fg ring-bg-elevated',
            className,
          )}
        >
          <motion.span
            key={label}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            {label}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  )
}
