import { ChevronDown, HelpCircle, Laptop, Lock, Smartphone, Film } from 'lucide-react'
import clsx from 'clsx'

/**
 * «¿Dónde encuentro el enlace?»: acordeón nativo (funciona sin JS y el
 * lector de pantalla anuncia si está abierto). Frases cortas: se lee de pie,
 * con el combate ya empezado.
 */
export function LinkHelp({ className }: { className?: string }) {
  const tips = [
    {
      icon: Laptop,
      title: 'En el PC',
      body: (
        <>
          Cuando empiece el combate, copia la dirección de la pestaña. Empieza por{' '}
          <span className="font-semibold text-ink">play.pokemonshowdown.com/battle-</span>.
        </>
      ),
    },
    {
      icon: Smartphone,
      title: 'En el móvil',
      body: <>En el navegador, toca «Compartir» y luego «Copiar enlace».</>,
    },
    {
      icon: Film,
      title: 'Repeticiones',
      body: <>Al acabar, pulsa «Upload and share replay» y copia el enlace que sale.</>,
    },
    {
      icon: Lock,
      title: 'Combates privados',
      body: <>El enlace acaba en una clave (…-abc123pw). Cópialo entero y funcionará.</>,
    },
  ]

  return (
    <details className={clsx('battle-s-help card', className)}>
      <summary>
        <HelpCircle aria-hidden size={19} className="shrink-0 text-brand" />
        <span className="flex-1">¿Dónde encuentro el enlace?</span>
        <ChevronDown aria-hidden size={18} className="battle-s-help-chevron shrink-0 text-muted" />
      </summary>
      <div className="battle-s-help-body px-4 pb-4">
        <ul className="grid gap-3 sm:grid-cols-2">
          {tips.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon size={17} />
              </span>
              <p className="text-sm text-muted">
                <span className="block font-semibold text-ink">{title}</span>
                {body}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          ¿Nada de eso te vale? Usa el modo manual y marca tú lo que veas.
        </p>
      </div>
    </details>
  )
}
