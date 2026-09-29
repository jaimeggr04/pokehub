import type { MetadataRoute } from 'next'

/**
 * Manifest de la PWA. Los colores son los del tema claro (Pokéball): son los que
 * se ven en la pantalla de arranque antes de que la app sepa qué tema toca.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'PokeHub',
    short_name: 'PokeHub',
    description:
      'La red social de entrenadores Pokémon: comparte tus equipos competitivos, descubre builds y habla con la comunidad.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#f2e9e9',
    theme_color: '#d60a0a',
    categories: ['social', 'games', 'entertainment'],
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // El icono de Apple es cuadrado, opaco y con el motivo dentro de la zona
      // segura: sirve tal cual como icono adaptable de Android.
      { src: '/apple-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/pokeball.png', sizes: '894x894', type: 'image/png', purpose: 'any' },
    ],
    // Accesos directos al mantener pulsado el icono (Android y escritorio).
    shortcuts: [
      {
        name: 'Crear un equipo',
        short_name: 'Nuevo equipo',
        url: '/team/new',
        icons: [{ src: '/icon/192', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Mensajes',
        url: '/messages',
        icons: [{ src: '/icon/192', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Buscar equipos',
        short_name: 'Buscar',
        url: '/search?tipo=equipos',
        icons: [{ src: '/icon/192', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
