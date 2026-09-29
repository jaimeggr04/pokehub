'use client'

import { MotionConfig } from 'motion/react'
import { Toaster } from '@/components/ui/toast'

/**
 * Proveedores globales de cliente. MotionConfig con reducedMotion="user" hace
 * que todas las animaciones de motion respeten "reducir movimiento" del
 * sistema (quita desplazamientos y escalas, conserva los fundidos).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  )
}
