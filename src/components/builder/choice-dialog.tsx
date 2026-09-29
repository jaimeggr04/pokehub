'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useLockBodyScroll, useMediaQuery, useMounted } from '@/lib/hooks'

export type DialogChoice = {
  label: string
  description?: string
  icon?: React.ReactNode
  tone?: 'primary' | 'soft' | 'danger'
  disabled?: boolean
  onSelect: () => void
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pregunta con dos o tres salidas. En el móvil es una hoja inferior (se
 * alcanza con el pulgar); a partir de 640 px, un diálogo centrado. Esc cierra
 * y el foco vuelve a quien lo abrió.
 */
export function ChoiceDialog({
  open,
  onClose,
  title,
  description,
  choices,
  cancelLabel = 'Cancelar',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  choices: DialogChoice[]
  cancelLabel?: string
}) {
  const wide = useMediaQuery('(min-width: 640px)')

  const body = (
    <ChoiceList
      description={description}
      choices={choices}
      cancelLabel={cancelLabel}
      onClose={onClose}
    />
  )

  if (!wide) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title} showTitle>
        {body}
      </BottomSheet>
    )
  }

  return (
    <CenteredDialog open={open} onClose={onClose} title={title}>
      {body}
    </CenteredDialog>
  )
}

function ChoiceList({
  description,
  choices,
  cancelLabel,
  onClose,
}: {
  description?: React.ReactNode
  choices: DialogChoice[]
  cancelLabel: string
  onClose: () => void
}) {
  return (
    <div>
      {description && <p className="mb-4 text-center text-sm text-muted sm:text-left">{description}</p>}
      <div className="flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={c.disabled}
            onClick={() => {
              onClose()
              c.onSelect()
            }}
            className={clsx(
              'pressable flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50',
              c.tone === 'primary' && 'bg-brand text-brand-fg shadow-card hover:bg-brand-strong',
              c.tone === 'danger' && 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
              (!c.tone || c.tone === 'soft') && 'bg-surface-2 text-ink shadow-card hover:bg-line',
            )}
          >
            {c.icon && <span className="grid h-9 w-9 shrink-0 place-items-center">{c.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{c.label}</span>
              {c.description && <span className="block text-xs opacity-80">{c.description}</span>}
            </span>
          </button>
        ))}
        <button type="button" onClick={onClose} className="btn btn-ghost mt-1 w-full">
          {cancelLabel}
        </button>
      </div>
    </div>
  )
}

function CenteredDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const mounted = useMounted()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const active = open && mounted
  useLockBodyScroll(active)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
    })

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!panel.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus({ preventScroll: true })
    }
  }, [active])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="choice-dialog" className="fixed inset-0 z-60 grid place-items-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => onCloseRef.current()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-md rounded-3xl border border-line bg-bg-elevated p-6 text-ink shadow-float"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          >
            <h2 id={titleId} className="mb-1.5 text-lg font-extrabold leading-snug">
              {title}
            </h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
