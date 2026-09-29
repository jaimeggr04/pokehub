import Link from 'next/link'
import {
  CalendarDays, Cookie, FileText, History, Link2, Scale, ShieldCheck, Users,
} from 'lucide-react'
import { SectionLayout, type SectionNavItem } from '@/components/extras-section-nav'

export const metadata = {
  title: 'Aviso legal',
  description: 'Aviso legal, condiciones de uso, privacidad y lista exacta de cookies y almacenamiento de PokeHub.',
}

// Al tocar el texto, actualizar las dos a la vez.
const UPDATED_ISO = '2026-09'
const UPDATED_LABEL = 'septiembre de 2026'

const SECTIONS: SectionNavItem[] = [
  { id: 'aviso-legal', label: 'Aviso legal', icon: <Scale size={16} /> },
  { id: 'condiciones', label: 'Condiciones de uso', icon: <FileText size={16} /> },
  { id: 'comunidad', label: 'Contenido de la comunidad', icon: <Users size={16} /> },
  { id: 'privacidad', label: 'Privacidad', icon: <ShieldCheck size={16} /> },
  { id: 'cookies', label: 'Cookies y almacenamiento', icon: <Cookie size={16} /> },
  { id: 'cambios', label: 'Cambios en este texto', icon: <History size={16} /> },
]

type StorageEntry = { name: string; purpose: React.ReactNode; lasts: string }

// Lista exacta, sacada del código: si se añade una clave nueva a localStorage,
// sessionStorage o una cookie, tiene que aparecer aquí.
const COOKIES: StorageEntry[] = [
  {
    name: 'sb-…-auth-token',
    purpose: (
      <>
        Mantiene tu sesión iniciada. La crea Supabase, el servicio de autenticación; si no cabe en una sola cookie se
        divide en partes (<code>.0</code>, <code>.1</code>…).
      </>
    ),
    lasts: 'Hasta que cierras sesión (400 días como máximo sin usarla)',
  },
  {
    name: 'sb-…-code-verifier',
    purpose: (
      <>
        Temporal. Comprueba que eres tú quien completa un acceso con Google o GitHub o quien abre un enlace enviado
        por correo.
      </>
    ),
    lasts: 'Se borra al completar ese paso',
  },
  {
    name: 'ph-recovery',
    purpose: (
      <>
        Temporal. Se crea al abrir un enlace para restablecer la contraseña y es lo que permite elegir la nueva sin
        pedir la actual. Guarda el identificador de tu cuenta.
      </>
    ),
    lasts: '30 minutos como máximo; se borra al cambiar la contraseña',
  },
]

const LOCAL: StorageEntry[] = [
  {
    name: 'pokehub-theme',
    purpose: <>El tema que eliges, claro u oscuro. Con «Sistema» no se guarda nada.</>,
    lasts: 'Hasta que lo borras',
  },
  {
    name: 'pokehub-palette-recent',
    purpose: <>Los últimos sitios que has abierto desde la paleta de comandos (hasta 4).</>,
    lasts: 'Hasta que lo borras',
  },
  {
    name: 'pokehub:busquedas-recientes',
    purpose: <>Tus últimas búsquedas de entrenadores y equipos (hasta 5).</>,
    lasts: 'Hasta que lo borras',
  },
  {
    name: 'pokehub:variocolor',
    purpose: <>Los Pokémon variocolor que has atrapado.</>,
    lasts: 'Hasta que lo borras',
  },
  {
    name: 'pokehub:medallas:<id>',
    purpose: (
      <>
        Las medallas de tu perfil que ya has visto, para celebrar sólo las nuevas. <code>&lt;id&gt;</code> es el
        identificador de tu cuenta.
      </>
    ),
    lasts: 'Hasta que lo borras',
  },
]

const SESSION: StorageEntry[] = [
  {
    name: 'pokeapi:*',
    purpose: <>Copia de los datos ya descargados de PokéAPI (especies, movimientos…), para no pedirlos otra vez.</>,
    lasts: 'Hasta cerrar la pestaña',
  },
  {
    name: 'pokehub:companion',
    purpose: <>El Pokémon compañero que te saluda en el inicio, para que no cambie en cada visita.</>,
    lasts: 'Hasta cerrar la pestaña',
  },
]

