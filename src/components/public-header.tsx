import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Cabecera para quien todavía no ha entrado: la misma banda de marca que la
 * de la app (misma altura, así --header-h y los elementos pegajosos cuadran),
 * pero sólo con el logo, el tema y el botón de entrar.
 */
export function PublicHeader() {
  return (
    <header className="shell-header shell-on-brand fixed inset-x-0 top-0 z-40 h-[92px] border-b-8 border-band bg-brand md:h-[112px]">
      <div className="relative mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3 px-4 md:px-7">
        <span className="relative z-10">
          <Logo href="/" size="md" />
        </span>
        <div className="relative z-10 flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Link href="/login" className="btn btn-sm bg-white text-[#111] shadow-card hover:bg-white/90">
            <LogIn size={16} aria-hidden />
            Entrar
          </Link>
        </div>
      </div>
    </header>
  )
}
