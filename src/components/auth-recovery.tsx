'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Hourglass, KeyRound, LockKeyhole, Mail } from 'lucide-react'
import { requestPasswordReset, resetPassword } from '@/app/(auth)/actions'
import {
  AuthHeading, EMAIL_RE, EmailSentPanel, FormAlert, PasswordField, PasswordStrength,
  SubmitButton, TextField, useAuthForm, type FieldErrors,
} from '@/components/auth-fields'
import { toast } from '@/components/ui/toast'

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="auth-back">
      <ArrowLeft aria-hidden size={15} />
      {children}
    </Link>
  )
}

/* --------------------------- /forgot-password --------------------------- */

const ISSUES = {
  expired: 'El enlace ha caducado o ya se había usado. Pide uno nuevo aquí abajo.',
  browser: 'El enlace hay que abrirlo en el mismo navegador en el que lo pediste. Pide uno nuevo desde aquí.',
} as const

export function ForgotPasswordForm({ issue }: { issue?: keyof typeof ISSUES }) {
  // Cada envío con éxito incrementa la clave y remonta el formulario limpio si
  // se vuelve a él ("probar con otro email").
  const [attempt, setAttempt] = useState(0)
  return <ForgotPasswordStep key={attempt} issue={attempt === 0 ? issue : undefined} onRetry={() => setAttempt((n) => n + 1)} />
}

function ForgotPasswordStep({ issue, onRetry }: { issue?: keyof typeof ISSUES; onRetry: () => void }) {
  const [email, setEmail] = useState('')
  const { state, pending, errorFor, formProps } = useAuthForm(requestPasswordReset, (data) => {
    const value = String(data.get('email') ?? '').trim()
    if (!value) return { email: 'Escribe el email de tu cuenta.' }
    if (!EMAIL_RE.test(value)) return { email: 'Ese email no parece válido.' }
    return {}
  })

  const sentHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (state.done) sentHeadingRef.current?.focus()
  }, [state.done])

  // Supabase deja el error del enlace también en el fragmento (#error=…), que el
  // navegador arrastra tras la redirección: se limpia para que no confunda.
  useEffect(() => {
    if (window.location.hash.includes('error')) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])

  if (state.done) {
    return (
      <EmailSentPanel
        title="Revisa tu correo"
        headingRef={sentHeadingRef}
        tips={[
          'El enlace sirve una sola vez y caduca en una hora.',
          'Ábrelo en este mismo navegador: por seguridad, en otro no funciona.',
          'Si no llega en un par de minutos, mira en spam o en promociones.',
        ]}
        actions={
          <>
            <Link href="/login" className="btn btn-primary btn-lg w-full">
              Volver a iniciar sesión
            </Link>
            <button type="button" onClick={onRetry} className="btn btn-ghost w-full">
              Probar con otro email
            </button>
          </>
        }
      >
        {state.notice}
      </EmailSentPanel>
    )
  }

  return (
    <>
      <BackLink href="/login">Volver a iniciar sesión</BackLink>
      <AuthHeading
        icon={KeyRound}
        title="¿Has olvidado tu contraseña?"
        subtitle="Escribe el email de tu cuenta y te mandaremos un enlace para crear una nueva."
      />

      {issue && (
        <FormAlert tone="error" className="mb-5">
          {ISSUES[issue]}
        </FormAlert>
      )}

      <form {...formProps} className="flex flex-col gap-4">
        <TextField
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ash@ejemplo.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorFor('email')}
        />
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviarme el enlace
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        ¿Te has acordado?{' '}
        <Link href="/login" className="auth-link">
          Inicia sesión
        </Link>
      </p>
    </>
  )
}

/* ---------------------------- /reset-password ---------------------------- */

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const strengthId = useId()

  const { state, pending, errorFor, formProps } = useAuthForm(resetPassword, (data) => {
    const errors: FieldErrors = {}
    const pw = String(data.get('password') ?? '')
    const again = String(data.get('repeat') ?? '')
    if (!pw) errors.password = 'Escribe la contraseña nueva.'
    else if (pw.length < 8) errors.password = 'Tiene que tener al menos 8 caracteres.'
    if (!again) errors.repeat = 'Repite la contraseña para confirmarla.'
    else if (pw && again !== pw) errors.repeat = 'Las dos contraseñas no coinciden.'
    return errors
  })

  // El aviso se lanza antes de navegar: el Toaster vive en el layout raíz y
  // sobrevive al cambio de página, así que se ve ya dentro de la app.
  useEffect(() => {
    if (!state.done) return
    toast('Contraseña actualizada', {
      tone: 'success',
      description: 'Ya estás dentro. Hemos cerrado la sesión en tus otros dispositivos.',
    })
    router.replace('/home')
  }, [state.done, router])

  const matches = repeat.length > 0 && repeat === password

  return (
    <>
      <AuthHeading
        icon={LockKeyhole}
        title="Crea una contraseña nueva"
        subtitle={
          <>
            Para la cuenta <strong className="break-all text-ink">{email}</strong>. Al guardarla entrarás
            directamente.
          </>
        }
      />

      <form {...formProps} className="flex flex-col gap-4">
        {/* Para que el gestor de contraseñas sepa a qué cuenta asociar la nueva. */}
        <input type="text" name="account" autoComplete="username" value={email} readOnly hidden />
        <div>
          <PasswordField
            name="password"
            label="Contraseña nueva"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errorFor('password')}
            hint={password ? undefined : 'Mínimo 8 caracteres.'}
            describedBy={strengthId}
          />
          <PasswordStrength id={strengthId} password={password} personal={[email.split('@')[0] ?? '']} />
        </div>
        <PasswordField
          name="repeat"
          label="Repite la contraseña"
          autoComplete="new-password"
          minLength={8}
          required
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errorFor('repeat')}
          hint={
            matches ? (
              <span className="flex items-center gap-1.5 font-semibold text-success">
                <Check aria-hidden size={14} strokeWidth={3} />
                Coinciden
              </span>
            ) : undefined
          }
        />
        {state.error && (
          <FormAlert tone="error">
            <p>{state.error}</p>
            <Link href="/forgot-password" className="mt-1 inline-block text-xs font-semibold underline underline-offset-2">
              Pedir otro enlace
            </Link>
          </FormAlert>
        )}
        <SubmitButton pending={pending || Boolean(state.done)} pendingLabel="Guardando…">
          Guardar y entrar
        </SubmitButton>
      </form>
    </>
  )
}

/** /reset-password sin la sesión del enlace: caducado, usado o abierto a mano. */
export function RecoveryExpired({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <AuthHeading
        icon={Hourglass}
        tone="warning"
        title="Este enlace ya no sirve"
        subtitle="Los enlaces para cambiar la contraseña caducan en una hora y sólo se pueden usar una vez. Pide otro y ábrelo en este mismo navegador."
      />
      <div className="flex flex-col gap-2.5">
        <Link href="/forgot-password" className="btn btn-primary btn-lg shine w-full">
          Pedir otro enlace
        </Link>
        <Link href={signedIn ? '/home' : '/login'} className="btn btn-ghost w-full">
          {signedIn ? 'Volver al inicio' : 'Volver a iniciar sesión'}
        </Link>
      </div>
      {signedIn && (
        <p className="mt-5 text-center text-xs text-muted">
          ¿Sólo quieres cambiarla? Hazlo desde{' '}
          <Link href="/settings" className="auth-link">
            Ajustes
          </Link>
          , con tu contraseña actual.
        </p>
      )}
    </>
  )
}
