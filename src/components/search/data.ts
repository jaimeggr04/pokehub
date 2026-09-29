import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { TEAM_SELECT, getFollowingIds, withLikes } from '@/lib/queries'
import { loadEsIndex } from '@/lib/showdown-i18n'
import { MIN_SUGGEST_CHARS, escapeLike, pokemonSlug } from '@/lib/search'
import { prettify } from '@/lib/pokemon'
import type { UserRowData } from '@/components/user-row'
import type { BuildRow, TeamWithAuthor } from '@/lib/database.types'

/*
 * Consultas de la página de búsqueda. Sólo para componentes de servidor: usa
 * el cliente de Supabase con las cookies de la petición.
 */

export const TEAM_RESULTS_LIMIT = 30
export const TRAINER_RESULTS_LIMIT = 30
const SUGGESTED_LIMIT = 20
const FEATURED_LIMIT = 10
const POPULAR_SAMPLE_TEAMS = 90
const POPULAR_LIMIT = 12

type PokemonRef = Pick<BuildRow, 'pokemon_id' | 'pokemon_name'>

/* ------------------------------ Entrenadores ------------------------------ */

export type TrainerSearch = { users: UserRowData[]; following: Set<string>; capped: boolean }

/** Con término, la RPC de búsqueda; sin él, las sugerencias de a quién seguir. */
export async function searchTrainers(term: string, userId: string): Promise<TrainerSearch | null> {
  const supabase = await createClient()
  const request = term
    ? supabase.rpc('search_profiles', { q: term, limit_count: TRAINER_RESULTS_LIMIT })
    : supabase.rpc('suggested_users', { limit_count: SUGGESTED_LIMIT })
  const [followingIds, { data, error }] = await Promise.all([getFollowingIds(supabase, userId), request])
  if (error) return null

  const users = (data ?? []) as unknown as UserRowData[]
  return {
    users,
    following: new Set(followingIds),
    capped: Boolean(term) && users.length === TRAINER_RESULTS_LIMIT,
  }
}

/* ------------------------------ Equipos ------------------------------ */

export type Spotlight = { id: number; name: string; teams: number; capped: boolean }

export type TeamSearch = {
  teams: TeamWithAuthor[]
  /** Hay más resultados de los que se enseñan. */
  capped: boolean
  /** Pokémon que protagoniza la búsqueda, si lo escrito lo identifica. */
  spotlight: Spotlight | null
  /** Nombre en inglés cuando se ha buscado por el nombre español («Colmilargo» → «Great Tusk»). */
  translated: string | null
}

const byPopularity = (a: TeamWithAuthor, b: TeamWithAuthor) =>
  b.like_count - a.like_count || b.created_at.localeCompare(a.created_at)

/**
 * Casi todos los Pokémon se llaman igual en español; el índice sólo recoge los
 * que cambian (Colmilargo, Ferropaladín…) y ya se usa para importar equipos.
 */
async function resolvePokemonTerm(term: string): Promise<{ slug: string; translated: string | null }> {
  const slug = pokemonSlug(term)
  if (!slug) return { slug, translated: null }
  try {
    const english = (await loadEsIndex()).species[slug]
    if (english) return { slug: english, translated: english }
  } catch {
    // Sin índice se busca tal cual: el nombre inglés sigue funcionando.
  }
  return { slug, translated: null }
}

/**
 * Equipos públicos cuyo nombre contiene el término o que llevan un Pokémon que
 * coincide. Dos consultas en paralelo, cada una con sus 30 más populares: la
 * unión de ambas contiene seguro los 30 más populares del total.
 */
