'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText, Home, LogOut, Menu, MessageSquare, PlusCircle, Search, Settings, Sparkles, User, X,
} from 'lucide-react'
import { ThemeSelector } from '@/components/theme-toggle'
import { signOut } from '@/app/(auth)/actions'

/**
 * Menú hamburguesa para móvil. La barra inferior cubre las cinco acciones
 * principales; esto da acceso al resto (ajustes, premium, tema, salir) sin
 * amontonarlo todo en una cabecera de 92 px.
 */
export function MobileMenu({
  username,
  displayName,
  avatarUrl,
}: {
  username: string
  displayName: string | null
  avatarUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // El portal sólo existe en cliente; en el servidor no hay `document`.
  useEffect(() => setMounted(true), [])

  // Cerrar al navegar: el panel es fijo y sobreviviría al cambio de ruta.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    // Bloquear el scroll de fondo mientras el panel está abierto.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // El foco entra en el panel para que el lector de pantalla no siga detrás.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  const nav = [
    { href: '/home', icon: Home, label: 'Inicio' },
    { href: '/search', icon: Search, label: 'Buscar entrenadores' },
    { href: '/team/new', icon: PlusCircle, label: 'Crear equipo' },
    { href: '/messages', icon: MessageSquare, label: 'Mensajes' },
    { href: `/u/${username}`, icon: User, label: 'Mi perfil' },
  ]

  const secondary = [
    { href: '/settings', icon: Settings, label: 'Configuración' },
    { href: '/premium', icon: Sparkles, label: 'Plan Premium' },
    { href: '/legal', icon: FileText, label: 'Aviso legal' },
  ]

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white/70 bg-white/20 text-white backdrop-blur transition hover:bg-white/30 active:scale-95 md:hidden"
      >
        <Menu size={22} />
      </button>

      {/* Velo y panel van en un portal colgado de <body>.
          Si se quedan dentro del <header> (que es `fixed z-40`), heredan su
          contexto de apilamiento y su z-50 no puede superar a la barra de
          navegación inferior, que tapaba el botón de cerrar sesión. */}
      {mounted &&
        createPortal(
          <>
      {/* Velo */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col overflow-y-auto overscroll-contain bg-bg-elevated shadow-float outline-none transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-brand px-4 py-4">
          <Link href={`/u/${username}`} className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/80 bg-white/20">
              <Image
                src={avatarUrl || '/avatar-default.png'}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="h-full w-full object-cover"
              />
            </span>
            <span className="min-w-0 leading-tight text-white">
              <span className="block truncate text-sm font-bold">{displayName || username}</span>
              <span className="block truncate text-xs opacity-90">@{username}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          >
            <X size={18} />
          </button>
        </header>

        <nav className="flex-1 p-3">
          <ul className="flex flex-col gap-0.5">
            {nav.map(({ href, icon: Icon, label }) => (
              <MenuLink key={href} href={href} icon={Icon} label={label} pathname={pathname} />
            ))}
          </ul>

          <hr className="my-3 border-line" />

          <ul className="flex flex-col gap-0.5">
            {secondary.map(({ href, icon: Icon, label }) => (
              <MenuLink key={href} href={href} icon={Icon} label={label} pathname={pathname} />
            ))}
          </ul>

          <div className="mt-4 rounded-card border border-line bg-surface p-3">
            <p className="mb-2 text-xs font-semibold text-muted">Tema</p>
            <ThemeSelector />
          </div>
        </nav>

        <footer className="border-t border-line p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </footer>
      </div>
          </>,
          document.body,
        )}
    </>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
  pathname,
}: {
  href: string
  icon: React.ElementType
  label: string
  pathname: string
}) {
  const active = pathname === href || (href !== '/home' && pathname.startsWith(href))
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
          active ? 'bg-brand/15 text-brand' : 'hover:bg-surface'
        }`}
      >
        <Icon size={19} />
        {label}
      </Link>
    </li>
  )
}
