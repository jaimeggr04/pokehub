import { Logo } from '@/components/logo'
import { MobileMenu } from '@/components/mobile-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { DesktopNav, HeaderScrollState, MobileSearchButton, SearchTrigger } from '@/components/nav-links'
import type { ProfileRow } from '@/lib/database.types'

export const HEADER_HEIGHT = 'h-[92px] md:h-[112px]'

/**
 * Cabecera fija: la banda de marca hace de mitad superior de una pokéball y
 * el botón central (en la navegación de escritorio) la remata. Sigue siendo
 * un componente de servidor; lo interactivo va en islas de cliente.
 */
export function SiteHeader({ profile }: { profile: ProfileRow }) {
  return (
    <header
      className={`shell-header shell-on-brand fixed inset-x-0 top-0 z-40 ${HEADER_HEIGHT} border-b-8 border-band bg-brand`}
    >
      <HeaderScrollState />
      <div className="relative mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3 px-4 md:px-7">
        {/* El logo también es el disparador del huevo de pascua (7 toques seguidos). */}
        <span className="relative z-10 sm:hidden">
          <Logo href="/home" size="sm" easterEggTrigger />
        </span>
        <span className="relative z-10 hidden sm:block">
          <Logo href="/home" size="md" easterEggTrigger />
        </span>

        <DesktopNav />

        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          {/* En móvil el tema y la cuenta viven dentro del menú hamburguesa,
              así la cabecera no se llena de controles en pantallas estrechas. */}
          <span className="hidden md:block">
            <SearchTrigger />
          </span>
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
          <MobileSearchButton />
          <MobileMenu
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
          />
        </div>
      </div>
    </header>
  )
}

export function AuthHeader({ open }: { open: boolean }) {
  return (
    <header
      className={`pokeball-top shell-on-brand fixed inset-x-0 top-0 z-40 border-b-8 border-band bg-brand shadow-card ${
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
