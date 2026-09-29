import { ImageResponse } from 'next/og'

// Tres tamaños: la pestaña del navegador (32) y los que pide el manifest para
// instalar la app (192 y 512). Cada uno sale en /icon/<id>.
const SIZES = [32, 192, 512] as const

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

/**
 * Pokéball de la marca con fondo transparente. Se dibuja con cajas y degradados
 * porque satori sólo entiende un subconjunto de CSS (nada de SVG con filtros ni
 * pseudo-elementos). Los grosores tienen un mínimo en píxeles: a 32 px una
 * proporción pura dejaría la banda en medio píxel borroso.
 */
export default function Icon({ id }: { id: string }) {
  const size = SIZES.find((s) => String(s) === id) ?? 512
  const small = size < 64
  const ball = Math.round(size * 0.94)
  const border = Math.max(2, Math.round(ball * 0.055))
  const inner = ball - border * 2
  const band = Math.max(3, Math.round(ball * 0.085))
  const button = Math.round(ball * (small ? 0.4 : 0.34))
  const core = Math.round(button * 0.56)
  const coreRing = Math.max(1, Math.round(button * 0.07))

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: ball,
            height: ball,
            display: 'flex',
            position: 'relative',
            borderRadius: '50%',
            border: `${border}px solid #111111`,
            overflow: 'hidden',
            backgroundImage: 'linear-gradient(180deg, #ff5a47 0%, #d60a0a 44%, #b80707 50%, #ffffff 50%, #dedae2 100%)',
          }}
        >
          {/* Brillo especular de la mitad superior; en la pestaña no se apreciaría. */}
          {!small && (
            <div
              style={{
                position: 'absolute',
                left: Math.round(inner * 0.14),
                top: Math.round(inner * 0.08),
                width: Math.round(inner * 0.4),
                height: Math.round(inner * 0.22),
                transform: 'rotate(-18deg)',
                borderRadius: '50%',
                backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: Math.round((inner - band) / 2),
              width: inner,
              height: band,
              backgroundColor: '#111111',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: Math.round((inner - button) / 2),
              top: Math.round((inner - button) / 2),
              width: button,
              height: button,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: '#111111',
            }}
          >
            <div
              style={{
                width: core,
                height: core,
                borderRadius: '50%',
                border: small ? 'none' : `${coreRing}px solid #d9d4de`,
                backgroundImage: 'radial-gradient(circle at 38% 32%, #ffffff 0%, #ffffff 45%, #e6e1ea 100%)',
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
