'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import clsx from 'clsx'
import { useLockBodyScroll, useMounted } from '@/lib/hooks'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

const DISMISS_OFFSET = 120
const DISMISS_VELOCITY = 500

/**
 * Hoja inferior modal. Se arrastra hacia abajo desde el asa (no desde el
 * contenido, para que el scroll interno no compita con el gesto), se cierra
 * con Esc o tocando fuera y mantiene el foco dentro mientras está abierta.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  showTitle = false,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  /** Siempre obligatorio: da nombre al diálogo aunque no se pinte. */
  title: React.ReactNode
  showTitle?: boolean
  children: React.ReactNode
  className?: string
}) {
  const mounted = useMounted()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  // Ref para que un onClose en línea del padre no reinicie el efecto de foco.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const active = open && mounted
  useLockBodyScroll(active)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Al panel y no al primer campo: en móvil, enfocar un input abriría el teclado de golpe.
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }))

    function onKeyDown(e: KeyboardEvent) {
      // Con una hoja abierta encima de otra (un selector dentro de una ficha),
      // sólo manda la de arriba: los portales se añaden al final del body.
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs.length > 1 && dialogs[dialogs.length - 1] !== panelRef.current) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const current = document.activeElement
      if (!panel.contains(current)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
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
        <div key="bottom-sheet" className="fixed inset-0 z-60">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => onCloseRef.current()}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={clsx(
              'absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-bg-elevated text-ink shadow-float outline-none',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { type: 'spring', stiffness: 380, damping: 40 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            // Casi rígida hacia arriba, suelta hacia abajo: invita a bajarla, no a subirla.
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onCloseRef.current()
            }}
          >
            <div
              className="shrink-0 cursor-grab touch-none select-none px-5 pb-1 pt-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span aria-hidden className="mx-auto block h-1.5 w-10 rounded-full bg-line" />
              <h2
                id={titleId}
                className={showTitle ? 'pt-3 text-center text-base font-bold leading-snug' : 'sr-only'}
              >
                {title}
              </h2>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
