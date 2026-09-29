import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Permite un `next dev` con su propia carpeta mientras otro proceso compila
  // en `.next`; sin la variable, todo sigue igual.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
