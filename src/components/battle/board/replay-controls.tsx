'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'

/*
 * Barra de la repetición: anterior, reproducir y siguiente con el pulgar, y
 * un deslizador para saltar a cualquier turno. La reproducción automática se
 * detiene sola al llegar al final.
 */

const STEP_MS = 3000

export function ReplayControls({
  index,
  labels,
  onChange,
}: {
  index: number
  /** Nombre de cada paso ("Vista previa", "Turno 3", "Final"). */
  labels: string[]
  onChange: (index: number) => void
}) {
  const [playing, setPlaying] = useState(false)
  const sliderId = useId()
  const last = labels.length - 1
  const atEnd = index >= last

  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => onChange(index + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, atEnd, index, onChange])

  const go = (next: number) => {
    setPlaying(false)
    onChange(Math.max(0, Math.min(last, next)))
  }

  const togglePlay = () => {
    if (atEnd) {
      // Desde el final, reproducir es volver a verla entera.
      onChange(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }

  return (
    <div className="glass rounded-card border border-line p-2 shadow-float">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index <= 0}
          aria-label="Turno anterior"
          className="btn btn-soft btn-icon btn-lg"
        >
          <ChevronLeft aria-hidden size={20} />
        </button>
        <p className="min-w-0 flex-1 text-center" aria-live="polite">
          <span className="block truncate text-base font-bold">{labels[index]}</span>
          <span className="block text-xs text-muted tabular-nums">
            Paso {index + 1} de {labels.length}
          </span>
        </p>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pausar' : atEnd ? 'Volver a empezar y reproducir' : 'Reproducir'}
          className="btn btn-primary btn-icon btn-lg"
        >
          {playing ? <Pause aria-hidden size={18} /> : <Play aria-hidden size={18} />}
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={atEnd}
          aria-label="Turno siguiente"
          className="btn btn-soft btn-icon btn-lg"
        >
          <ChevronRight aria-hidden size={20} />
        </button>
      </div>
      <label htmlFor={sliderId} className="sr-only">
        Ir a un turno
      </label>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={last}
        step={1}
        value={index}
        aria-valuetext={labels[index]}
        onChange={(e) => go(Number(e.target.value))}
        className="battle-range"
      />
    </div>
  )
}
