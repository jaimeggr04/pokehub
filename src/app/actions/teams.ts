'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Gender } from '@/lib/database.types'

export interface BuildInput {
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

export interface TeamInput {
  name: string
  description: string
  format: string
  is_public: boolean
  builds: BuildInput[]
}

export interface SaveResult {
  error?: string
}

const IV_KEYS = ['hp_ivs', 'atk_ivs', 'def_ivs', 'spa_ivs', 'spd_ivs', 'spe_ivs'] as const
const EV_KEYS = ['hp_evs', 'atk_evs', 'def_evs', 'spa_evs', 'spd_evs', 'spe_evs'] as const

function validate(input: TeamInput): string | null {
  if (!input.name.trim()) return 'El equipo necesita un nombre.'
  if (input.name.length > 40) return 'El nombre no puede superar 40 caracteres.'
  if (input.description.length > 1000) return 'La descripción no puede superar 1000 caracteres.'
  if (input.builds.length === 0) return 'Añade al menos un Pokémon.'
  if (input.builds.length > 6) return 'Un equipo no puede tener más de 6 Pokémon.'

  for (const b of input.builds) {
    if (!b.pokemon_id || !b.pokemon_name) return `El hueco ${b.slot} no tiene Pokémon.`
    if (b.level < 1 || b.level > 100) return `Nivel inválido en el hueco ${b.slot}.`
    if (b.moves.length > 4) return `Máximo 4 movimientos (hueco ${b.slot}).`
    for (const k of IV_KEYS) if (b[k] < 0 || b[k] > 31) return `IVs inválidos en el hueco ${b.slot}.`
    for (const k of EV_KEYS) if (b[k] < 0 || b[k] > 252) return `EVs inválidos en el hueco ${b.slot}.`
    const total = EV_KEYS.reduce((a, k) => a + b[k], 0)
    if (total > 508) return `El hueco ${b.slot} supera los 508 EVs (${total}).`
  }
  return null
}

function normalise(builds: BuildInput[]) {
  return builds.map((b, i) => ({
    ...b,
    slot: i + 1,
    nickname: b.nickname?.trim() || null,
    moves: b.moves.filter(Boolean).slice(0, 4),
  }))
}

export async function createTeam(input: TeamInput): Promise<SaveResult> {
  const problem = validate(input)
  if (problem) return { error: problem }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Tienes que iniciar sesión.' }

  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description.trim(),
      format: input.format.trim() || 'VGC',
      is_public: input.is_public,
    })
    .select('id')
    .single()

  if (error || !team) return { error: 'No se pudo crear el equipo.' }

  const { error: buildError } = await supabase
    .from('builds')
    .insert(normalise(input.builds).map((b) => ({ ...b, team_id: team.id })))

  if (buildError) {
    await supabase.from('teams').delete().eq('id', team.id)
    return { error: 'No se pudieron guardar los Pokémon: ' + buildError.message }
  }

  revalidatePath('/home')
  redirect(`/team/${team.id}`)
}

export async function updateTeam(teamId: string, input: TeamInput): Promise<SaveResult> {
  const problem = validate(input)
  if (problem) return { error: problem }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Tienes que iniciar sesión.' }

  const { error } = await supabase
    .from('teams')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      format: input.format.trim() || 'VGC',
      is_public: input.is_public,
    })
    .eq('id', teamId)
    .eq('user_id', user.id)

  if (error) return { error: 'No se pudo actualizar el equipo.' }

  // Los huecos se reescriben enteros: así el orden y los que se han quitado
  // quedan como en el creador sin tener que calcular diferencias.
  const { error: clearError } = await supabase.from('builds').delete().eq('team_id', teamId)
  if (clearError) return { error: 'No se pudieron actualizar los Pokémon del equipo.' }

  const { error: buildError } = await supabase
    .from('builds')
    .insert(normalise(input.builds).map((b) => ({ ...b, team_id: teamId })))

  if (buildError) return { error: 'No se pudieron guardar los Pokémon: ' + buildError.message }

  revalidatePath('/home')
  revalidatePath(`/team/${teamId}`)
  redirect(`/team/${teamId}`)
}

export async function deleteTeam(teamId: string): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Tienes que iniciar sesión.' }

  const { error } = await supabase.from('teams').delete().eq('id', teamId).eq('user_id', user.id)
  if (error) return { error: 'No se pudo eliminar el equipo.' }

  revalidatePath('/home')
  redirect('/home')
}
