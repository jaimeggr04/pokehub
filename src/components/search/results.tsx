import Link from 'next/link'
import { Languages, SearchX, Swords, Trophy, TriangleAlert, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamCard } from '@/components/team-card'
import { UserRow, type UserRowData } from '@/components/user-row'
import { PokemonSpotlight } from '@/components/search/pokemon-spotlight'
import {
  TEAM_RESULTS_LIMIT,
  TRAINER_RESULTS_LIMIT,
  getFeaturedTeams,
  searchTeams,
  searchTrainers,
} from '@/components/search/data'
import { searchHref, type SearchTipo } from '@/lib/search'

/*
 * Resultados de /search. Componentes de servidor que la página envuelve en
 * Suspense (con los esqueletos de skeletons.tsx, que calcan esta geometría).
 */

const RESULTS_TITLE_ID = 'search-results-title'

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** El término tal cual se escribió, sin romper la maqueta si es una palabra muy larga. */
function Term({ children }: { children: string }) {
  return <span className="[overflow-wrap:anywhere]">«{children}»</span>
}

/** Título de la lista. Misma geometría que HeadingSkeleton. */
function ResultsHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={RESULTS_TITLE_ID} className="text-base font-extrabold leading-tight tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  )
}

function CappedNote({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto mt-5 max-w-sm text-balance text-center text-xs text-muted">{children}</p>
}

function ResultsError({ q, tipo }: { q: string; tipo: SearchTipo }) {
  return (
    <EmptyState
      icon={<TriangleAlert size={28} aria-hidden />}
      title="No se pudo completar la búsqueda"
      description="Ha habido un problema al hablar con el servidor. Vuelve a intentarlo en unos segundos."
      action={
        <Link href={searchHref({ q, tipo })} className="btn btn-primary">
          Reintentar
        </Link>
      }
    />
  )
}

/* ------------------------------ Entrenadores ------------------------------ */

function trainerMeta(user: UserRowData, searching: boolean): string | undefined {
  if (searching) return typeof user.team_count === 'number' ? count(user.team_count, 'equipo', 'equipos') : undefined
  return typeof user.follower_count === 'number' ? count(user.follower_count, 'seguidor', 'seguidores') : undefined
}

/** Con término, quién coincide; sin él, a quién seguir. */
export async function TrainerResults({ term, userId }: { term: string; userId: string }) {
  const result = await searchTrainers(term, userId)
  if (!result) return <ResultsError q={term} tipo="entrenadores" />

  const { users, following, capped } = result

  if (users.length === 0) {
    return term ? (
      <EmptyState
        icon={<SearchX size={28} aria-hidden />}
        title={
          <>
            Ningún entrenador coincide con <Term>{term}</Term>
          </>
        }
        description="Prueba con otra parte del nombre o del usuario. ¿Buscabas un equipo o un Pokémon?"
        action={
          <>
            <Link href={searchHref({ q: term, tipo: 'equipos' })} className="btn btn-primary">
              <Swords size={17} aria-hidden />
              Buscar en equipos
            </Link>
            <Link href={searchHref({})} className="btn btn-soft">
              Ver sugerencias
            </Link>
          </>
        }
      />
    ) : (
      <EmptyState
        icon={<Users size={28} aria-hidden />}
        title="No hay nadie más que sugerirte"
        description="Ya sigues a todos los entrenadores de PokeHub. Cuando llegue alguien nuevo, aparecerá aquí."
        action={
          <Link href={searchHref({ tipo: 'equipos' })} className="btn btn-soft">
            Descubrir equipos
          </Link>
        }
      />
    )
  }

  return (
    <section aria-labelledby={RESULTS_TITLE_ID}>
      {term ? (
        <ResultsHeading
          icon={<Users size={18} />}
          title={
            <>
              Entrenadores con <Term>{term}</Term>
            </>
          }
          subtitle={`${users.length}${capped ? '+' : ''} ${users.length === 1 && !capped ? 'resultado' : 'resultados'} · los más parecidos primero`}
        />
      ) : (
        <ResultsHeading
          icon={<UserPlus size={18} />}
          title="Entrenadores que quizá conozcas"
          subtitle="Los más seguidos entre los que aún no sigues"
        />
      )}

      <ul className="grid gap-2 md:grid-cols-2">
        {users.map((user, i) => (
          <UserRow
            key={user.id}
            user={user}
            meId={userId}
            following={following.has(user.id)}
            highlight={term || undefined}
            meta={trainerMeta(user, Boolean(term))}
            index={i}
          />
        ))}
      </ul>

      {capped && (
        <CappedNote>
          Se muestran los {TRAINER_RESULTS_LIMIT} que mejor encajan. Escribe algo más para afinar la búsqueda.
        </CappedNote>
      )}
    </section>
  )
}

/* ------------------------------ Equipos ------------------------------ */

/** Con término, equipos por nombre o por Pokémon; sin él, los destacados. */
export async function TeamResults({ term, userId }: { term: string; userId: string }) {
  if (!term) return <FeaturedTeams userId={userId} />

  const result = await searchTeams(term, userId)
  if (!result) return <ResultsError q={term} tipo="equipos" />

  const { teams, capped, spotlight, translated } = result
  const typed = term.charAt(0).toUpperCase() + term.slice(1)

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={<SearchX size={28} aria-hidden />}
        title={
          <>
            Ningún equipo coincide con <Term>{term}</Term>
          </>
        }
        description={
          translated
            ? `Hemos buscado a ${translated}, pero aún no está en ningún equipo público. ¡Sé el primero en usarlo!`
            : 'Busca por el nombre del equipo o por un Pokémon, en inglés o en español.'
        }
        action={
          <>
            <Link href="/team/new" className="btn btn-primary">
              Crear un equipo
            </Link>
            <Link href={searchHref({ q: term, tipo: 'entrenadores' })} className="btn btn-soft">
              <Users size={17} aria-hidden />
              Buscar en entrenadores
            </Link>
          </>
        }
      />
    )
  }

  return (
    <section aria-labelledby={RESULTS_TITLE_ID}>
      <ResultsHeading
        icon={<Swords size={18} />}
        title={
          <>
            Equipos con <Term>{term}</Term>
          </>
        }
        subtitle={`${teams.length}${capped ? '+' : ''} ${teams.length === 1 && !capped ? 'equipo' : 'equipos'} · los que más gustan primero`}
      />

      {translated && (
        <p className="mb-4 inline-flex max-w-full animate-fade-in items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] leading-snug">
          <Languages size={15} aria-hidden className="shrink-0 text-brand" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Buscando <strong className="font-bold">{translated}</strong> ({typed})
          </span>
        </p>
      )}

      {spotlight && (
        <div className="mb-4">
          <PokemonSpotlight
            key={spotlight.id}
            pokemonId={spotlight.id}
            name={spotlight.name}
            teams={spotlight.teams}
            capped={spotlight.capped}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {teams.map((team, i) => (
          <TeamCard key={team.id} team={team} index={i} />
        ))}
      </div>

      {capped && (
        <CappedNote>
          Se muestran los {TEAM_RESULTS_LIMIT} equipos que más gustan. Afina la búsqueda para encontrar otros.
        </CappedNote>
      )}
    </section>
  )
}

async function FeaturedTeams({ userId }: { userId: string }) {
  const teams = await getFeaturedTeams(userId)
  if (!teams) return <ResultsError q="" tipo="equipos" />

  if (teams.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay equipos públicos"
        description="La comunidad está esperando su primer equipo. Créalo desde cero o impórtalo desde Showdown."
        action={
          <Link href="/team/new" className="btn btn-primary">
            Crear mi primer equipo
          </Link>
        }
      />
    )
  }

  return (
    <section aria-labelledby={RESULTS_TITLE_ID}>
      <ResultsHeading
        icon={<Trophy size={18} />}
        title="Equipos destacados"
        subtitle="Los equipos públicos que más gustan a la comunidad"
      />
      <div className="flex flex-col gap-4">
        {teams.map((team, i) => (
          <TeamCard key={team.id} team={team} index={i} />
        ))}
      </div>
    </section>
  )
}
