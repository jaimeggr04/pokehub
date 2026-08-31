import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/database.types'

/** Devuelve el perfil del usuario autenticado o redirige al login. */
export async function requireProfile(): Promise<{ profile: ProfileRow; userId: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  return { profile: profile as ProfileRow, userId: user.id }
}

export async function getOptionalUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
