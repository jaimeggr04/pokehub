import { ImageResponse } from 'next/og'

// 180 es el que usa iOS en la pantalla de inicio; 512 es el icono adaptable
// ("maskable") del manifest, en /apple-icon/512.
const SIZES = [180, 512] as const

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

/**
 * Icono de app: el cuadrado entero es una pokéball abierta en plano, igual que
 * la cabecera de PokeHub (banda de marca arriba, banda negra y botón central).
 * Opaco y a sangre, como piden iOS y los iconos adaptables de Android; el botón
 * queda dentro del círculo seguro del 80 % que respetan todas las máscaras.
 */
export default function AppleIcon({ id }: { id: string }) {
  const size = SIZES.find((s) => String(s) === id) ?? 180
  const band = Math.round(size * 0.1)
  const button = Math.round(size * 0.46)
  const ring = Math.round(button * 0.7)
  const core = Math.round(button * 0.44)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundImage: 'linear-gradient(180deg, #ff4a3a 0%, #d60a0a 42%, #b10606 50%, #fbf8f8 50%, #e7dfdf 100%)',
        }}
      >
        {/* El mismo halo que la cabecera de la app: da volumen a la mitad roja. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size,
            height: size / 2,
            backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: Math.round((size - band) / 2),
            width: size,
            height: band,
            backgroundColor: '#0d0d0d',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: Math.round((size - button) / 2),
            top: Math.round((size - button) / 2),
            width: button,
            height: button,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: '#0d0d0d',
            boxShadow: `0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.05)}px rgba(0,0,0,0.35)`,
          }}
        >
          <div
            style={{
              width: ring,
              height: ring,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #d4cfd8 100%)',
            }}
          >
            <div
              style={{
                width: core,
                height: core,
                borderRadius: '50%',
                border: `${Math.max(2, Math.round(size * 0.012))}px solid #0d0d0d`,
                backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #ece8f0 100%)',
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
