import type { SupabaseClient } from '@supabase/supabase-js'
import { TEAM_SELECT, getFollowingIds, withLikes } from '@/lib/queries'
import type { Database, TeamWithAuthor } from '@/lib/database.types'

/*
 * Consulta del feed compartida por la página (primera página, en el servidor) y
 * por las acciones de src/app/actions/feed.ts (páginas siguientes y aviso de
 * equipos nuevos). Vive aparte porque un archivo 'use server' convertiría
 * cualquier función exportada en un endpoint público.
 */

export const FEED_PAGE_SIZE = 20

export type FeedTab = 'para-ti' | 'siguiendo'

/** Posición tras el último equipo mostrado. El id desempata equipos creados en el mismo instante. */
export type FeedCursor = { createdAt: string; id: string }

export type FeedPage = { teams: TeamWithAuthor[]; nextCursor: FeedCursor | null }

type Client = SupabaseClient<Database>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})?$/

export function isFeedTab(value: unknown): value is FeedTab {
  return value === 'para-ti' || value === 'siguiendo'
}

/** Fecha ISO de Postgres. Sólo dígitos y separadores: nada que pueda romper un filtro `or`. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
}

// El cursor llega del navegador: se valida entero antes de meterlo en un filtro.
export function isFeedCursor(value: unknown): value is FeedCursor {
  if (!value || typeof value !== 'object') return false
  const { createdAt, id } = value as Record<string, unknown>
  return isIsoDate(createdAt) && typeof id === 'string' && UUID.test(id)
}

/** Autores cuyos equipos entran en la pestaña; null = todos. */
async function authorFilter(supabase: Client, userId: string, tab: FeedTab): Promise<string[] | null> {
  return tab === 'siguiendo' ? getFollowingIds(supabase, userId) : null
}

export async function queryFeedPage(
  supabase: Client,
  userId: string,
  { tab, cursor }: { tab: FeedTab; cursor: FeedCursor | null },
): Promise<FeedPage & { followsNobody: boolean }> {
  const authors = await authorFilter(supabase, userId, tab)
  if (authors && authors.length === 0) return { teams: [], nextCursor: null, followsNobody: true }

  let query = supabase.from('teams').select(TEAM_SELECT).eq('is_public', true)
  if (authors) query = query.in('user_id', authors)
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  // Uno de más para saber si hay otra página sin un count(*) aparte.
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_PAGE_SIZE + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as TeamWithAuthor[]
  const page = rows.slice(0, FEED_PAGE_SIZE)
  const last = page[page.length - 1]
  const teams = await withLikes(supabase, page, userId)

  return {
    teams,
    nextCursor: rows.length > FEED_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null,
    followsNobody: false,
  }
}

/** Cuántos equipos de la pestaña se han publicado después de `since`. */
export async function countFeedSince(
  supabase: Client,
  userId: string,
  { tab, since }: { tab: FeedTab; since: string },
): Promise<number> {
  const authors = await authorFilter(supabase, userId, tab)
  if (authors && authors.length === 0) return 0

  let query = supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true)
    .gt('created_at', since)
    // Lo que publica uno mismo ya lo conoce: no es "nuevo" para él.
    .neq('user_id', userId)
  if (authors) query = query.in('user_id', authors)

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}
