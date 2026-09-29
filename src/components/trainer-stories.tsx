import Link from 'next/link'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/avatar'

export type StoryTrainer = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

/**
 * Fila de entrenadores sugeridos al estilo "historias", para móvil y tableta:
 * por debajo de xl la columna derecha (con las sugerencias) no se ve. Se
 * desliza con el dedo y encaja en cada avatar; los bordes se difuminan.
 */
export function TrainerStories({ users, className }: { users: StoryTrainer[]; className?: string }) {
  if (users.length === 0) return null

  return (
    <section aria-labelledby="feed-stories-title" className={clsx('-mx-3 sm:mx-0', className)}>
      <div className="flex items-center justify-between gap-3 px-3 sm:px-0">
        <h2 id="feed-stories-title" className="text-xs font-bold uppercase tracking-wide text-muted">
          Entrenadores que quizá conozcas
        </h2>
        <Link
          href="/search?tipo=entrenadores"
          className="-mr-2 inline-flex h-10 shrink-0 items-center rounded-full px-2 text-xs font-semibold text-brand transition-colors hover:text-brand-strong"
        >
          Ver más
        </Link>
      </div>

      {/* El padding lateral deja al primer y al último avatar fuera del difuminado de los bordes. */}
      <ul className="feed-stories no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-1 overflow-x-auto overscroll-x-contain px-3 pb-1 pt-1">
        {users.map((user, i) => (
          <li key={user.id} className="stagger-item shrink-0 snap-start" style={{ '--i': i } as React.CSSProperties}>
            <Link
              href={`/u/${user.username}`}
              title={user.display_name?.trim() || undefined}
              className="feed-story pressable flex w-[4.75rem] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5"
            >
              <span className="feed-story-ring">
                <span className="block rounded-full bg-bg p-[2px]">
                  <Avatar src={user.avatar_url} name={user.username} size={58} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium leading-tight">@{user.username}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
