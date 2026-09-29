'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'

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

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast('Enlace copiado', { tone: 'success' })
    } catch {
      toast('No se pudo copiar el enlace', {
        tone: 'error',
        description: 'Tu navegador no deja usar el portapapeles.',
      })
    }
  }

  async function share() {
    const url = `${window.location.origin}${path}`
    if (typeof navigator.share !== 'function') {
      await copy(url)
      return
    }
    try {
      await navigator.share({ title, url })
    } catch (error) {
      // Cerrar la hoja de compartir no es un error: el usuario ha cambiado de idea.
      if (error instanceof DOMException && error.name === 'AbortError') return
      await copy(url)
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

  // La key vuelve a montar el icono en cada cambio para que entre con un pop.
  const icon = (
    <Icon
      key={copied ? 'ok' : 'idle'}
      size={variant === 'icon' ? 18 : 16}
      aria-hidden
      className={clsx(copied && 'animate-pop text-success')}
    />
  )

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={share}
        aria-label={label}
        title={label}
        className="btn btn-ghost btn-icon hover:text-ink"
      >
        {icon}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className={clsx('btn', copied ? 'bg-success-soft text-success shadow-card' : 'btn-soft')}
    >
      {icon}
      {label}
    </button>
  )
}
