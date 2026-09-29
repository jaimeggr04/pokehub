import Link from 'next/link'

/**
 * Pie fijo de escritorio (en móvil ese hueco es de la barra inferior). Una
 * sola línea de 36 px: los avisos legales se acortan en pantallas medianas.
 */
export function SiteFooter() {
  // Componente de servidor: el año se calcula una vez al pintar, sin hidratación.
  const year = new Date().getFullYear()

  return (
    <footer className="glass fixed inset-x-0 bottom-0 z-30 hidden h-9 border-t border-line md:block">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-6 px-7 text-[11px] leading-none text-muted">
        <p className="min-w-0 truncate">
          <span className="font-semibold text-ink">© 2024–{year} PokeHub</span>
          <span className="hidden lg:inline">
            {' · '}Pokémon y todos los nombres relacionados son marca registrada y © de Nintendo 1996–{year}.
          </span>
          <span className="lg:hidden"> · Pokémon © Nintendo</span>
        </p>

        <div className="flex shrink-0 items-center gap-5 font-medium">
          <p className="hidden items-center gap-1.5 xl:flex">
            Pulsa <kbd className="shell-kbd h-[18px] min-w-[18px] px-1 text-[10px]">/</kbd> para buscar
          </p>
          <nav aria-label="Enlaces del pie" className="flex items-center gap-5">
            <Link href="/premium" className="shell-footer-link py-1">
              Premium
            </Link>
            <Link href="/legal" className="shell-footer-link py-1">
              Aviso legal
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
