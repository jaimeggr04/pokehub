'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'

/**
 * Copia texto al portapapeles. Sin contexto seguro (la app abierta por http
 * desde otro dispositivo de la red) no existe navigator.clipboard, así que se
 * recurre al método antiguo con un textarea temporal.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permiso denegado: se prueba el método antiguo.
  }

  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  // 16 px: con menos, iOS hace zoom al seleccionar el campo.
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' })
  document.body.appendChild(area)
  try {
    area.select()
    area.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
    previous?.focus({ preventScroll: true })
  }
}

/** Estado de "copiado" que caduca solo. Cada copia nueva reinicia la cuenta. */
export function useCopy(resetAfter = 2000) {
  const [copiedAt, setCopiedAt] = useState(0)

  useEffect(() => {
    if (!copiedAt) return
    const id = setTimeout(() => setCopiedAt(0), resetAfter)
    return () => clearTimeout(id)
  }, [copiedAt, resetAfter])

  async function copy(text: string, feedback?: { message: string; description?: string }) {
    const ok = await copyText(text)
    if (ok) {
      setCopiedAt(Date.now())
      if (feedback) toast(feedback.message, { tone: 'success', description: feedback.description })
    } else {
      toast('No se pudo copiar', {
        tone: 'error',
        description: 'Tu navegador no deja usar el portapapeles. Selecciona el texto a mano.',
      })
    }
    return ok
  }

  return { copied: copiedAt > 0, copy }
}

/**
 * Botón de copiar con confirmación: el icono se transforma en un check con un
 * pequeño rebote y sale un aviso. Las dos etiquetas comparten celda, así que
 * el botón no cambia de ancho al confirmar. `className` se suma al estilo base.
 */
export function CopyButton({
  text,
  label = 'Importar',
  copiedLabel = '¡Copiado!',
  className,
  title = 'Copia el equipo en formato Pokémon Showdown',
  variant = 'primary',
  size = 'md',
  toastMessage = 'Copiado al portapapeles',
  toastDescription,
}: {
  text: string
  label?: React.ReactNode
  copiedLabel?: React.ReactNode
  className?: string
  title?: string
  variant?: 'primary' | 'soft'
  size?: 'sm' | 'md'
  toastMessage?: string
  toastDescription?: string
}) {
  const { copied, copy } = useCopy()
  const iconSize = size === 'sm' ? 15 : 16

  return (
    <button
      type="button"
      onClick={() => copy(text, { message: toastMessage, description: toastDescription })}
      title={title}
      data-copied={copied || undefined}
      className={clsx(
        'btn',
        size === 'sm' && 'btn-sm',
        copied ? 'bg-success-soft text-success shadow-card' : variant === 'soft' ? 'btn-soft' : 'btn-primary',
        className,
      )}
    >
      <span aria-hidden className="team-copy-icons">
        <Copy size={iconSize} />
        <Check size={iconSize} strokeWidth={2.75} />
      </span>
      <span className="team-copy-labels">
        <span aria-hidden={copied || undefined}>{label}</span>
        <span aria-hidden={!copied || undefined}>{copiedLabel}</span>
      </span>
    </button>
  )
}
