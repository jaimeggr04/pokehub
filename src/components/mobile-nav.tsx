'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Home, MessageSquare, Plus, Swords, User, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { UnreadBadge, useUnreadCount } from '@/components/unread'
import { isActivePath, useNavTarget } from '@/components/nav-links'

type Tab = { href: string; label: string; icon: LucideIcon }

/**
 * Barra inferior del móvil. La píldora del activo se desliza entre pestañas
 * nada más pulsar (sin esperar al servidor) y "Crear" es una pokéball que
 * sobresale de la barra.
 */
export function MobileNav({ username }: { username: string }) {
  const { pathname, target, onNavigate } = useNavTarget()
  const unread = useUnreadCount()

  const left: Tab[] = [
    { href: '/home', label: 'Inicio', icon: Home },
    // La búsqueda sigue a mano en la lupa de la cabecera móvil.
    { href: '/battle', label: 'Partida', icon: Swords },
  ]
  const right: Tab[] = [
    { href: '/messages', label: 'Chats', icon: MessageSquare },
    { href: `/u/${username}`, label: 'Perfil', icon: User },
  ]

  const renderTab = ({ href, label, icon: Icon }: Tab) => {
    const selected = isActivePath(target, href)
    const isChats = href === '/messages'
    return (
      <li key={href} className="flex">
        <Link
          href={href}
          aria-current={isActivePath(pathname, href) ? 'page' : undefined}
          onClick={onNavigate(href)}
          className={clsx(
            'pressable relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] font-semibold',
            selected ? 'text-brand' : 'text-muted',
          )}
        >
          {selected && (
            <motion.span
              layoutId="shell-tab-pill"
              aria-hidden
              className="absolute inset-x-1 inset-y-1.5 rounded-2xl bg-brand-soft"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span className={clsx('relative', selected && 'shell-nav-bounce')}>
            <Icon aria-hidden size={22} strokeWidth={selected ? 2.4 : 2} />
            {isChats && <UnreadBadge className="absolute -right-2.5 -top-1.5" />}
          </span>
          <span className="relative leading-tight">{label}</span>
          {isChats && unread > 0 && <span className="sr-only">, {unread} sin leer</span>}
        </Link>
      </li>
    )
  }

  const createSelected = isActivePath(target, '/team/new')

  return (
    <nav
      aria-label="Navegación principal"
      className="shell-bottomnav glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1.5">
        {left.map(renderTab)}
        <li className="relative">
          <Link
            href="/team/new"
            aria-label="Crear equipo"
            aria-current={isActivePath(pathname, '/team/new') ? 'page' : undefined}
            onClick={onNavigate('/team/new')}
            data-active={createSelected ? '' : undefined}
            className={clsx(
              'shell-create absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-5 flex-col items-center gap-0.5 text-[10.5px] font-semibold transition-colors duration-200',
              createSelected ? 'text-brand' : 'text-muted',
            )}
          >
            <span className="shell-create-ball">
              <span className="shell-create-core">
                <Plus aria-hidden size={13} strokeWidth={3.5} />
              </span>
            </span>
            <span className="leading-tight">Crear</span>
          </Link>
        </li>
        {right.map(renderTab)}
      </ul>
    </nav>
  )
}
