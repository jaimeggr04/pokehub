import AppLayout from '@/app/(app)/layout'
import { PublicHeader } from '@/components/public-header'
import { SiteFooter } from '@/components/site-footer'
import { getOptionalUserId } from '@/lib/session'

/**
 * Páginas que también se leen sin cuenta (el aviso legal se enlaza desde el
 * registro, antes de crearla). Con sesión se ven dentro de la app de siempre;
 * sin ella, con una cabecera pública.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const userId = await getOptionalUserId()
  if (userId) return <AppLayout>{children}</AppLayout>

  return (
    <>
      <PublicHeader />
      <main id="contenido" tabIndex={-1} className="min-h-dvh pb-12 pt-[104px] outline-none md:pb-14 md:pt-[136px]">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
