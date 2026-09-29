import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { themeScript } from '@/components/theme-toggle'
import { Providers } from '@/components/providers'
import './globals.css'

// Poppins autoalojada: sin peticiones a Google Fonts, sin salto de maquetación.
const poppins = localFont({
  src: [
    { path: './fonts/poppins-300.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-800.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

// Base de las URL absolutas de las etiquetas para compartir (la imagen de
// opengraph-image). En Vercel, sin NEXT_PUBLIC_SITE_URL, vale su dominio de producción.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'PokeHub', template: '%s · PokeHub' },
  applicationName: 'PokeHub',
  description:
    'La red social de entrenadores Pokémon: comparte tus equipos competitivos, descubre builds y habla con la comunidad.',
  icons: { icon: '/pokeball.png' },
  // Añadida a la pantalla de inicio en iOS se abre a pantalla completa.
  appleWebApp: { capable: true, title: 'PokeHub', statusBarStyle: 'black-translucent' },
  // Que iOS no convierta en enlaces de llamada cifras como estadísticas o IVs.
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d60a0a' },
    { media: '(prefers-color-scheme: dark)', color: '#8a4dff' },
  ],
  // Contenido bajo el notch y la barra de inicio; los márgenes los ponen los
  // env(safe-area-inset-*) de la barra inferior y las hojas.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior: Next desactiva el scroll suave durante los cambios
    // de ruta (si no, cada navegación se desplazaría animada hasta arriba).
    <html lang="es" className={poppins.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
