import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Todas las <Image> de la app usan `unoptimized`, así que el optimizador de
    // Next nunca llega a pedir estas URLs; la lista sólo evita que el
    // componente rechace un avatar alojado en un dominio arbitrario.
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
