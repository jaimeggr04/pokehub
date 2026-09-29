import { Fragment } from 'react'
import clsx from 'clsx'
import { highlightParts } from '@/lib/search'

/** Marca en `text` lo que coincide con `term` (sin distinguir tildes ni mayúsculas). */
export function Highlight({ text, term, className }: { text: string; term: string; className?: string }) {
  return (
    <>
      {highlightParts(text, term).map((part, i) =>
        part.match ? (
          <mark key={i} className={clsx('search-mark', className)}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}
