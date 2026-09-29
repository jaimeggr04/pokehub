import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MobileNav } from '@/components/mobile-nav'
import { SelectedPokemonProvider } from '@/components/selected-pokemon'
import { CommandPalette } from '@/components/command-palette'
import { UnreadProvider } from '@/components/unread'
import { ShinyEasterEgg } from '@/components/easter-egg'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/session'
import { getUnreadConversationIds } from '@/lib/unread'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, userId } = await requireProfile()
  // Recuento inicial de chats sin leer: el globo sale ya en el HTML, sin saltos.
  const supabase = await createClient()
  const unreadIds = (await getUnreadConversationIds(supabase, userId)) ?? []

  return (
    <SelectedPokemonProvider>
      <UnreadProvider userId={userId} initialIds={unreadIds}>
        {/* Fuera de la pantalla hasta que recibe el foco con el teclado. */}
        <a
          href="#contenido"
          className="fixed left-4 top-3 z-[80] -translate-y-[calc(100%+3rem)] rounded-full bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-ink shadow-float transition-transform duration-200 ease-(--ease-out-expo) focus:translate-y-0"
        >
          Saltar al contenido
        </a>
        <SiteHeader profile={profile} />
        <main
          id="contenido"
          tabIndex={-1}
          className="min-h-dvh pb-24 pt-[104px] outline-none md:pb-14 md:pt-[136px]"
        >
          {children}
        </main>
        <SiteFooter />
        <MobileNav username={profile.username} />
        <CommandPalette username={profile.username} />
        <ShinyEasterEgg />
      </UnreadProvider>
    </SelectedPokemonProvider>
  )
}
