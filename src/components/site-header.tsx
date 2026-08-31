import Link from 'next/link'
import { Logo } from '@/components/logo'
import { MobileMenu } from '@/components/mobile-menu'
import { PokeballCore } from '@/components/pokeball'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import type { ProfileRow } from '@/lib/database.types'

export const HEADER_HEIGHT = 'h-[92px] md:h-[112px]'

export function SiteHeader({ profile }: { profile: ProfileRow }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 ${HEADER_HEIGHT} border-b-8 border-band bg-brand shadow-card transition-colors duration-300`}
    >
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between px-4 md:px-7">
        <span className="hidden sm:block">
          <Logo href="/home" size="md" />
        </span>
        <span className="sm:hidden">
          <Logo href="/home" size="sm" />
        </span>

        <div className="flex items-center gap-3 md:gap-4">
          {/* En móvil el tema y la cuenta viven dentro del menú hamburguesa,
              así la cabecera no se llena de controles en pantallas estrechas. */}
          <span className="hidden md:block">
            <ThemeToggle />
          </span>
          <span className="hidden md:block">
            <UserMenu
              username={profile.username}
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
            />
          </span>
          <MobileMenu
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
          />
        </div>
      </div>

      {/* Botón pokéball centrado, a caballo entre la cabecera y el contenido */}
      <span className="pointer-events-none absolute bottom-0 left-1/2 hidden md:block">
        <Link
          href="/home"
          aria-label="Ir al inicio"
          title="Inicio"
          className="pointer-events-auto block h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-full drop-shadow-[0_6px_12px_rgba(0,0,0,.4)] transition-transform duration-300 hover:scale-110 hover:rotate-6 active:scale-95"
        >
          <span className="sr-only">Inicio</span>
          <PokeballCore className="h-full w-full" />
        </Link>
      </span>
    </header>
  )
}

export function AuthHeader({ open }: { open: boolean }) {
  return (
    <header
      className={`pokeball-top fixed inset-x-0 top-0 z-40 border-b-8 border-band bg-brand shadow-card ${
        open ? 'h-[92px] md:h-[112px]' : 'h-[50vh]'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between px-4 md:px-7">
        <div className={`transition-opacity duration-700 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <Logo href={null} size="md" />
        </div>
        {open && <ThemeToggle />}
      </div>
    </header>
  )
}
