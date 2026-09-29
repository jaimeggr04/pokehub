/**
 * Piezas compartidas del flujo de recuperación de contraseña: el callback
 * marca la sesión como "de recuperación" y /reset-password y su acción sólo
 * dejan cambiar la contraseña si esa marca existe.
 *
 * La marca hace falta porque una sesión normal bastaría para llamar a
 * `updateUser({ password })`: sin ella, /reset-password sería una puerta
 * trasera al cambio de contraseña de Ajustes, que exige la actual.
 */

export const RESET_PATH = '/reset-password'
export const FORGOT_PATH = '/forgot-password'

/** Cookie httpOnly con el id del usuario que acaba de canjear su enlace. */
export const RECOVERY_COOKIE = 'ph-recovery'

/** Tiempo para escribir la contraseña nueva tras abrir el enlace. */
export const RECOVERY_MAX_AGE_S = 30 * 60

/** Motivos con los que el callback devuelve a /forgot-password. */
export type RecoveryIssue = 'expired' | 'browser'

export function isRecoveryIssue(value: unknown): value is RecoveryIssue {
  return value === 'expired' || value === 'browser'
}
