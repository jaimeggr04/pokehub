/**
 * Tipos de la base de datos PokeHub (Supabase / Postgres).
 * Regenerables con:  npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[]

export type Gender = 'male' | 'female' | 'unknown'

export type ProfileRow = {
  id: string
  username: string
  display_name: string | null
  bio: string
  avatar_url: string | null
  is_premium: boolean
  created_at: string
  updated_at: string
}

export type TeamRow = {
  id: string
  user_id: string
  name: string
  description: string
  format: string
  is_public: boolean
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
}

export type BuildRow = {
  id: string
  team_id: string
  slot: number
  pokemon_id: number
  pokemon_name: string
  nickname: string | null
  gender: Gender
  level: number
  shiny: boolean
  ability: string | null
  item: string | null
  nature: string | null
  tera_type: string | null
  moves: string[]
  hp_ivs: number; atk_ivs: number; def_ivs: number
  spa_ivs: number; spd_ivs: number; spe_ivs: number
  hp_evs: number; atk_evs: number; def_evs: number
  spa_evs: number; spd_evs: number; spe_evs: number
}

export type CommentRow = {
  id: string
  team_id: string
  user_id: string
  body: string
  created_at: string
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export type ConversationRow = {
  id: string
  created_at: string
  last_message_at: string
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  __InternalSupabase: { PostgrestVersion: '13.0.5' }
  public: {
    Tables: {
      profiles: Table<ProfileRow>
      teams: Table<TeamRow, Omit<TeamRow, 'id' | 'created_at' | 'updated_at' | 'like_count' | 'comment_count'> & { id?: string }>
      builds: Table<BuildRow, Omit<BuildRow, 'id'> & { id?: string }>
      likes: Table<{ team_id: string; user_id: string; created_at: string }>
      comments: Table<CommentRow, Omit<CommentRow, 'id' | 'created_at'> & { id?: string }>
      follows: Table<{ follower_id: string; following_id: string; created_at: string }>
      conversations: Table<ConversationRow>
      conversation_participants: Table<{ conversation_id: string; user_id: string; last_read_at: string }>
      messages: Table<MessageRow, Omit<MessageRow, 'id' | 'created_at'> & { id?: string }>
    }
    Views: { [_ in never]: never }
    Functions: {
      delete_own_account: { Args: Record<string, never>; Returns: undefined }
      get_or_create_dm: { Args: { other_user: string }; Returns: string }
      email_for_login: { Args: { uname: string; pw: string }; Returns: string | null }
      search_profiles: {
        Args: { q: string; limit_count?: number }
        Returns: {
          id: string
          username: string
          display_name: string | null
          bio: string
          avatar_url: string | null
          team_count: number
        }[]
      }
      suggested_users: {
        Args: { limit_count?: number }
        Returns: {
          id: string
          username: string
          display_name: string | null
          bio: string
          avatar_url: string | null
          follower_count: number
        }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

/* ---------- Tipos compuestos que usa la UI ---------- */

export type TeamWithAuthor = TeamRow & {
  author: Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_url'>
  builds: BuildRow[]
  liked_by_me?: boolean
}
