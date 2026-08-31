'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AccountState {
  error?: string
  success?: string
}

/**
 * Cambia el correo de acceso. Supabase envía un enlace de confirmación a la
 * dirección nueva; hasta que se abra, el correo antiguo sigue siendo el válido.
 */
export async function updateEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'Escribe un email válido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión caducada. Vuelve a entrar.' }
  if (user.email?.toLowerCase() === email.toLowerCase()) {
    return { error: 'Ese ya es tu email actual.' }
  }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) {
    return {
      error: error.message.toLowerCase().includes('already')
        ? 'Ya hay una cuenta con ese email.'
        : 'No se pudo cambiar el email.',
    }
  }

  return { success: `Te hemos enviado un enlace de confirmación a ${email}.` }
}

/**
 * Cambia la contraseña. Se revalida primero la actual porque la sesión activa
 * bastaría para cambiarla, y eso permitiría secuestrar una cuenta desde un
 * dispositivo que se hubiera quedado abierto.
 */
export async function updatePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const current = String(formData.get('current_password') ?? '')
  const next = String(formData.get('new_password') ?? '')
  const repeat = String(formData.get('repeat_password') ?? '')

  if (next.length < 8) return { error: 'La nueva contraseña debe tener al menos 8 caracteres.' }
  if (next !== repeat) return { error: 'Las dos contraseñas nuevas no coinciden.' }
  if (next === current) return { error: 'La nueva contraseña debe ser distinta de la actual.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Sesión caducada. Vuelve a entrar.' }

  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  })
  if (checkError) return { error: 'La contraseña actual no es correcta.' }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { error: 'No se pudo cambiar la contraseña.' }

  return { success: 'Contraseña actualizada.' }
}

/**
 * Da de baja la cuenta. El borrado real lo hace una función `security definer`
 * en Postgres, porque desde el cliente no se puede tocar `auth.users`; el resto
 * de datos (equipos, likes, seguidores…) cae en cascada.
 */
export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const confirmation = String(formData.get('confirm') ?? '').trim()
  if (confirmation.toUpperCase() !== 'ELIMINAR') {
    return { error: 'Escribe ELIMINAR para confirmar que quieres borrar la cuenta.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión caducada. Vuelve a entrar.' }

  const { error } = await supabase.rpc('delete_own_account')
  if (error) return { error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login?deleted=1')
}
