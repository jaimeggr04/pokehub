'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { MESSAGE_MAX_LENGTH } from '@/lib/chat'
import type { MessageRow } from '@/lib/database.types'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, userId: user.id }
}

export async function toggleLike(teamId: string, liked: boolean) {
  const { supabase, userId } = await requireUser()

  const { error } = liked
    ? await supabase.from('likes').delete().eq('team_id', teamId).eq('user_id', userId)
    : await supabase.from('likes').insert({ team_id: teamId, user_id: userId })

  // Sin este aviso la UI optimista se quedaba mostrando un like que nunca llegó
  // a guardarse (por ejemplo si la sesión caducó entre medias).
  if (error) return { error: 'No se pudo registrar el me gusta.' }

  revalidatePath('/home')
  revalidatePath(`/team/${teamId}`)
  // La pestaña "Me gusta" del perfil también cambia.
  revalidatePath('/u/[username]', 'page')
  return { ok: true }
}

export async function toggleFollow(targetId: string, following: boolean) {
  const { supabase, userId } = await requireUser()

  if (targetId === userId) return { error: 'No puedes seguirte a ti mismo.' }

  const { error } = following
    ? await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId)
    : await supabase.from('follows').insert({ follower_id: userId, following_id: targetId })

  if (error) return { error: 'No se pudo actualizar el seguimiento.' }

  revalidatePath('/home')
  revalidatePath('/search')
  // Los contadores de seguidores viven en la página de perfil.
  revalidatePath('/u/[username]', 'page')
  return { ok: true }
}

export async function addComment(teamId: string, body: string) {
  const { supabase, userId } = await requireUser()
  const clean = body.trim()
  if (!clean) return { error: 'El comentario está vacío.' }
  if (clean.length > 500) return { error: 'Máximo 500 caracteres.' }

  const { error } = await supabase
    .from('comments')
    .insert({ team_id: teamId, user_id: userId, body: clean })
  if (error) return { error: 'No se pudo publicar el comentario.' }

  revalidatePath(`/team/${teamId}`)
  revalidatePath('/home')
  return { ok: true }
}

export async function deleteComment(commentId: string, teamId: string) {
  const { supabase, userId } = await requireUser()

  // Las políticas RLS ya impiden borrar comentarios ajenos, pero filtrar también
  // aquí evita depender de una sola capa y devuelve un error claro.
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)

  if (error) return { error: 'No se pudo eliminar el comentario.' }

  revalidatePath(`/team/${teamId}`)
  revalidatePath('/home')
  return { ok: true }
}

export async function startConversation(otherUserId: string) {
  const { supabase, userId } = await requireUser()
  if (otherUserId === userId) return { error: 'No puedes escribirte a ti mismo.' }

  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user: otherUserId })
  if (error || !data) return { error: 'No se pudo abrir el chat.' }
  return { conversationId: data as unknown as string }
}

/**
 * Devuelve la fila insertada: el cliente sustituye con ella su mensaje
 * optimista y así no se duplica cuando llega el mismo INSERT por tiempo real.
 * Sin revalidatePath a propósito: obligaría a volver a renderizar la
 * conversación entera en cada envío, y la sala ya se actualiza sola.
 */
export async function sendMessage(conversationId: string, body: string) {
  const { supabase, userId } = await requireUser()
  const clean = body.trim()
  if (!clean) return { error: 'El mensaje está vacío.' }
  if (clean.length > MESSAGE_MAX_LENGTH) return { error: `Máximo ${MESSAGE_MAX_LENGTH} caracteres.` }

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, body: clean })
    .select('*')
    .single()
  if (error || !data) return { error: 'No se pudo enviar el mensaje.' }

  return { ok: true as const, message: data as MessageRow }
}

/** Devuelve la marca guardada para que la sala pueda avisar al otro («Visto»). */
export async function markConversationRead(conversationId: string) {
  const { supabase, userId } = await requireUser()
  const readAt = new Date().toISOString()
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: readAt })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) return { error: 'No se pudo marcar la conversación como leída.' }
  return { ok: true as const, readAt }
}
