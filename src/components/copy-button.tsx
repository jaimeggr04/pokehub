'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyButton({
  text,
  label = 'Importar',
  copiedLabel = '¡Copiado!',
  className = '',
}: {
  text: string
  label?: string
  copiedLabel?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          /* el navegador bloqueó el portapapeles */
        }
      }}
      title="Copia el equipo en formato Pokémon Showdown"
      className={
        className ||
        'flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-card transition hover:bg-brand-strong active:translate-y-0.5'
      }
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? copiedLabel : label}
    </button>
  )
}
