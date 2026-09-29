import { genFor, showdownSpeciesName } from '@/lib/battle/dex'
import type { BattleTeam } from '@/lib/battle/teams.server'
import type { TeamOption } from '@/components/battle/setup/link'

/*
 * Resumen de un equipo de PokeHub para el selector de la portada. Se calcula
 * en el servidor: así los datos de @smogon/calc no viajan al navegador sólo
 * para poner nombre a seis sprites.
 */

const champions = genFor({ calcGen: 0 })
const sv = genFor({ calcGen: 9 })

/** Nombre de Showdown de un slug de PokeHub; primero Champions y luego Escarlata y Púrpura. */
export function speciesOfBuild(slug: string): string {
  return showdownSpeciesName(champions, slug) ?? showdownSpeciesName(sv, slug) ?? slug
}

export function toTeamOption(team: BattleTeam): TeamOption {
  return {
    id: team.id,
    name: team.name,
    format: team.format,
    species: team.builds.map((b) => speciesOfBuild(b.pokemon_name)),
  }
}

