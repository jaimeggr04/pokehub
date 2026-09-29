'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, MessageSquare, Search, Settings, Sparkles, User, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { PokeballIcon } from '@/components/pokeball'
import { UnreadBadge, useUnreadCount } from '@/components/unread'
import { openCommandPalette, useShortcutLabel } from '@/components/nav-links'
import { signOut } from '@/app/(auth)/actions'

// Sin tailwind-merge, dos colores de texto en la misma clase competirían: por
// eso el tono se elige aquí y no se sobrescribe después.
function itemClass(tone: 'default' | 'danger' = 'default') {
  return clsx(
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors duration-150',
    tone === 'danger'
      ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
      : 'text-ink hover:bg-brand-soft hover:text-brand focus-visible:bg-brand-soft focus-visible:text-brand',
  )
}

function menuItems(menu: HTMLElement | null) {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

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
  const pathname = usePathname()
  const unread = useUnreadCount()
  const shortcut = useShortcutLabel()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Qué ítem enfocar al abrir: el último si se abrió con la flecha arriba.
  const focusOnOpen = useRef<'first' | 'last'>('first')
  const buttonId = useId()
  const menuId = useId()

  // Se cierra al cambiar de ruta (p. ej. tras elegir una opción).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const list = menuItems(menuRef.current)
      ;(focusOnOpen.current === 'last' ? list[list.length - 1] : list[0])?.focus({ preventScroll: true })
    })

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(menuRef.current)
    if (list.length === 0) return
    const index = list.indexOf(document.activeElement as HTMLElement)
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusAt(index < 0 ? -1 : index - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(list.length - 1)
        break
      case 'Tab':
        // El Tab sale del menú con normalidad; el menú no se queda abierto detrás.
        setOpen(false)
        break
      case ' ':
        // Espacio activa también los enlaces, como en cualquier menú nativo.
        if (index >= 0) {
          e.preventDefault()
          list[index].click()
        }
        break
      default: {
        // Búsqueda por la primera letra, sin tildes.
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || !/\S/.test(e.key)) return
        const char = fold(e.key)
        for (let step = 1; step <= list.length; step++) {
          const candidate = list[(index + step) % list.length]
          if (fold(candidate.textContent?.trim() ?? '').startsWith(char)) {
            candidate.focus()
            break
          }
        }
      }
    }
  }

  const name = displayName || username

  const links: { href: string; icon: LucideIcon; label: string; iconClass?: string }[] = [
    { href: `/u/${username}`, icon: User, label: 'Ver perfil' },
    { href: '/messages', icon: MessageSquare, label: 'Mensajes' },
    { href: '/settings', icon: Settings, label: 'Configuración' },
    { href: '/premium', icon: Sparkles, label: 'Plan Premium', iconClass: 'text-warning' },
  ]

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={() => {
          focusOnOpen.current = 'first'
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first'
          setOpen(true)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menú de ${name}`}
        className={clsx(
          'grid h-11 w-11 place-items-center rounded-full border-2 bg-brand-fg/20 transition-[border-color,scale,box-shadow] duration-200 hover:scale-105 active:scale-95',
          open ? 'border-brand-fg shadow-[0_0_0_4px_rgb(255_255_255/0.18)]' : 'border-brand-fg/70 hover:border-brand-fg',
        )}
      >
        <Avatar src={avatarUrl} name={username} size={40} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="user-menu"
            className="shell-popover absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 overflow-hidden rounded-2xl border border-line bg-bg-elevated text-ink shadow-float"
            style={{ transformOrigin: 'top right' }}
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }}
          >
            <div className="shell-brand-panel relative flex items-center gap-3 overflow-hidden px-4 py-4">
              <PokeballIcon className="pointer-events-none absolute -right-6 -top-7 h-28 w-28 rotate-12 opacity-15" />
              <Avatar src={avatarUrl} name={username} size={48} className="ring-2 ring-brand-fg/80" />
              <div className="relative min-w-0 leading-tight">
                <p className="truncate text-sm font-bold">¡Hola, {name}!</p>
                <p className="truncate text-xs opacity-90">@{username}</p>
              </div>
            </div>

            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-labelledby={buttonId}
              onKeyDown={onMenuKeyDown}
              className="p-1.5"
            >
              {links.map(({ href, icon: Icon, label, iconClass }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  className={itemClass()}
                >
                  <Icon aria-hidden size={17} className={clsx('shrink-0', iconClass)} />
                  <span className="flex-1">{label}</span>
                  {href === '/messages' && (
                    <>
                      <UnreadBadge max={99} />
                      {unread > 0 && <span className="sr-only">, {unread} sin leer</span>}
                    </>
                  )}
                </Link>
              ))}

              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  // El foco vuelve al avatar antes de abrir la paleta: al cerrarla,
                  // regresa ahí y no a un ítem que ya no existe.
                  buttonRef.current?.focus()
                  setOpen(false)
                  openCommandPalette()
                }}
                className={itemClass()}
              >
                <Search aria-hidden size={17} className="shrink-0" />
                <span className="flex-1">Buscar</span>
                {shortcut && <kbd className="shell-kbd">{shortcut}</kbd>}
              </button>

              <div role="separator" className="-mx-1.5 my-1.5 h-px bg-line" />

              <form action={signOut} role="none">
                <button
                  type="submit"
                  role="menuitem"
                  tabIndex={-1}
                  className={itemClass('danger')}
                >
                  <LogOut aria-hidden size={17} className="shrink-0" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
