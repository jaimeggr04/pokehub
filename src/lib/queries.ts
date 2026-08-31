import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TeamWithAuthor } from '@/lib/database.types'

export const TEAM_SELECT =
  '*, author:profiles!teams_user_id_fkey(id, username, display_name, avatar_url), builds(*)'

type Client = SupabaseClient<Database>

/** Marca qué equipos ha likeado el usuario actual. */
export async function withLikes(
  supabase: Client,
  teams: TeamWithAuthor[],
  userId: string | null,
): Promise<TeamWithAuthor[]> {
  if (!userId || teams.length === 0) return teams
  const { data } = await supabase
    .from('likes')
    .select('team_id')
    .eq('user_id', userId)
    .in('team_id', teams.map((t) => t.id))

  const liked = new Set((data ?? []).map((l) => l.team_id))
  return teams.map((t) => ({ ...t, liked_by_me: liked.has(t.id) }))
}

export async function getFollowingIds(supabase: Client, userId: string): Promise<string[]> {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  return (data ?? []).map((f) => f.following_id)
}
