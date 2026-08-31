import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { themeScript } from '@/components/theme-toggle'
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

export const metadata: Metadata = {
  title: { default: 'PokeHub', template: '%s · PokeHub' },
  description:
    'La red social de entrenadores Pokémon: comparte tus equipos competitivos, descubre builds y habla con la comunidad.',
  icons: { icon: '/pokeball.png' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d60a0a' },
    { media: '(prefers-color-scheme: dark)', color: '#8a4dff' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
