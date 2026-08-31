'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { LogOut, Settings, Sparkles, User } from 'lucide-react'
import { signOut } from '@/app/(auth)/actions'

export function UserMenu({
  username,
  displayName,
  avatarUrl,
}: {
  username: string
  displayName: string | null
  avatarUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = [
    { href: `/u/${username}`, icon: User, label: 'Ver perfil' },
    { href: '/settings', icon: Settings, label: 'Configuración' },
    { href: '/premium', icon: Sparkles, label: 'Plan Premium' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menú de usuario"
        className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20 backdrop-blur transition hover:scale-105 active:scale-95"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={44} height={44} className="h-full w-full object-cover" unoptimized />
        ) : (
          <User size={24} className="text-white" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 top-[calc(100%+0.75rem)] z-50 w-60 overflow-hidden rounded-card border border-line bg-bg-elevated shadow-float"
        >
          <div className="flex flex-col items-center gap-2 border-b border-line bg-surface px-4 py-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-card">
              <Image
                src={avatarUrl || '/avatar-default.png'}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <div className="text-center leading-tight">
              <p className="text-sm font-semibold">¡Bienvenido, {displayName || username}!</p>
              <p className="text-xs text-muted">@{username}</p>
            </div>
          </div>

          <ul className="p-1.5">
            {items.map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-brand hover:text-brand-fg"
                >
                  <Icon size={17} />
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-brand hover:text-brand-fg"
                >
                  <LogOut size={17} />
                  Cerrar sesión
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
