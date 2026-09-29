'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight, ArrowUpRight, Check, Circle, KeyRound, LogOut, Mail, Palette, RotateCcw, Save,
  ShieldAlert, Sparkles, Trash2, TriangleAlert, UserRound,
} from 'lucide-react'
import clsx from 'clsx'
import { AvatarUploader } from '@/components/avatar-uploader'
import { SectionLayout, type SectionNavItem } from '@/components/extras-section-nav'
import {
  CharCounter, Field, INPUT_CLASS, InlineFeedback, PasswordField, SettingsSection, SubSection,
  SubmitButton, notifyResult, type ActionResult,
} from '@/components/settings-ui'
import { ThemeSelector } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { updateProfile } from '@/app/actions/profile'
import { deleteAccount, updateEmail, updatePassword } from '@/app/actions/account'
import { signOut } from '@/app/(auth)/actions'
import type { ProfileRow } from '@/lib/database.types'

// Las mismas reglas que valida profile.ts; aquí sólo sirven para avisar antes.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const USERNAME_MAX = 20
const DISPLAY_NAME_MAX = 40
const BIO_MAX = 250

const PROVIDER_NAMES: Record<string, string> = {
  email: 'Email y contraseña',
  google: 'Google',
  github: 'GitHub',
}

function providerName(provider: string) {
  return PROVIDER_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

/** "Google", "Google y GitHub"… */
function listNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/** Estado de un formulario: el resultado de la acción más un contador de envíos. */
type Submitted = ActionResult & { n?: number }

const SECTIONS: SectionNavItem[] = [
  { id: 'perfil', label: 'Perfil', icon: <UserRound size={16} /> },
  { id: 'apariencia', label: 'Apariencia', icon: <Palette size={16} /> },
  { id: 'cuenta', label: 'Cuenta', icon: <KeyRound size={16} /> },
  { id: 'sesion', label: 'Sesión', icon: <LogOut size={16} /> },
  { id: 'peligro', label: 'Zona de peligro', icon: <ShieldAlert size={16} />, danger: true },
]

export function SettingsForm({
  profile,
  email,
  providers,
  joined,
}: {
  profile: ProfileRow
  email: string | null
  /** Proveedores de acceso vinculados ("email", "google", "github"…). */
  providers: string[]
  /** Mes y año de alta, ya formateados en el servidor (evita desajustes de zona horaria). */
  joined: string
}) {
  // Los campos del perfil viven aquí para que la cabecera los previsualice
  // mientras se escriben.
  const [username, setUsername] = useState(profile.username)
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatar, setAvatar] = useState({ shown: profile.avatar_url, saved: profile.avatar_url })

  // Quien entró sólo con Google o GitHub no tiene contraseña que cambiar:
  // Supabase la rechazaría, así que en su lugar se explica cómo crear una.
  const hasPassword = providers.includes('email')
  const oauthNames = providers.filter((p) => p !== 'email').map(providerName)

  // Mismo criterio que el servidor: recorta espacios y un nombre vacío pasa a ser el usuario.
  const dirty =
    username.trim() !== profile.username ||
    (displayName.trim() || username.trim()) !== (profile.display_name?.trim() || profile.username) ||
    bio.trim() !== (profile.bio ?? '').trim()

  function discard() {
    setUsername(profile.username)
    setDisplayName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
  }

  return (
    <>
      <header className="mb-5 animate-fade-up">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Tu perfil, tu cuenta y el aspecto de PokeHub, en un solo sitio.</p>
      </header>

      <ProfilePreview
        username={username.trim() || profile.username}
        displayName={displayName}
        bio={bio}
        avatar={avatar.shown}
        publicUsername={profile.username}
        isPremium={profile.is_premium}
        joined={joined}
        dirty={dirty}
      />

      <SectionLayout
        className="mt-5"
        items={SECTIONS}
        ariaLabel="Secciones de configuración"
        railTitle="Ajustes"
        railFooter={
          <>
            ¿Qué datos guarda PokeHub?{' '}
            <Link href="/legal#privacidad" className="font-semibold text-ink underline decoration-line underline-offset-2 hover:text-brand">
              Privacidad
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <SettingsSection
            id="perfil"
            index={0}
            icon={<UserRound size={20} />}
            title="Perfil"
            description="Así te ve el resto de entrenadores."
          >
            <ProfileSection
              profile={profile}
              username={username}
              onUsername={setUsername}
              displayName={displayName}
              onDisplayName={setDisplayName}
              bio={bio}
              onBio={setBio}
              savedAvatar={avatar.saved}
              onAvatar={(shown, saved) => setAvatar({ shown, saved })}
              dirty={dirty}
              onDiscard={discard}
            />
          </SettingsSection>

          <SettingsSection
            id="apariencia"
            index={1}
            icon={<Palette size={20} />}
            title="Apariencia"
            description="El modo oscuro viste la interfaz de Master Ball."
          >
            <ThemeSelector />
            <p className="mt-3 text-xs text-muted">
              «Sistema» sigue el ajuste de tu dispositivo. La elección se guarda sólo en este navegador.
            </p>
          </SettingsSection>

          <SettingsSection
            id="cuenta"
            index={2}
            icon={<KeyRound size={20} />}
            title="Cuenta"
            description="Tus datos de acceso a PokeHub. Nadie más los ve."
          >
            <div className="flex flex-col gap-6">
              <AccessMethods providers={providers} />
              <EmailForm email={email} oauthNames={oauthNames} />
              <hr className="border-line" />
              {hasPassword ? <PasswordForm /> : <NoPassword email={email} oauthNames={oauthNames} />}
            </div>
          </SettingsSection>

          <SettingsSection
            id="sesion"
            index={3}
            icon={<LogOut size={20} />}
            title="Sesión"
            description="Cierra la sesión en este dispositivo."
          >
            <SessionCard profile={profile} avatar={avatar.saved} email={email} />
          </SettingsSection>

          <SettingsSection
            id="peligro"
            index={4}
            icon={<ShieldAlert size={20} />}
            title="Zona de peligro"
            description="Acciones irreversibles. Tómatelo con calma."
            danger
          >
            <DeleteSection />
          </SettingsSection>
        </div>
      </SectionLayout>
    </>
  )
}

/* ------------------------------ Vista previa ------------------------------ */

function ProfilePreview({
  username,
  displayName,
  bio,
  avatar,
  publicUsername,
  isPremium,
  joined,
  dirty,
}: {
  username: string
  displayName: string
  bio: string
  avatar: string | null
  /** El usuario guardado: el enlace debe llevar a la ficha que ya existe. */
  publicUsername: string
  isPremium: boolean
  joined: string
  dirty: boolean
}) {
  const name = displayName.trim() || username
  const about = bio.trim()

  return (
    <section
      aria-label="Vista previa de tu perfil"
      className="card relative animate-fade-up overflow-hidden [animation-delay:60ms]"
    >
      <div aria-hidden className="settings-hero-band relative h-24 overflow-hidden sm:h-28">
        <BallOutline className="absolute -right-6 -top-10 size-44 rotate-[18deg] opacity-25 sm:right-6 sm:size-52" />
        <BallOutline className="absolute right-40 top-9 hidden size-16 -rotate-12 opacity-20 sm:block" />
        <BallOutline className="absolute -left-5 bottom-[-2.25rem] size-24 rotate-6 opacity-15" />
      </div>

      <span className="glass absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-ink shadow-card">
        <span
          aria-hidden
          className={clsx('size-1.5 rounded-full transition-colors', dirty ? 'bg-warning' : 'bg-success')}
        />
        {dirty ? 'Vista previa · sin guardar' : 'Vista previa'}
      </span>

      <div className="relative flex flex-col items-center gap-3 px-5 pb-5 text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-6 sm:text-left">
        <div className="-mt-12 shrink-0 rounded-full bg-surface p-1.5 shadow-card sm:-mt-14">
          <Avatar src={avatar} name={username} size={104} />
        </div>

        <div className="min-w-0 flex-1 sm:pb-0.5">
          <p className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
            <span className="truncate text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{name}</span>
            {isPremium && (
              <span className="extras-ink-warning inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold">
                <Sparkles aria-hidden size={12} /> Campeón
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">
            @{username} <span aria-hidden>·</span> Se unió en {joined}
          </p>
          <p className={clsx('mt-2 line-clamp-2 text-sm [overflow-wrap:anywhere]', !about && 'italic text-muted')}>
            {about || 'Todavía sin biografía.'}
          </p>
        </div>

        <Link href={`/u/${publicUsername}`} className="btn btn-soft btn-sm shrink-0">
          Ver perfil público
          <ArrowUpRight aria-hidden size={16} />
        </Link>
      </div>
    </section>
  )
}

/** Silueta de pokéball en trazo blanco para decorar la banda de marca. */
function BallOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="5" className={className} aria-hidden>
      <circle cx="50" cy="50" r="45" />
      <path d="M5 50h30M65 50h30" />
      <circle cx="50" cy="50" r="15" />
    </svg>
  )
}

/* --------------------------------- Perfil --------------------------------- */

function ProfileSection({
  profile,
  username,
  onUsername,
  displayName,
  onDisplayName,
  bio,
  onBio,
  savedAvatar,
  onAvatar,
  dirty,
  onDiscard,
}: {
  profile: ProfileRow
  username: string
  onUsername: (value: string) => void
  displayName: string
  onDisplayName: (value: string) => void
  bio: string
  onBio: (value: string) => void
  savedAvatar: string | null
  onAvatar: (shown: string | null, saved: string | null) => void
  dirty: boolean
  onDiscard: () => void
}) {
  const [state, action] = useActionState<Submitted, FormData>(async (prev, formData) => {
    const result = await updateProfile(prev, formData)
    notifyResult(result, { title: 'Perfil actualizado', description: 'Así te verán ahora los demás entrenadores.' })
    return { ...result, n: (prev.n ?? 0) + 1 }
  }, {})
  const [usernameTouched, setUsernameTouched] = useState(false)
  const bioId = useId()

  const cleanUsername = username.trim()
  // Un carácter no válido se avisa al momento; que sea corto, al salir del campo.
  const usernameError =
    !USERNAME_RE.test(cleanUsername) && (usernameTouched || /[^A-Za-z0-9_\s]/.test(username))
      ? 'Entre 3 y 20 caracteres: sólo letras sin tilde, números o guion bajo.'
      : null

  return (
    <div className="flex flex-col gap-5">
      <AvatarUploader userId={profile.id} name={cleanUsername || profile.username} initialUrl={profile.avatar_url} onChange={onAvatar} />

      <form action={action} className="flex flex-col gap-4">
        {/* El avatar ya se guarda al subirlo; se reenvía para no borrarlo aquí. */}
        <input type="hidden" name="avatar_url" value={savedAvatar ?? ''} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre de usuario"
            name="username"
            prefix="@"
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            onBlur={() => setUsernameTouched(true)}
            required
            minLength={3}
            maxLength={USERNAME_MAX}
            pattern="\s*[A-Za-z0-9_]{3,20}\s*"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            counter={USERNAME_MAX}
            invalid={usernameError}
            hint={
              <>
                Tu ficha está en <span className="font-semibold text-ink">/u/{cleanUsername || profile.username}</span>;
                si lo cambias, esa dirección también cambia.
              </>
            }
          />

          <Field
            label="Nombre para mostrar"
            name="display_name"
            value={displayName}
            onChange={(e) => onDisplayName(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            placeholder={cleanUsername || profile.username}
            autoComplete="nickname"
            counter={DISPLAY_NAME_MAX}
            hint="Si lo dejas vacío se usará tu nombre de usuario."
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={bioId} className="text-sm font-semibold">
              Biografía
            </label>
            <CharCounter id={`${bioId}-count`} length={bio.length} max={BIO_MAX} />
          </div>
          <textarea
            id={bioId}
            name="bio"
            value={bio}
            onChange={(e) => onBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            aria-describedby={`${bioId}-count`}
            placeholder="Cuéntale a la comunidad a qué juegas y con qué estilo."
            className={clsx(INPUT_CLASS, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed')}
          />
        </div>

        <InlineFeedback key={state.n} state={state} />

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center justify-center gap-2 text-xs text-muted sm:justify-start">
            <span
              aria-hidden
              className={clsx('size-2 rounded-full transition-colors', dirty ? 'bg-warning' : 'bg-success')}
            />
            {dirty ? 'Tienes cambios sin guardar' : 'Todo guardado'}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {dirty && (
              <button type="button" onClick={onDiscard} className="btn btn-ghost animate-fade-in">
                <RotateCcw aria-hidden size={16} />
                Descartar
              </button>
            )}
            <SubmitButton
              icon={<Save aria-hidden size={17} />}
              pendingLabel="Guardando…"
              disabled={!dirty || Boolean(usernameError)}
            >
              Guardar cambios
            </SubmitButton>
          </div>
        </div>
      </form>
    </div>
  )
}

/* --------------------------------- Cuenta --------------------------------- */

function AccessMethods({ providers }: { providers: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[13px] font-semibold text-muted">Entras con</span>
      {providers.map((provider) => (
        <span
          key={provider}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold shadow-card"
        >
          <Check aria-hidden size={13} className="text-success" strokeWidth={3} />
          {providerName(provider)}
        </span>
      ))}
    </div>
  )
}

function EmailForm({ email, oauthNames }: { email: string | null; oauthNames: string[] }) {
  const [value, setValue] = useState(email ?? '')
  const [state, action] = useActionState<Submitted, FormData>(async (prev, formData) => {
    const result = await updateEmail(prev, formData)
    notifyResult(result, { title: 'Revisa tu correo', description: result.success })
    return { ...result, n: (prev.n ?? 0) + 1 }
  }, {})
  const unchanged = value.trim().toLowerCase() === (email ?? '').toLowerCase()

  return (
    <SubSection
      title="Email de acceso"
      description={
        email ? (
          <>
            Ahora mismo: <span className="font-semibold text-ink [overflow-wrap:anywhere]">{email}</span>
          </>
        ) : (
          'Tu cuenta todavía no tiene un email asociado.'
        )
      }
    >
      <form action={action} className="flex flex-col gap-3">
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          hint={
            oauthNames.length > 0
              ? `Tu cuenta está vinculada a ${listNames(oauthNames)}. Si cambias el email tendrás que confirmarlo desde el nuevo buzón.`
              : 'Te enviaremos un enlace de confirmación a la dirección nueva; hasta que lo abras, sigue valiendo la actual.'
          }
        />
        <InlineFeedback key={state.n} state={state} />
        <div className="flex justify-end">
          <SubmitButton
            variant="soft"
            icon={<Mail aria-hidden size={17} />}
            pendingLabel="Enviando…"
            disabled={unchanged}
            className="w-full sm:w-auto"
          >
            Cambiar email
          </SubmitButton>
        </div>
      </form>
    </SubSection>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [state, action] = useActionState<Submitted, FormData>(async (prev, formData) => {
    const result = await updatePassword(prev, formData)
    notifyResult(result, { title: 'Contraseña actualizada' })
    if (result.success) {
      setCurrent('')
      setNext('')
      setRepeat('')
    }
    return { ...result, n: (prev.n ?? 0) + 1 }
  }, {})

  const rules = [
    { label: 'Al menos 8 caracteres', ok: next.length >= 8 },
    { label: 'Las dos contraseñas nuevas coinciden', ok: next.length > 0 && next === repeat },
    { label: 'Distinta de la actual', ok: next.length > 0 && next !== current },
  ]

  return (
    <SubSection
      title="Contraseña"
      description="Te pedimos la actual: así nadie puede cambiarla desde un dispositivo que te hayas dejado abierto."
    >
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <PasswordField
          label="Contraseña actual"
          name="current_password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="sm:col-span-2"
        />
        <PasswordField
          label="Contraseña nueva"
          name="new_password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={8}
          required
        />
        <PasswordField
          label="Repite la contraseña nueva"
          name="repeat_password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          minLength={8}
          required
        />

        <ul aria-label="Requisitos de la contraseña nueva" className="flex flex-col gap-1.5 sm:col-span-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
          {rules.map((rule) => (
            <li
              key={rule.label}
              className={clsx(
                'flex items-center gap-1.5 text-xs font-medium transition-colors',
                rule.ok ? 'text-success' : 'text-muted',
              )}
            >
              {rule.ok ? (
                <Check aria-hidden size={14} strokeWidth={3} className="animate-pop" />
              ) : (
                <Circle aria-hidden size={14} />
              )}
              {rule.label}
              <span className="sr-only">{rule.ok ? ': cumplido' : ': pendiente'}</span>
            </li>
          ))}
        </ul>

        <div className="sm:col-span-2">
          <InlineFeedback key={state.n} state={state} />
        </div>

        <div className="flex justify-end sm:col-span-2">
          <SubmitButton
            icon={<KeyRound aria-hidden size={17} />}
            pendingLabel="Comprobando…"
            className="w-full sm:w-auto"
          >
            Cambiar contraseña
          </SubmitButton>
        </div>
      </form>
    </SubSection>
  )
}

function NoPassword({ email, oauthNames }: { email: string | null; oauthNames: string[] }) {
  const via = oauthNames.length > 0 ? listNames(oauthNames) : 'otro proveedor'

  return (
    <SubSection title="Contraseña">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4 shadow-card sm:flex-row sm:items-start sm:gap-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <KeyRound size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Tu cuenta no tiene contraseña</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Entras con {via}, así que en PokeHub no hay ninguna contraseña que cambiar. Si quieres poder entrar
            también con tu email, pide un enlace para crear una con{' '}
            {email ? <span className="font-semibold text-ink [overflow-wrap:anywhere]">{email}</span> : 'tu email'}.
          </p>
          <Link href="/forgot-password" className="btn btn-soft btn-sm mt-3">
            Crear una contraseña
            <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
      </div>
    </SubSection>
  )
}

/* --------------------------------- Sesión --------------------------------- */

function SessionCard({
  profile,
  avatar,
  email,
}: {
  profile: ProfileRow
  avatar: string | null
  email: string | null
}) {
  const name = profile.display_name?.trim() || profile.username

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-4 shadow-card sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={avatar} name={profile.username} size={44} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-xs text-muted">{email ?? `@${profile.username}`}</p>
          </div>
        </div>
        <form action={signOut}>
          <SubmitButton
            variant="soft"
            icon={<LogOut aria-hidden size={17} />}
            pendingLabel="Cerrando sesión…"
            className="w-full sm:w-auto"
          >
            Cerrar sesión
          </SubmitButton>
        </form>
      </div>
      <p className="mt-3 text-xs text-muted">
        Sólo se cierra en este navegador. Para volver, entra de nuevo con tu cuenta.
      </p>
    </>
  )
}

/* ----------------------------- Zona de peligro ----------------------------- */

const CONFIRM_WORD = 'ELIMINAR'

function DeleteSection() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [state, action] = useActionState<Submitted, FormData>(async (prev, formData) => {
    // Si sale bien, la acción redirige al login y esto no llega a volver.
    const result = await deleteAccount(prev, formData)
    notifyResult(result)
    return { ...result, n: (prev.n ?? 0) + 1 }
  }, {})
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Al cancelar, el foco vuelve al botón que abrió la confirmación.
  const returnFocus = useRef(false)
  const panelId = useId()

  // Mismo criterio que account.ts: sin espacios y sin distinguir mayúsculas.
  const matches = confirm.trim().toUpperCase() === CONFIRM_WORD

  useEffect(() => {
    if (open || !returnFocus.current) return
    returnFocus.current = false
    triggerRef.current?.focus()
  }, [open])

  function close() {
    returnFocus.current = true
    setOpen(false)
    setConfirm('')
  }

  return (
    <div>
      <p className="text-sm leading-relaxed">
        Eliminar tu cuenta borra para siempre tu perfil, tus equipos, tus comentarios, tus «me gusta», a quién sigues y
        tus mensajes. <span className="font-semibold">No se puede deshacer.</span>
      </p>

      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={panelId}
          className="btn btn-danger mt-4 w-full sm:w-auto"
        >
          <Trash2 aria-hidden size={17} />
          Eliminar mi cuenta
        </button>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="confirmar"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <form
              action={action}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  close()
                }
              }}
              className="mt-4 flex flex-col gap-4 rounded-2xl border border-danger/40 bg-danger-soft p-4 sm:p-5"
            >
              <p className="extras-ink-danger flex items-start gap-2 text-sm font-bold">
                <TriangleAlert aria-hidden size={18} className="mt-px shrink-0" />
                Última comprobación: tus datos no se podrán recuperar.
              </p>
              <Field
                label={`Escribe ${CONFIRM_WORD} para confirmar`}
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                required
              />
              <InlineFeedback key={state.n} state={state} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className="btn btn-ghost">
                  Cancelar
                </button>
                <SubmitButton
                  variant="danger"
                  icon={<Trash2 aria-hidden size={17} />}
                  pendingLabel="Eliminando…"
                  disabled={!matches}
                >
                  Eliminar definitivamente
                </SubmitButton>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
