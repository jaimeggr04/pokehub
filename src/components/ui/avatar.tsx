import Image from 'next/image'
import clsx from 'clsx'

// Pares de tonos elegidos a mano: saturados lo justo para que las iniciales en
// blanco se lean, y distintos entre sí para distinguir a la gente de un vistazo.
const GRADIENTS: [string, string][] = [
  ['#ff8a65', '#e8364f'],
  ['#ffb443', '#f0592b'],
  ['#f783ac', '#c2255c'],
  ['#e599f7', '#9c36b5'],
  ['#b197fc', '#6741d9'],
  ['#74c0fc', '#4263eb'],
  ['#4dd4ff', '#1c7ed6'],
  ['#38d9a9', '#1098ad'],
  ['#69db7c', '#2b8a3e'],
  ['#a9e34b', '#37b24d'],
  ['#ffd43b', '#f76707'],
  ['#ff8787', '#ae3ec9'],
]

// FNV-1a: estable entre servidor y cliente, así el color no cambia al hidratar.
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function initials(name: string): string {
  const clean = name.trim().replace(/^@/, '')
  // Array.from respeta emojis y caracteres fuera del BMP.
  return Array.from(clean).slice(0, 2).join('').toUpperCase() || '?'
}

export function Avatar({
  src,
  name,
  size = 40,
  ring = false,
  className,
}: {
  src?: string | null
  name: string
  size?: number
  /** Aro de marca con separación del color de fondo (perfil propio, activo…). */
  ring?: boolean
  className?: string
}) {
  const [from, to] = GRADIENTS[hash(name.trim().replace(/^@/, '').toLowerCase()) % GRADIENTS.length]

  return (
    <span
      className={clsx(
        'relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-bold leading-none',
        src ? 'bg-surface-2' : 'text-white',
        ring && 'ring-2 ring-brand ring-offset-2 ring-offset-bg',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundImage: src ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {src ? (
        // El nombre siempre aparece al lado: la imagen es decorativa.
        <Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden className="[text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">
          {initials(name)}
        </span>
      )}
    </span>
  )
}
