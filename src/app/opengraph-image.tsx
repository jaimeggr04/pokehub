import { ImageResponse } from 'next/og'
import { TYPE_COLORS } from '@/lib/pokemon'

export const alt = 'PokeHub, la red social de equipos competitivos Pokémon'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BAND_TOP = 296
const BAND = 34
const BUTTON = 300
const BUTTON_X = 790

const TYPES: { key: keyof typeof TYPE_COLORS; label: string }[] = [
  { key: 'fire', label: 'Fuego' },
  { key: 'water', label: 'Agua' },
  { key: 'grass', label: 'Planta' },
  { key: 'electric', label: 'Eléctrico' },
  { key: 'dragon', label: 'Dragón' },
  { key: 'fairy', label: 'Hada' },
]

/**
 * Tarjeta para compartir: la imagen entera es una pokéball abierta en plano,
 * como la cabecera de la app. Usa la fuente por defecto de satori (no lee
 * woff2); los titulares ganan cuerpo con un trazo del mismo color.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, #ff4a3a 0%, #d60a0a 70%, #b30606 ${BAND_TOP}px, #fbf7f7 ${BAND_TOP}px, #efe6e6 100%)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1200,
            height: BAND_TOP,
            backgroundImage: 'linear-gradient(165deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: BAND_TOP,
            width: 1200,
            height: BAND,
            backgroundColor: '#0d0d0d',
          }}
        />

        {/* Botón central de la pokéball, apoyado en la banda. */}
        <div
          style={{
            position: 'absolute',
            left: BUTTON_X,
            top: BAND_TOP + BAND / 2 - BUTTON / 2,
            width: BUTTON,
            height: BUTTON,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: '#0d0d0d',
            boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: 212,
              height: 212,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #d4cfd8 100%)',
            }}
          >
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: '50%',
                border: '7px solid #0d0d0d',
                backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #ece8f0 100%)',
              }}
            />
          </div>
        </div>

        {/* Logotipo, igual que el de la cabecera. */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 92,
            display: 'flex',
            alignItems: 'center',
            padding: '18px 26px',
            borderRadius: 26,
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 0 rgba(0,0,0,0.18)',
            fontSize: 92,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          <span style={{ color: '#111111', WebkitTextStroke: '3px #111111' }}>Poke</span>
          <span
            style={{
              marginLeft: 14,
              padding: '8px 16px 12px',
              borderRadius: 16,
              backgroundColor: '#d60a0a',
              color: '#ffffff',
              WebkitTextStroke: '3px #ffffff',
              boxShadow: '0 5px 0 rgba(0,0,0,0.25)',
            }}
          >
            Hub
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 80,
            top: BAND_TOP + BAND + 42,
            width: 660,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1.18, color: '#16121a', WebkitTextStroke: '1px #16121a' }}>
            La red social de los equipos competitivos Pokémon
          </div>
          <div style={{ marginTop: 16, fontSize: 25, color: '#5d5560' }}>
            Comparte equipos · Descubre builds · Habla con la comunidad
          </div>
          <div style={{ marginTop: 28, display: 'flex' }}>
            {TYPES.map(({ key, label }) => (
              <div
                key={key}
                style={{
                  marginRight: 10,
                  padding: '6px 16px',
                  borderRadius: 999,
                  fontSize: 20,
                  backgroundColor: TYPE_COLORS[key].bg,
                  color: TYPE_COLORS[key].fg,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  )
}
