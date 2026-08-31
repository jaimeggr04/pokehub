export function SiteFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 hidden h-9 border-t border-band/40 bg-bg-elevated md:block">
      <p className="flex h-full items-center justify-center px-4 text-center text-[11px] text-muted">
        Todo el contenido es © de PokeHub 2024–{new Date().getFullYear()}. Pokémon y todos los nombres
        relacionados son marca registrada y © de Nintendo 1996–{new Date().getFullYear()}.
      </p>
    </footer>
  )
}
