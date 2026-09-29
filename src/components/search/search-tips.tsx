'use client'

import Link from 'next/link'
import { Command, Languages, Lightbulb, Swords } from 'lucide-react'
import { openCommandPalette, useShortcutLabel } from '@/components/nav-links'
import { searchHref } from '@/lib/search'

const EXAMPLES = ['Garchomp', 'Mega Charizard X']

/** Chuleta de la columna lateral: ejemplos que se pueden pulsar y el atajo de la paleta. */
export function SearchTips() {
  const shortcut = useShortcutLabel()

  return (
    <section aria-labelledby="search-tips-title" className="card p-4">
      <h2 id="search-tips-title" className="flex items-center gap-2 text-sm font-bold">
        <Lightbulb size={16} aria-hidden className="text-warning" />
        Trucos para buscar
      </h2>

      <ul className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted">
        <li className="flex gap-2.5">
          <Swords size={15} aria-hidden className="mt-0.5 shrink-0 text-ink" />
          <span>
            Encuentra equipos por Pokémon, también formas:{' '}
            {EXAMPLES.map((example, i) => (
              <span key={example}>
                {i > 0 && ' o '}
                <Link href={searchHref({ q: example, tipo: 'equipos' })} className="search-tip-link">
                  «{example.toLowerCase()}»
                </Link>
              </span>
            ))}
            .
          </span>
        </li>
        <li className="flex gap-2.5">
          <Languages size={15} aria-hidden className="mt-0.5 shrink-0 text-ink" />
          <span>
            Con su nombre en español:{' '}
            <Link href={searchHref({ q: 'Colmilargo', tipo: 'equipos' })} className="search-tip-link">
              «colmilargo»
            </Link>{' '}
            encuentra a Great Tusk.
          </span>
        </li>
        <li className="flex gap-2.5">
          <Command size={15} aria-hidden className="mt-0.5 shrink-0 text-ink" />
          <span>
            <button type="button" onClick={openCommandPalette} className="search-tip-link">
              Abre la paleta de comandos
            </button>
            {shortcut && (
              <>
                {' '}
                con <kbd className="search-kbd">{shortcut}</kbd>
              </>
            )}{' '}
            para buscar desde cualquier página.
          </span>
        </li>
      </ul>
    </section>
  )
}
