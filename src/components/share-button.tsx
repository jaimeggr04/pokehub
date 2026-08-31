'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'

/**
 * Compartir con la API nativa del sistema y, donde no exista (escritorio), caer
 * en copiar el enlace al portapapeles.
 */
export function useShare(path: string, title: string) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // `navigator.share` sólo existe en el cliente: comprobarlo durante el render
  // rompería la hidratación.
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(id)
  }, [copied])

  async function share() {
    const url = `${window.location.origin}${path}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // El usuario canceló el diálogo, o el portapapeles está bloqueado.
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
      } catch { /* sin portapapeles disponible */ }
    }
  }

  return { share, copied, canShare }
}

export function ShareButton({
  path,
  title,
  variant = 'button',
}: {
  path: string
  title: string
  variant?: 'button' | 'icon'
}) {
  const { share, copied, canShare } = useShare(path, title)
  const label = copied ? 'Enlace copiado' : canShare ? 'Compartir' : 'Copiar enlace'
  const Icon = copied ? Check : canShare ? Share2 : Copy

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={share}
        aria-label={label}
        title={label}
        className={`flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition hover:bg-line/40 sm:min-h-0 sm:min-w-0 sm:px-2.5 sm:py-1 ${
          copied ? 'text-emerald-500' : ''
        }`}
      >
        <Icon size={17} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-card transition active:translate-y-0.5 ${
        copied ? 'bg-emerald-500 text-white' : 'bg-surface-2 hover:bg-line'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  )
}
