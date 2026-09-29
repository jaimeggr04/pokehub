'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { unstable_rethrow } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Leaf, LoaderCircle, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { deleteTeam } from '@/app/actions/teams'
import { Pokeball } from '@/components/pokeball'
import { toast } from '@/components/ui/toast'
import { useLockBodyScroll, useMounted } from '@/lib/hooks'
import { spriteUrl } from '@/lib/pokemon'

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

// Hacia dónde sale cada Pokémon al liberarlo: abanico fijo, igual en servidor y cliente.
const DRIFT = [
  { dx: '-46px', rot: '-24deg' },
  { dx: '38px', rot: '20deg' },
  { dx: '-20px', rot: '-12deg' },
  { dx: '54px', rot: '28deg' },
  { dx: '-60px', rot: '-30deg' },
  { dx: '16px', rot: '10deg' },
]

/** La acción redirige al terminar bien: esa "excepción" es la señal de éxito. */
function isRedirect(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest.startsWith('NEXT_REDIRECT')
  )
}

/**
 * Borrar un equipo, con un diálogo propio en lugar de confirm(): el equipo se
 * "libera" y sus Pokémon vuelven a la naturaleza. En móvil el botón es sólo
 * icono; la etiqueta sigue ahí para lectores de pantalla.
 */
export function DeleteTeamButton({
  teamId,
  teamName,
  pokemonIds = [],
  className,
}: {
  teamId: string
  /** Para nombrar el equipo en el diálogo. */
  teamName?: string
  /** Sprites que se despiden en el diálogo (como mucho seis). */
  pokemonIds?: number[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function release() {
    startTransition(async () => {
      try {
        const result = await deleteTeam(teamId)
        if (result?.error) toast('No se pudo liberar el equipo', { tone: 'error', description: result.error })
      } catch (error) {
        if (isRedirect(error)) {
          toast('Equipo liberado', {
            tone: 'success',
            description: 'Tus Pokémon ya corretean por la naturaleza.',
          })
        } else {
          toast('No se pudo liberar el equipo', {
            tone: 'error',
            description: 'Comprueba tu conexión e inténtalo de nuevo.',
          })
        }
        // La redirección la tiene que recoger Next para navegar a /home.
        unstable_rethrow(error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Eliminar equipo"
        className={clsx('btn btn-danger max-sm:w-11 max-sm:px-0', className)}
      >
        <Trash2 size={16} aria-hidden />
        <span className="max-sm:sr-only">Eliminar</span>
      </button>

      <ReleaseDialog
        open={open}
        pending={pending}
        teamName={teamName}
        pokemonIds={pokemonIds.slice(0, 6)}
        onClose={() => setOpen(false)}
        onConfirm={release}
      />
    </>
  )
}

function ReleaseDialog({
  open,
  pending,
  teamName,
  pokemonIds,
  onClose,
  onConfirm,
}: {
  open: boolean
  pending: boolean
  teamName?: string
  pokemonIds: number[]
  onClose: () => void
  onConfirm: () => void
}) {
  const mounted = useMounted()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Refs para que el efecto de foco no se reinicie con cada render del padre.
  const latest = useRef({ onClose, pending })
  useEffect(() => {
    latest.current = { onClose, pending }
  })

  const active = open && mounted
  useLockBodyScroll(active)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // "Cancelar" primero: en una acción destructiva, lo seguro es lo que queda a mano.
    const frame = requestAnimationFrame(() => cancelRef.current?.focus())

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!latest.current.pending) latest.current.onClose()
        return
      }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const current = document.activeElement
      if (!panel.contains(current) || (e.shiftKey && current === first)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
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
        <div
          key="release-dialog"
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <motion.div
            aria-hidden
            className="fixed inset-0 bg-black/55 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={() => {
              if (!pending) onClose()
            }}
          />

          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={pending || undefined}
            tabIndex={-1}
            data-releasing={pending || undefined}
            className="relative w-full max-w-sm rounded-3xl bg-bg-elevated p-6 text-center text-ink shadow-float outline-none sm:p-7"
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.16, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          >
            <div aria-hidden className="relative mx-auto mb-5 flex h-28 w-full max-w-[16rem] flex-col items-center justify-end">
              {pokemonIds.length > 0 && (
                <ul className="absolute inset-x-0 top-0 flex justify-center">
                  {pokemonIds.map((id, i) => (
                    <li
                      key={`${id}-${i}`}
                      className="team-release-sprite -mx-1.5"
                      style={
                        {
                          '--i': i,
                          '--dx': DRIFT[i % DRIFT.length].dx,
                          '--rot': DRIFT[i % DRIFT.length].rot,
                          // Arco suave: los de los extremos, un poco más abajo.
                          marginTop: `${Math.abs(i - (pokemonIds.length - 1) / 2) * 5}px`,
                        } as React.CSSProperties
                      }
                    >
                      <Image
                        src={spriteUrl(id)}
                        alt=""
                        width={48}
                        height={48}
                        unoptimized
                        draggable={false}
                        className="h-12 w-12 object-contain [image-rendering:pixelated]"
                      />
                    </li>
                  ))}
                </ul>
              )}
              <Pokeball className="team-release-ball relative h-14 w-14 drop-shadow-md" />
              <span className="mt-1 h-1.5 w-10 rounded-[50%] bg-black/15 blur-[2px] dark:bg-black/40" />
            </div>

            <h2 id={titleId} className="text-xl font-extrabold leading-tight tracking-tight">
              ¿Liberar este equipo?
            </h2>
            <p id={descriptionId} className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
              {teamName ? (
                <>
                  <strong className="font-semibold text-ink [overflow-wrap:anywhere]">«{teamName}»</strong> y sus
                  Pokémon volverán a la naturaleza.
                </>
              ) : (
                'Este equipo y sus Pokémon volverán a la naturaleza.'
              )}{' '}
              Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className="btn btn-soft">
                Cancelar
              </button>
              {/* No se deshabilita: seguiría enfocado y a plena opacidad mientras dura. */}
              <button
                type="button"
                onClick={() => {
                  if (!pending) onConfirm()
                }}
                className="btn team-danger-solid"
              >
                {pending ? (
                  <LoaderCircle size={16} aria-hidden className="animate-spin" />
                ) : (
                  <Leaf size={16} aria-hidden />
                )}
                {pending ? 'Liberando…' : 'Liberar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
