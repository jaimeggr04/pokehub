'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { Home, MessageSquare, PlusCircle, Search, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { PokeballCore } from '@/components/pokeball'
import { UnreadBadge, useUnreadCount } from '@/components/unread'

/* ---------------------------------------------------------------
   Utilidades compartidas por la navegación (cabecera, barra inferior,
   menús y paleta de comandos).
   --------------------------------------------------------------- */

export const PALETTE_EVENT = 'pokehub:palette'

/** Abre la paleta de comandos desde cualquier código de cliente. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(PALETTE_EVENT))
}

const noopSubscribe = () => () => {}

/** «⌘K» en Apple y «Ctrl K» en el resto; null hasta hidratar (el servidor no sabe el sistema). */
export function useShortcutLabel(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => null,
  )
}

/** Si `pathname` pertenece a la sección de `href` (subrutas incluidas). */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  // Crear es una pantalla concreta: /team/<id> es ver un equipo, no crearlo.
  if (href === '/team/new') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Ruta "objetivo" para pintar el indicador activo: salta al pulsar, sin
 * esperar a que el servidor responda, y cede en cuanto cambia la ruta real.
 */
export function useNavTarget() {
  const pathname = usePathname()
  const [pending, setPending] = useState<string | null>(null)

  // Cualquier cambio de ruta real (por aquí, por el logo o por el historial)
  // anula lo pendiente.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setPending(null)
  }

  const target = pending ?? pathname

  function onNavigate(href: string) {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      setPending(href)
    }
  }

  return { pathname, target, onNavigate }
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Mantiene el Tab dentro de `container` (diálogos modales). */
export function trapTabKey(e: KeyboardEvent | React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== 'Tab' || !container) return
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  )
  if (nodes.length === 0) {
    e.preventDefault()
    container.focus()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const current = document.activeElement
  if (!container.contains(current)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && (current === first || current === container)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && current === last) {
    e.preventDefault()
    first.focus()
  }
}

/* ---------------------------------------------------------------
   Cabecera de escritorio
   --------------------------------------------------------------- */

type NavItem = { href: string; label: string; icon: LucideIcon }

// Dos a cada lado de la pokéball central, que hace de "hub" de la navegación.
const LEFT: NavItem[] = [
  { href: '/home', label: 'Inicio', icon: Home },
  { href: '/search', label: 'Buscar', icon: Search },
]
const RIGHT: NavItem[] = [
  { href: '/team/new', label: 'Crear equipo', icon: PlusCircle },
  { href: '/messages', label: 'Mensajes', icon: MessageSquare },
]

const PILL_SPRING = { type: 'spring', stiffness: 520, damping: 40 } as const

/**
 * Navegación principal de md en adelante. Ocupa toda la cabecera en una capa
 * sin eventos de puntero y centra sus dos grupos respecto a la pokéball: así
 * el hueco central coincide siempre con ella, mida lo que mida el logo.
 */
export function DesktopNav() {
  const { pathname, target, onNavigate } = useNavTarget()
  const unread = useUnreadCount()

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const selected = isActivePath(target, item.href)
    const isMessages = item.href === '/messages'
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
          onClick={onNavigate(item.href)}
          className={clsx(
            'group relative flex h-11 min-w-11 flex-col items-center justify-center rounded-full transition-colors duration-200',
            'lg:h-auto lg:min-w-[4.75rem] lg:gap-1 lg:rounded-2xl lg:px-3 lg:py-2',
            selected ? 'text-brand-fg' : 'text-brand-fg/80 hover:text-brand-fg',
          )}
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full transition-colors duration-200 group-hover:bg-brand-fg/10 lg:rounded-2xl"
          />
          {selected && (
            <motion.span
              layoutId="shell-nav-pill"
              aria-hidden
              className="absolute inset-0 rounded-full bg-brand-fg/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_6px_14px_-6px_rgb(0_0_0/0.45)] lg:rounded-2xl"
              transition={PILL_SPRING}
            />
          )}
          <span className={clsx('relative', selected && 'shell-nav-bounce')}>
            <Icon aria-hidden size={22} strokeWidth={selected ? 2.4 : 2} />
            {isMessages && <UnreadBadge tone="onBrand" className="absolute -right-2.5 -top-2" />}
          </span>
          <span className="relative hidden text-xs font-semibold leading-none tracking-wide lg:block">
            {item.label}
          </span>
          {/* Por debajo de lg sólo hay icono: el nombre va para lectores y en un tooltip. */}
          <span className="sr-only lg:hidden">{item.label}</span>
          {isMessages && unread > 0 && <span className="sr-only">, {unread} sin leer</span>}
          <span aria-hidden className="shell-tip lg:hidden">
            {item.label}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none absolute inset-0 hidden items-center md:flex"
    >
      <div className="grid w-full grid-cols-[1fr_7rem_1fr] items-center">
        <ul className="pointer-events-auto flex items-center gap-1 justify-self-end lg:gap-1.5">
          {LEFT.map(renderItem)}
        </ul>
        {/* Hueco central. La bola se posiciona respecto al <nav> (la celda no es
            relativa), pero va aquí para que el Tab siga el orden visual. */}
        <div>
          <HeaderPokeball />
        </div>
        <ul className="pointer-events-auto flex items-center gap-1 justify-self-start lg:gap-1.5">
          {RIGHT.map(renderItem)}
        </ul>
      </div>
    </nav>
  )
}

