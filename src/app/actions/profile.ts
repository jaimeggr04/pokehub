'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ProfileState {
  error?: string
  success?: string
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const username = String(formData.get('username') ?? '').trim()
  const displayName = String(formData.get('display_name') ?? '').trim()
  const bio = String(formData.get('bio') ?? '').trim()
  const avatarUrl = String(formData.get('avatar_url') ?? '').trim()

  if (!USERNAME_RE.test(username)) {
    return { error: 'El usuario debe tener entre 3 y 20 caracteres (letras, números o _).' }
  }
  if (bio.length > 250) return { error: 'La biografía no puede superar 250 caracteres.' }
  if (avatarUrl && !/^https:\/\/.+/i.test(avatarUrl)) {
    return { error: 'La URL del avatar debe empezar por https://' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión caducada.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName || username,
      bio,
      avatar_url: avatarUrl || null,
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'Ese nombre de usuario ya está cogido.' }
    return { error: 'No se pudieron guardar los cambios.' }
  }

  revalidatePath('/', 'layout')
  return { success: 'Perfil actualizado.' }
}

/**
 * Guarda el avatar recién subido. Va por separado del formulario de perfil para
 * que la foto se aplique en cuanto termina la subida, sin obligar a guardar
 * todo lo demás.
 */
export async function updateAvatarUrl(url: string | null): Promise<ProfileState> {
  if (url && !/^https:\/\/.+/i.test(url)) {
    return { error: 'La URL del avatar debe empezar por https://' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión caducada.' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)

  if (error) return { error: 'No se pudo actualizar la foto de perfil.' }

  revalidatePath('/', 'layout')
  return { success: url ? 'Foto de perfil actualizada.' : 'Foto de perfil eliminada.' }
}
