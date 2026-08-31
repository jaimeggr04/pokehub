'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, PlusCircle, Search, User } from 'lucide-react'
import clsx from 'clsx'

const ITEMS = [
  { href: '/home', icon: Home, label: 'Inicio' },
  { href: '/search', icon: Search, label: 'Buscar' },
  { href: '/team/new', icon: PlusCircle, label: 'Crear' },
  { href: '/messages', icon: MessageSquare, label: 'Chats' },
]

export function MobileNav({ username }: { username: string }) {
  const pathname = usePathname()
  const items = [...ITEMS, { href: `/u/${username}`, icon: User, label: 'Perfil' }]

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-line bg-bg-elevated pb-[env(safe-area-inset-bottom)] shadow-float md:hidden"
    >
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition',
              active ? 'text-brand' : 'text-muted',
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
