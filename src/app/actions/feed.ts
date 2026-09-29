'use server'

import { createClient } from '@/lib/supabase/server'
import {
  countFeedSince,
  isFeedCursor,
  isFeedTab,
  isIsoDate,
  queryFeedPage,
  type FeedCursor,
  type FeedPage,
  type FeedTab,
} from '@/app/(app)/home/feed-query'

export type FeedPageResult = FeedPage | { error: string }

async function currentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

/** Siguiente página del feed para el scroll infinito. Mismos filtros que la página. */
export async function loadFeedPage({
  tab,
  cursor,
}: {
  tab: FeedTab
  cursor: FeedCursor | null
}): Promise<FeedPageResult> {
  if (!isFeedTab(tab) || (cursor !== null && !isFeedCursor(cursor))) {
    return { error: 'Petición no válida.' }
  }

  const { supabase, userId } = await currentUser()
  if (!userId) return { error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' }

  try {
    const { teams, nextCursor } = await queryFeedPage(supabase, userId, { tab, cursor })
    return { teams, nextCursor }
  } catch {
    return { error: 'No se pudieron cargar más equipos.' }
  }
}

/** Equipos publicados después de `since` (el más reciente que ya se ve), para el aviso de novedades. */
export async function countNewTeams({
  tab,
  since,
}: {
  tab: FeedTab
  since: string
}): Promise<{ count: number } | { error: string }> {
  if (!isFeedTab(tab) || !isIsoDate(since)) return { error: 'Petición no válida.' }

  const { supabase, userId } = await currentUser()
  if (!userId) return { error: 'Sin sesión.' }

  try {
    return { count: await countFeedSince(supabase, userId, { tab, since }) }
  } catch {
    return { error: 'No se pudo comprobar si hay equipos nuevos.' }
  }
}
