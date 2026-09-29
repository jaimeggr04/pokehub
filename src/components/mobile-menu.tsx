'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  ChevronRight, FileText, Home, LogOut, Menu, MessageSquare, PlusCircle, Search, Settings, Sparkles, User, X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'
import { PokeballIcon } from '@/components/pokeball'
import { ThemeSelector } from '@/components/theme-toggle'
import { UnreadBadge, useUnreadCount } from '@/components/unread'
import { isActivePath, openCommandPalette, trapTabKey } from '@/components/nav-links'
import { useLockBodyScroll, useMediaQuery, useMounted } from '@/lib/hooks'
import { signOut } from '@/app/(auth)/actions'

// Umbrales del gesto de cerrar deslizando hacia la derecha.
const DISMISS_OFFSET = 90
const DISMISS_VELOCITY = 500

const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } },
}
const ITEM: Variants = {
  hidden: { opacity: 0, x: 28 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
}

type Entry = { href: string; icon: LucideIcon; label: string }

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
  const mounted = useMounted()
  const pathname = usePathname()
  const unread = useUnreadCount()
  const wide = useMediaQuery('(min-width: 768px)')
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Un arrastre que acaba encima de un enlace no debe navegar.
  const dragged = useRef(false)

  // Cerrar al navegar (el panel es fijo y sobreviviría al cambio de ruta) y al
  // pasar a escritorio, donde el panel no se ve pero dejaría el scroll bloqueado.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }
  if (open && wide) setOpen(false)

  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const button = buttonRef.current
    // El foco entra en el panel para que el lector de pantalla no siga detrás.
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }))

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      trapTabKey(e, panelRef.current)
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      button?.focus({ preventScroll: true })
    }
  }, [open])

  const nav: Entry[] = [
    { href: '/home', icon: Home, label: 'Inicio' },
    { href: '/search', icon: Search, label: 'Buscar' },
    { href: '/team/new', icon: PlusCircle, label: 'Crear equipo' },
    { href: '/messages', icon: MessageSquare, label: 'Mensajes' },
    { href: `/u/${username}`, icon: User, label: 'Mi perfil' },
  ]

  const secondary: Entry[] = [
    { href: '/settings', icon: Settings, label: 'Configuración' },
    { href: '/premium', icon: Sparkles, label: 'Plan Premium' },
    { href: '/legal', icon: FileText, label: 'Aviso legal' },
  ]

  const name = displayName || username

  function renderLink({ href, icon: Icon, label }: Entry) {
    const active = isActivePath(pathname, href)
    const isMessages = href === '/messages'
    return (
      <motion.li key={href} variants={ITEM}>
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            // Misma ruta: no habrá cambio de pathname que lo cierre.
            if (active) setOpen(false)
          }}
          className={clsx(
            'pressable relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold',
            // ink al 5 %: se nota igual sobre el blanco del claro que sobre el morado del oscuro.
            active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-ink/5 active:bg-ink/[.08]',
          )}
        >
          {active && <span aria-hidden className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-brand" />}
          <Icon aria-hidden size={20} className={active ? 'text-brand' : 'text-muted'} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {isMessages && <UnreadBadge max={99} />}
          {isMessages && unread > 0 && <span className="sr-only">, {unread} sin leer</span>}
          <ChevronRight aria-hidden size={16} className="shrink-0 text-muted/60" />
        </Link>
      </motion.li>
    )
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-brand-fg/70 bg-brand-fg/20 text-brand-fg backdrop-blur transition-[background-color,scale] duration-200 hover:bg-brand-fg/30 active:scale-95 md:hidden"
      >
        <Menu aria-hidden size={22} />
      </button>

      {/* Velo y panel van en un portal colgado de <body>. Si se quedan dentro
          del <header> (que es `fixed z-40`), heredan su contexto de apilamiento
          y su z-50 no puede superar a la barra de navegación inferior. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div key="mobile-menu" className="md:hidden">
                <motion.div
                  aria-hidden
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                />

                <motion.div
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menú"
                  tabIndex={-1}
                  className="fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col overflow-hidden rounded-l-3xl bg-bg-elevated text-ink shadow-float outline-none"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%', transition: { type: 'spring', stiffness: 380, damping: 40 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 38, mass: 0.9 }}
                  drag="x"
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  // Rígido hacia dentro, suelto hacia fuera: invita a cerrarlo, no a estirarlo.
                  dragElastic={{ left: 0.04, right: 0.9 }}
                  onDragStart={() => {
                    dragged.current = true
                  }}
                  onDragEnd={(_, info) => {
                    // El clic sintético llega justo después de soltar: se ignora ese.
                    requestAnimationFrame(() => {
                      dragged.current = false
                    })
                    if (info.offset.x > DISMISS_OFFSET || info.velocity.x > DISMISS_VELOCITY) setOpen(false)
                  }}
                  onClickCapture={(e) => {
                    if (dragged.current) {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                >
                  <header
                    className="shell-brand-panel relative flex shrink-0 items-center justify-between gap-3 overflow-hidden px-4 pb-4"
                    style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                  >
                    <PokeballIcon className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rotate-12 opacity-15" />
                    <Link
                      href={`/u/${username}`}
                      onClick={() => {
                        if (isActivePath(pathname, `/u/${username}`)) setOpen(false)
                      }}
                      className="relative flex min-w-0 items-center gap-3 rounded-2xl"
                    >
                      <Avatar src={avatarUrl} name={username} size={48} className="ring-2 ring-brand-fg/80" />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-base font-bold">{name}</span>
                        <span className="block truncate text-xs opacity-90">@{username}</span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Cerrar menú"
                      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-fg/20 text-brand-fg transition-[background-color,scale] hover:bg-brand-fg/30 active:scale-95"
                    >
                      <X aria-hidden size={19} />
                    </button>
                  </header>

                  <motion.nav
                    aria-label="Secciones"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3"
                    variants={LIST}
                    initial="hidden"
                    animate="show"
                  >
                    <motion.button
                      type="button"
                      variants={ITEM}
                      onClick={() => {
                        // El foco vuelve a la hamburguesa antes de abrir la paleta:
                        // así, al cerrarla, regresa a un sitio que sigue existiendo.
                        buttonRef.current?.focus({ preventScroll: true })
                        setOpen(false)
                        openCommandPalette()
                      }}
                      className="pressable mb-3 flex h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 text-left text-[15px] text-muted hover:border-brand/40"
                    >
                      <Search aria-hidden size={18} className="text-brand" />
                      <span className="flex-1 truncate">Buscar entrenadores o equipos…</span>
                    </motion.button>

                    <ul className="flex flex-col gap-0.5">{nav.map(renderLink)}</ul>

                    <motion.hr variants={ITEM} className="my-3 border-line" />

                    <ul className="flex flex-col gap-0.5">{secondary.map(renderLink)}</ul>

                    <motion.div variants={ITEM} className="mt-4 rounded-card border border-line bg-surface p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tema</p>
                      <ThemeSelector />
                    </motion.div>
                  </motion.nav>

                  <footer
                    className="shrink-0 border-t border-line px-3 pt-3"
                    style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                  >
                    <form action={signOut}>
                      <button type="submit" className="btn btn-danger h-12 w-full rounded-xl">
                        <LogOut aria-hidden size={17} /> Cerrar sesión
                      </button>
                    </form>
                  </footer>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