/**
 * Pokéball central, a caballo entre la cabecera y el contenido. Se inclina
 * hacia el cursor, se aplasta al pulsarla y da una vuelta de moneda al hacer
 * clic (un giro plano no se notaría: el botón es un círculo simétrico).
 */
function HeaderPokeball() {
  const reduce = useReducedMotion()
  const tiltX = useSpring(0, { stiffness: 260, damping: 18 })
  const tiltY = useSpring(0, { stiffness: 260, damping: 18 })
  const flip = useSpring(0, { stiffness: 90, damping: 13 })
  // Destino acumulado: si se pulsa a mitad de giro, la vuelta sigue acabando entera.
  const flipTarget = useRef(0)
  const rotateY = useTransform(() => tiltY.get() + flip.get())
  const [ripple, setRipple] = useState(0)

  function onPointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (reduce || e.pointerType !== 'mouse') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    tiltY.set(x * 36)
    tiltX.set(-y * 36)
  }

  function resetTilt() {
    tiltX.set(0)
    tiltY.set(0)
  }

  return (
    <Link
      href="/home"
      aria-label="Ir al inicio"
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      onClick={() => {
        setRipple((n) => n + 1)
        if (reduce) return
        flipTarget.current += 360
        flip.set(flipTarget.current)
      }}
      className="shell-ball pointer-events-auto absolute bottom-0 left-1/2 block h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-full"
    >
      <span aria-hidden className="shell-ball-glow" />
      {ripple > 0 && <span key={ripple} aria-hidden className="shell-ball-ripple" />}
      <motion.span aria-hidden className="shell-ball-body" style={{ rotateX: tiltX, rotateY }}>
        <PokeballCore className="h-full w-full" pulsing />
      </motion.span>
    </Link>
  )
}

/**
 * Buscador de la cabecera: un botón con aspecto de campo que abre la paleta.
 * Icono redondo hasta xl; a partir de ahí, campo con el atajo de teclado.
 */
export function SearchTrigger() {
  const shortcut = useShortcutLabel()

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      aria-label="Buscar en PokeHub"
      className={clsx(
        'group flex h-11 shrink-0 items-center rounded-full border-2 text-brand-fg transition-[background-color,border-color,scale] duration-200 active:scale-95',
        'w-11 justify-center border-brand-fg/70 bg-brand-fg/20 hover:bg-brand-fg/30',
        'xl:w-48 xl:justify-start xl:gap-2.5 xl:border-brand-fg/35 xl:bg-band/15 xl:pl-3.5 xl:pr-2 xl:hover:border-brand-fg/60 xl:hover:bg-band/25 2xl:w-60',
      )}
    >
      <Search aria-hidden size={19} className="shrink-0 xl:size-[17px] xl:opacity-90" />
      <span className="hidden flex-1 text-left text-sm font-medium text-brand-fg/85 xl:block">Buscar…</span>
      {shortcut && (
        <kbd className="shell-kbd shell-kbd-on-brand hidden animate-fade-in xl:inline-flex">{shortcut}</kbd>
      )}
    </button>
  )
}

/** Lupa de la cabecera móvil, junto a la hamburguesa. */
export function MobileSearchButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-haspopup="dialog"
      aria-label="Buscar en PokeHub"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-brand-fg/70 bg-brand-fg/20 text-brand-fg backdrop-blur transition-[background-color,scale] duration-200 hover:bg-brand-fg/30 active:scale-95 md:hidden"
    >
      <Search aria-hidden size={21} />
    </button>
  )
}

/**
 * Marca <html data-shell-scrolled> en cuanto la página se desplaza, para que
 * la cabecera gane sombra. Oyente pasivo y como mucho un cálculo por frame.
 */
export function HeaderScrollState() {
  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    const update = () => {
      frame = 0
      root.toggleAttribute('data-shell-scrolled', window.scrollY > 4)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      root.removeAttribute('data-shell-scrolled')
    }
  }, [])

  return null
}
