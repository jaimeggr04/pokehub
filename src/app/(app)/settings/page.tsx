import { requireProfile } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings-form'

export const metadata = { title: 'Configuración' }

export default async function SettingsPage() {
  const { profile } = await requireProfile()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // `identities` lista los proveedores vinculados. Ojo: una lista vacía no es
  // nullish, así que hay que comprobar la longitud; si no, un usuario sin
  // identidades se quedaría sin poder cambiar la contraseña.
  const linked = user?.identities?.map((i) => i.provider) ?? []
  const providers = linked.length > 0 ? linked : ['email']

  return (
    <div className="mx-auto max-w-[620px] px-3 sm:px-4">
      <h1 className="mb-1 text-2xl font-extrabold">Configuración</h1>
      <p className="mb-5 text-sm text-muted">
        Gestiona tu perfil, tu cuenta y el aspecto de PokeHub.
      </p>
      <SettingsForm profile={profile} email={user?.email ?? null} providers={providers} />
    </div>
  )
}
