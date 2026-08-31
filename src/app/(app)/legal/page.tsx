export const metadata = { title: 'Aviso legal' }

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-[720px] px-3 sm:px-4">
      <article className="rounded-card border border-line bg-surface p-6 shadow-card">
        <h1 className="mb-4 text-2xl font-extrabold">Aviso legal y condiciones de uso</h1>

        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <p>
            PokeHub es un proyecto personal, sin ánimo de lucro y sin relación alguna con Nintendo,
            Game Freak, Creatures Inc. ni The Pokémon Company.
          </p>
          <p>
            Pokémon y todos los nombres, imágenes y marcas relacionadas son propiedad de sus
            respectivos titulares. Los sprites y los datos de especies, movimientos, objetos y
            habilidades provienen de{' '}
            <a href="https://pokeapi.co" target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
              PokéAPI
            </a>{' '}
            y del repositorio público de sprites de PokéAPI, y se usan únicamente con fines
            ilustrativos.
          </p>
          <h2 className="mt-2 text-base font-bold">Contenido de la comunidad</h2>
          <p>
            Los equipos, descripciones, comentarios y mensajes los publican las personas usuarias.
            Al publicar contenido te comprometes a no incluir material ofensivo, ilegal ni datos
            personales de terceros.
          </p>
          <h2 className="mt-2 text-base font-bold">Datos</h2>
          <p>
            Guardamos únicamente tu email (para la autenticación), tu nombre de usuario y el
            contenido que publicas. Puedes editar tu perfil desde Configuración.
          </p>
        </div>
      </article>
    </div>
  )
}