export async function searchTeams(term: string, userId: string): Promise<TeamSearch | null> {
  const supabase = await createClient()
  const { slug, translated } = await resolvePokemonTerm(term)
  const searchPokemon = slug.length >= MIN_SUGGEST_CHARS

  const [byName, byPokemon] = await Promise.all([
    supabase
      .from('teams')
      .select(TEAM_SELECT)
      .eq('is_public', true)
      .ilike('name', `%${escapeLike(term)}%`)
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(TEAM_RESULTS_LIMIT),
    searchPokemon
      ? // La segunda copia de builds, con alias y !inner, sólo sirve para
        // filtrar: el equipo entra si alguno de sus Pokémon coincide, y
        // `builds` sigue trayendo el equipo completo para la tarjeta.
        supabase
          .from('teams')
          .select(`${TEAM_SELECT}, match:builds!inner(pokemon_id, pokemon_name)`)
          .eq('is_public', true)
          .ilike('match.pokemon_name', `%${slug}%`)
          .order('like_count', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(TEAM_RESULTS_LIMIT)
      : null,
  ])

  const pokemonFailed = Boolean(byPokemon?.error)
  if (byName.error && (!searchPokemon || pokemonFailed)) return null

  const nameRows = byName.error ? [] : ((byName.data ?? []) as unknown as TeamWithAuthor[])
  const pokemonRows = ((byPokemon && !byPokemon.error ? byPokemon.data : null) ?? []) as unknown as (TeamWithAuthor & {
    match: PokemonRef[]
  })[]

  const merged = new Map<string, TeamWithAuthor>()
  // Cuántos equipos del resultado lleva cada Pokémon coincidente.
  const usage = new Map<string, { id: number; teams: number }>()

  for (const { match, ...team } of pokemonRows) {
    merged.set(team.id, team)
    for (const name of new Set(match.map((m) => m.pokemon_name))) {
      const id = match.find((m) => m.pokemon_name === name)?.pokemon_id ?? 0
      const entry = usage.get(name)
      if (entry) entry.teams += 1
      else usage.set(name, { id, teams: 1 })
    }
  }
  for (const team of nameRows) if (!merged.has(team.id)) merged.set(team.id, team)

  const all = [...merged.values()].sort(byPopularity)
  const teams = await withLikes(supabase, all.slice(0, TEAM_RESULTS_LIMIT), userId)

  return {
    teams,
    capped:
      all.length > TEAM_RESULTS_LIMIT ||
      nameRows.length === TEAM_RESULTS_LIMIT ||
      pokemonRows.length === TEAM_RESULTS_LIMIT,
    spotlight: pickSpotlight(usage, slug, pokemonRows.length === TEAM_RESULTS_LIMIT),
    translated: translated ? prettify(translated) : null,
  }
}

/**
 * El Pokémon más repetido entre las coincidencias, sólo si lo escrito es un
 * buen trozo del principio de su nombre: «garch» destaca a Garchomp, pero ni
 * «mega» destaca a una megaevolución concreta ni «sun» (de «Sun team») a Sunkern.
 */
function pickSpotlight(
  usage: Map<string, { id: number; teams: number }>,
  slug: string,
  capped: boolean,
): Spotlight | null {
  const identifies = (name: string) =>
    name === slug || (name.startsWith(slug) && slug.length >= 4 && slug.length / name.length >= 0.4)

  let best: Spotlight | null = null
  for (const [name, { id, teams }] of usage) {
    if (!id || !identifies(name)) continue
    const better =
      !best ||
      teams > best.teams ||
      (teams === best.teams && (name === slug || (best.name !== slug && name.length < best.name.length)))
    if (better) best = { id, name, teams, capped }
  }
  return best
}

/** Los equipos públicos que más gustan: el escaparate cuando no se busca nada. */
export async function getFeaturedTeams(userId: string): Promise<TeamWithAuthor[] | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .eq('is_public', true)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(FEATURED_LIMIT)
  if (error) return null
  return withLikes(supabase, (data ?? []) as unknown as TeamWithAuthor[], userId)
}

/* ------------------------------ Descubrir ------------------------------ */

export type PopularPokemon = { id: number; name: string; teams: number }
export type PopularSnapshot = { pokemon: PopularPokemon[]; sampled: number }

/**
 * Pokémon más usados en los últimos equipos públicos, contados aquí en el
 * servidor. Una sola consulta: los equipos traen anidados sus Pokémon. Con
 * cache() la columna lateral y la sección móvil comparten el resultado.
 */
export const getPopularPokemon = cache(async (): Promise<PopularSnapshot | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('builds(pokemon_id, pokemon_name)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(POPULAR_SAMPLE_TEAMS)
  if (error) return null

  const rows = (data ?? []) as unknown as { builds: PokemonRef[] }[]
  const counts = new Map<string, PopularPokemon>()
  for (const { builds } of rows) {
    // Por equipo y no por ficha: dos Garchomp en un mismo equipo cuentan uno.
    for (const name of new Set(builds.map((b) => b.pokemon_name))) {
      const entry = counts.get(name)
      if (entry) entry.teams += 1
      else counts.set(name, { id: builds.find((b) => b.pokemon_name === name)?.pokemon_id ?? 0, name, teams: 1 })
    }
  }

  const pokemon = [...counts.values()]
    .filter((p) => p.id > 0)
    .sort((a, b) => b.teams - a.teams || a.name.localeCompare(b.name))
    .slice(0, POPULAR_LIMIT)
  return { pokemon, sampled: rows.length }
})

export type CommunityStats = { teams: number; trainers: number }

/** Tamaño de la comunidad para la cabecera. Sólo cuenta (head), no trae filas. */
export const getCommunityStats = cache(async (): Promise<CommunityStats | null> => {
  const supabase = await createClient()
  const [teams, trainers] = await Promise.all([
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])
  if (teams.error || trainers.error) return null
  return { teams: teams.count ?? 0, trainers: trainers.count ?? 0 }
})
