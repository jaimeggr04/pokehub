'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Volume2 } from 'lucide-react'
import clsx from 'clsx'
import { toast } from '@/components/ui/toast'

const VOLUME = 0.35

let oggSupport: boolean | null = null

// Los gritos de la PokéAPI son Ogg Vorbis, que algunos Safari no reproducen:
// ahí es mejor no enseñar el botón que enseñar uno que falla.
function canPlayOgg() {
  if (oggSupport === null) {
    oggSupport = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== ''
  }
  return oggSupport
}

const noopSubscribe = () => () => {}

/**
 * Reproduce el grito del Pokémon. Un único <audio> por grito, que se crea sin
 * precarga (no descarga nada hasta el primer toque) y se para al desmontar.
 */
export function CryButton({
  src,
  name,
  onPlay,
  size = 'md',
  className,
}: {
  src: string | null | undefined
  /** Nombre para la etiqueta accesible: "Escuchar el grito de Pikachu". */
  name: string
  /** Se llama justo cuando empieza a sonar (p. ej. para que el Pokémon dé un saltito). */
  onPlay?: () => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const supported = useSyncExternalStore(noopSubscribe, canPlayOgg, () => false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!src) return
    const audio = new Audio()
    audio.preload = 'none'
    audio.src = src
    audio.volume = VOLUME
    const stop = () => setPlaying(false)
    audio.addEventListener('ended', stop)
    audio.addEventListener('pause', stop)
    audioRef.current = audio

    return () => {
      audio.removeEventListener('ended', stop)
      audio.removeEventListener('pause', stop)
      audio.pause()
      audioRef.current = null
      setPlaying(false)
    }
  }, [src])

  if (!src || !supported) return null

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      audio.currentTime = 0
      return
    }
    audio.currentTime = 0
    setPlaying(true)
    try {
      await audio.play()
      onPlay?.()
    } catch (err) {
      setPlaying(false)
      // AbortError = se pulsó "detener" antes de que empezara a sonar: no es un fallo.
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast('No se pudo reproducir el grito', { tone: 'error', description: 'Revisa la conexión e inténtalo de nuevo.' })
    }
  }

  // 40 px en táctil; en escritorio la versión pequeña puede encoger un poco.
  const dim = size === 'sm' ? 'h-10 w-10 sm:h-9 sm:w-9' : 'h-10 w-10'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Detener el grito de ${name}` : `Escuchar el grito de ${name}`}
      title={playing ? 'Detener' : 'Escuchar su grito'}
      className={clsx(
        'glass pressable relative grid shrink-0 place-items-center rounded-full shadow-card',
        playing ? 'text-brand' : 'text-ink',
        dim,
        className,
      )}
    >
      {playing && (
        <span aria-hidden className="pokemon-cry-ring pointer-events-none absolute inset-0 rounded-full border-2 border-brand" />
      )}
      {playing ? (
        <span aria-hidden className="flex h-4 items-center gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="pokemon-cry-bar block h-full w-[3px] rounded-full bg-current"
              style={{ '--i': i } as React.CSSProperties}
            />
          ))}
        </span>
      ) : (
        <Volume2 aria-hidden size={size === 'sm' ? 16 : 18} />
      )}
    </button>
  )
}