export default function LegalPage() {
  return (
    // md:pt-4: el contenido empieza donde acaba la pokéball que cuelga de la cabecera.
    <div className="mx-auto w-full max-w-[1040px] px-3 sm:px-4 md:pt-4">
      <header className="animate-fade-up">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Legal</p>
        <h1 className="mt-1.5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Aviso legal y privacidad
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted">
          Qué es PokeHub, qué normas tiene la comunidad y qué se hace con tus datos, sin letra pequeña.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-card">
          <CalendarDays aria-hidden size={14} />
          Última actualización: <time dateTime={UPDATED_ISO} className="text-ink">{UPDATED_LABEL}</time>
        </p>
      </header>

      <Summary />

      <SectionLayout
        className="mt-6"
        items={SECTIONS}
        ariaLabel="Índice del aviso legal"
        railTitle="Índice"
        numbered
        chips={false}
        railFooter={
          <>
            Actualizado en <time dateTime={UPDATED_ISO}>{UPDATED_LABEL}</time>
          </>
        }
      >
        <nav aria-label="Índice del aviso legal" className="card mb-5 p-4 md:hidden">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Índice</p>
          <ol className="mt-2 flex flex-col">
            {SECTIONS.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-sm font-semibold transition-colors hover:text-brand"
                >
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold tabular-nums text-muted shadow-card"
                  >
                    {i + 1}
                  </span>
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col gap-5">
          <LegalSection index={0}>
            <p>
              PokeHub es un <strong>proyecto personal, sin ánimo de lucro y no oficial</strong>. No tiene relación
              alguna con Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company, que no lo patrocinan ni lo
              respaldan.
            </p>
            <p>
              Pokémon y todos los nombres, imágenes y marcas relacionados son propiedad de sus respectivos titulares.
              En PokeHub se usan sólo para identificar a cada Pokémon, con fines informativos.
            </p>
            <p>
              Los datos de especies, movimientos, objetos y habilidades provienen de{' '}
              <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
                PokéAPI
              </a>
              , una API pública y gratuita, y los sprites, de su repositorio público de sprites, que se sirve desde
              GitHub. PokeHub no puede garantizar que esos datos estén libres de errores.
            </p>
            <p>
              PokeHub no vende nada: no hay compras, suscripciones ni publicidad. El{' '}
              <Link href="/premium">plan Premium</Link> es sólo una maqueta y sus pagos no están activos.
            </p>
          </LegalSection>

          <LegalSection index={1}>
            <p>
              Usar PokeHub es gratis. Para publicar necesitas una cuenta, y eres responsable de lo que se haga con
              ella: usa una contraseña segura y no la compartas.
            </p>
            <p>
              El servicio se ofrece tal cual, como proyecto personal. Puede tener errores, pausas o cambios, y no se
              garantiza que esté siempre disponible. Si un equipo te importa, guarda también una copia exportándolo a
              Showdown.
            </p>
            <p>No está permitido usar PokeHub para:</p>
            <ul>
              <li>enviar spam o publicidad;</li>
              <li>suplantar a otras personas;</li>
              <li>intentar entrar en cuentas ajenas o saltarse las restricciones de acceso;</li>
              <li>saturar el servicio con peticiones automatizadas.</li>
            </ul>
            <p>
              Puedes dejar de usar PokeHub y eliminar tu cuenta cuando quieras desde{' '}
              <Link href="/settings#peligro">Configuración</Link>.
            </p>
          </LegalSection>

          <LegalSection index={2}>
            <p>
              Los equipos, descripciones, comentarios y mensajes los publican las personas usuarias, y cada cual es
              responsable de lo que escribe. Al publicar te comprometes a:
            </p>
            <ul>
              <li>respetar a los demás: nada de insultos, acoso ni discriminación;</li>
              <li>no incluir material ofensivo ni ilegal;</li>
              <li>no publicar datos personales de terceros;</li>
              <li>no hacer spam ni publicidad.</li>
            </ul>
            <p>
              Lo que publicas sigue siendo tuyo. Al publicarlo permites que PokeHub lo muestre dentro de la app mientras
              no lo borres. El contenido que incumpla estas normas puede retirarse.
            </p>
          </LegalSection>

          <LegalSection index={3}>
            <h3>Qué se guarda</h3>
            <ul>
              <li>
                <strong>Tu email</strong>, para la autenticación: entrar, confirmar cambios y recuperar el acceso. No
                aparece en tu perfil ni se muestra a otras personas.
              </li>
              <li>
                <strong>Tu contraseña</strong>, si tienes una, cifrada por Supabase: nadie puede leerla.
              </li>
              <li>
                <strong>Tu perfil</strong>: nombre de usuario, nombre para mostrar, biografía y foto.
              </li>
              <li>
                <strong>El contenido que publicas</strong>: equipos, comentarios, «me gusta», a quién sigues y tus
                mensajes.
              </li>
            </ul>

            <h3>Dónde y quién lo ve</h3>
            <p>
              Todo se aloja en <strong>Supabase</strong> (base de datos y almacenamiento de archivos), con reglas que
              impiden que otras cuentas modifiquen tus datos. Tu perfil, tus equipos y tus comentarios son públicos; los
              mensajes directos sólo los pueden leer quienes participan en la conversación.
            </p>
            <p>
              Si entras con Google o GitHub, ese servicio comparte con PokeHub tu email, tu nombre y tu foto, que se
              usan para crear tu perfil; puedes cambiarlos cuando quieras.
            </p>
            <p>
              Tu navegador descarga datos de PokéAPI y sprites desde GitHub; como con cualquier web, esos servicios
              reciben tu dirección IP al hacerlo. Las fuentes tipográficas se sirven desde el propio PokeHub.
            </p>

            <h3>Lo que no se hace</h3>
            <p>
              <strong>No se venden ni se ceden tus datos</strong> a nadie, ni se usan para publicidad.
            </p>

            <h3>Tu control</h3>
            <p>
              Puedes editar tu perfil y tu email en <Link href="/settings#perfil">Configuración</Link>. Si eliminas tu
              cuenta desde la <Link href="/settings#peligro">zona de peligro</Link>, se borran tu perfil, tus equipos,
              tus comentarios, tus «me gusta», tus seguimientos y tus mensajes.
            </p>
          </LegalSection>

          <LegalSection index={4}>
            <p>
              PokeHub sólo usa <strong>las cookies imprescindibles para tu sesión</strong> y guarda unas pocas
              preferencias en tu navegador. Esta es la lista completa.{' '}
              <strong>No hay analítica, ni rastreo, ni publicidad, ni cookies de terceros.</strong>
            </p>

            <StorageGroup title="Cookies" note="Viajan con cada petición a PokeHub." entries={COOKIES} />
            <StorageGroup
              title="localStorage"
              note="Se quedan en este navegador; nunca se envían a ningún servidor."
              entries={LOCAL}
            />
            <StorageGroup
              title="sessionStorage"
              note="Igual que las anteriores, pero se borran al cerrar la pestaña."
              entries={SESSION}
            />

            <p>
              Puedes borrarlo todo desde los ajustes de tu navegador (datos del sitio). Si borras la cookie de sesión,
              tendrás que volver a entrar.
            </p>
          </LegalSection>

          <LegalSection index={5}>
            <p>
              Si este texto cambia, se publicará aquí mismo y se actualizará la fecha de la última actualización:{' '}
              <time dateTime={UPDATED_ISO}>{UPDATED_LABEL}</time>.
            </p>
          </LegalSection>
        </div>
      </SectionLayout>
    </div>
  )
}

/* ---------------------------------- Piezas ---------------------------------- */

function Summary() {
  const points = [
    'Proyecto personal, sin ánimo de lucro y no oficial.',
    'Sólo se guarda lo necesario: tu email para entrar, tu perfil y lo que publicas.',
    'No se venden datos. Sin publicidad, analítica ni rastreo.',
    'Puedes editar o borrar tu cuenta cuando quieras.',
  ]

  return (
    <section
      aria-labelledby="resumen-titulo"
      className="card mt-6 animate-fade-up p-5 [animation-delay:60ms] sm:p-6"
    >
      <h2 id="resumen-titulo" className="text-base font-bold">
        En resumen
      </h2>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm leading-snug">
            <ShieldCheck aria-hidden size={17} className="mt-px shrink-0 text-success" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  )
}

function LegalSection({ index, children }: { index: number; children: React.ReactNode }) {
  const { id, label, icon } = SECTIONS[index]
  const titleId = `${id}-titulo`

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      style={{ '--i': index } as React.CSSProperties}
      className="extras-legal-section card stagger-item scroll-mt-4 p-5 sm:p-7"
    >
      <header className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </span>
        <h2 id={titleId} className="min-w-0 text-xl font-extrabold leading-tight tracking-tight">
          <span className="sr-only">{index + 1}. </span>
          {label}
        </h2>
        <a
          href={`#${id}`}
          aria-label={`Enlace directo a «${label}»`}
          title="Enlace directo a esta sección"
          className="extras-anchor btn btn-ghost btn-sm btn-icon ml-auto text-muted hover:text-brand"
        >
          <Link2 aria-hidden size={16} />
        </a>
      </header>
      <div className="extras-prose">{children}</div>
    </section>
  )
}

function StorageGroup({ title, note, entries }: { title: string; note: string; entries: StorageEntry[] }) {
  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-line bg-surface-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-4 py-3">
        <h3 className="font-mono text-sm font-bold">{title}</h3>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <dl className="divide-y divide-line">
        {entries.map((entry) => (
          <div key={entry.name} className="grid gap-1.5 px-4 py-3.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
            <dt>
              <code className="extras-key">{entry.name}</code>
            </dt>
            <dd className="text-sm leading-relaxed">
              {entry.purpose}
              <span className="mt-1 block text-xs font-medium text-muted">{entry.lasts}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
