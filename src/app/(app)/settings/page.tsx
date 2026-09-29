import { requireProfile } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings-form'

export const metadata = {
  title: 'Configuración',
  description: 'Tu perfil, tu cuenta y el aspecto de PokeHub.',
}

export default async function SettingsPage() {
  const { profile } = await requireProfile()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // `identities` lista los proveedores vinculados. Ojo: una lista vacía no es
  // nullish, así que hay que comprobar la longitud; si no, un usuario sin
  // identidades se quedaría sin poder cambiar la contraseña.
  const linked = [...new Set(user?.identities?.map((i) => i.provider) ?? [])]
  const providers = linked.length > 0 ? linked : ['email']

  // En el servidor: formatearlo en el cliente podría dar otro mes al hidratar
  // si la zona horaria del navegador cae al otro lado de medianoche.
  const joined = new Date(profile.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    // md:pt-4: el contenido empieza donde acaba la pokéball que cuelga de la cabecera.
    // Misma anchura que loading.tsx: si cambia aquí, cambiarla también allí.
    <div className="mx-auto w-full max-w-[1040px] px-3 sm:px-4 md:pt-4">
      <SettingsForm profile={profile} email={user?.email ?? null} providers={providers} joined={joined} />
    </div>
  )
}
