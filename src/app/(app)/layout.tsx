import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { MobileNav } from '@/components/mobile-nav'
import { SelectedPokemonProvider } from '@/components/selected-pokemon'
import { requireProfile } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile()

  return (
    <SelectedPokemonProvider>
      <SiteHeader profile={profile} />
      <main className="min-h-dvh pb-24 pt-[104px] md:pb-14 md:pt-[136px]">{children}</main>
      <SiteFooter />
      <MobileNav username={profile.username} />
    </SelectedPokemonProvider>
  )
}
