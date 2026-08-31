'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, AtSign, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, Palette, Save,
  ShieldAlert, UserCog,
} from 'lucide-react'
import { AvatarUploader } from '@/components/avatar-uploader'
import { ThemeSelector } from '@/components/theme-toggle'
import { updateProfile, type ProfileState } from '@/app/actions/profile'
import {
  deleteAccount, updateEmail, updatePassword, type AccountState,
} from '@/app/actions/account'
import { signOut } from '@/app/(auth)/actions'
import type { ProfileRow } from '@/lib/database.types'

export function SettingsForm({
  profile,
  email,
  providers,
}: {
  profile: ProfileRow
  email: string | null
  /** Proveedores de acceso vinculados ("email", "google"…). */
  providers: string[]
}) {
  // Quien entró sólo con Google no tiene contraseña que cambiar: Supabase la
  // rechazaría, así que en su lugar se explica cómo añadir una.
  const hasPassword = providers.includes('email')
  const usesGoogle = providers.includes('google')

  return (
    <div className="flex flex-col gap-5">
      <Section icon={UserCog} title="Perfil" description="Así te ve el resto de entrenadores.">
        <ProfileSection profile={profile} />
      </Section>

      <Section icon={Palette} title="Apariencia" description="El modo oscuro viste la interfaz de Master Ball.">
        <ThemeSelector />
      </Section>

      <Section icon={Mail} title="Cuenta" description="Datos de acceso a PokeHub.">
        <EmailSection email={email} usesGoogle={usesGoogle} />
        <hr className="border-line" />
        <PasswordSection hasPassword={hasPassword} />
      </Section>

      <Section icon={LogOut} title="Sesión" description="Cierra la sesión en este dispositivo.">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold transition hover:bg-line"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </form>
      </Section>

      <Section
        icon={ShieldAlert}
        title="Zona de peligro"
        description="Acciones irreversibles."
        danger
      >
        <DeleteSection />
      </Section>
    </div>
  )
}

/* --------------------------------- Estructura --------------------------------- */

function Section({
  icon: Icon,
  title,
  description,
  danger,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-card border bg-surface p-5 shadow-card md:p-6 ${
        danger ? 'border-red-500/40' : 'border-line'
      }`}
    >
      <header className="mb-4 flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            danger ? 'bg-red-500/15 text-red-500' : 'bg-surface-2 text-brand'
          }`}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Feedback({ state }: { state: ProfileState | AccountState }) {
  if (!state.error && !state.success) return null
  const isError = Boolean(state.error)
  return (
    <p
      role="status"
      className={`rounded-xl border px-3 py-2 text-sm ${
        isError
          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {state.error ?? state.success}
    </p>
  )
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none transition focus:border-brand disabled:opacity-60"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

/** Igual que `Field` pero con el ojo para ver la contraseña. */
function PasswordField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <span className="relative block">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 pr-11 text-sm outline-none transition focus:border-brand disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-line/60 hover:text-ink"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function SubmitButton({
  pending,
  children,
  danger,
  icon: Icon = Save,
}: {
  pending: boolean
  children: React.ReactNode
  danger?: boolean
  icon?: React.ElementType
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-card transition active:translate-y-0.5 disabled:opacity-60 ${
        danger
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-brand text-brand-fg hover:bg-brand-strong'
      }`}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      {children}
    </button>
  )
}

/* ---------------------------------- Secciones --------------------------------- */

function ProfileSection({ profile }: { profile: ProfileRow }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {})
  const [bio, setBio] = useState(profile.bio ?? '')

  return (
    <>
      <AvatarUploader userId={profile.id} initialUrl={profile.avatar_url} />

      <form action={action} className="flex flex-col gap-4">
        {/* El avatar ya se guarda al subirlo; se reenvía para no borrarlo aquí. */}
        <input type="hidden" name="avatar_url" value={profile.avatar_url ?? ''} />

        <Field
          label="Nombre de usuario"
          name="username"
          defaultValue={profile.username}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          hint="Entre 3 y 20 caracteres: letras, números o guion bajo."
        />

        <Field
          label="Nombre para mostrar"
          name="display_name"
          defaultValue={profile.display_name ?? ''}
          maxLength={40}
        />

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            Biografía <span className="font-normal text-muted">({bio.length}/250)</span>
          </span>
          <textarea
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={250}
            rows={3}
            placeholder="Cuéntale a la comunidad a qué juegas y con qué estilo."
            className="w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <Feedback state={state} />
        <SubmitButton pending={pending}>Guardar perfil</SubmitButton>
      </form>

      <Link
        href={`/u/${profile.username}`}
        className="text-center text-xs font-semibold text-muted underline transition hover:text-brand"
      >
        Ver mi perfil público
      </Link>
    </>
  )
}

function EmailSection({ email, usesGoogle }: { email: string | null; usesGoogle: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateEmail, {})

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Email de acceso"
        name="email"
        type="email"
        defaultValue={email ?? ''}
        required
        hint={
          usesGoogle
            ? 'Tu cuenta está vinculada a Google. Si cambias el email tendrás que confirmarlo desde el nuevo buzón.'
            : 'Recibirás un enlace de confirmación en la dirección nueva.'
        }
      />
      <Feedback state={state} />
      <SubmitButton pending={pending}>Cambiar email</SubmitButton>
    </form>
  )
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updatePassword, {})

  if (!hasPassword) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        <AtSign size={16} className="mt-0.5 shrink-0" />
        Entras con Google, así que no tienes contraseña en PokeHub. Si quieres una, cierra sesión y
        usa «¿Has olvidado tu contraseña?» con este mismo email.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <PasswordField
        label="Contraseña actual"
        name="current_password"
        autoComplete="current-password"
        required
      />
      <PasswordField
        label="Contraseña nueva"
        name="new_password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="Mínimo 8 caracteres."
      />
      <PasswordField
        label="Repite la contraseña nueva"
        name="repeat_password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Feedback state={state} />
      <SubmitButton pending={pending} icon={KeyRound}>
        Cambiar contraseña
      </SubmitButton>
    </form>
  )
}

function DeleteSection() {
  const [state, action, pending] = useActionState<AccountState, FormData>(deleteAccount, {})
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
      >
        <AlertTriangle size={16} /> Eliminar mi cuenta
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
        Se borrarán tu perfil, tus equipos, tus comentarios y tus mensajes. Esta acción no se puede
        deshacer.
      </p>
      <Field
        label="Escribe ELIMINAR para confirmar"
        name="confirm"
        placeholder="ELIMINAR"
        autoComplete="off"
        required
      />
      <Feedback state={state} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-line px-4 py-3 text-sm font-semibold transition hover:bg-surface-2"
        >
          Cancelar
        </button>
        <span className="flex-1">
          <SubmitButton pending={pending} danger icon={AlertTriangle}>
            Eliminar definitivamente
          </SubmitButton>
        </span>
      </div>
    </form>
  )
}
