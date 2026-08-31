# PokeHub

Red social para entrenadores de Pokémon competitivo: monta tus equipos, publícalos,
descúbrelos de otros y coméntalos.

**Demo:** https://pokehub-tawny-three.vercel.app

---

## Qué hace

- **Creador de equipos** con hasta seis Pokémon. Los selectores muestran el sprite
  junto al nombre y cargan de 20 en 20, así que se navegan bien pese a tener ~1300
  Pokémon y ~2200 objetos. Los movimientos se limitan al *learnset* real de cada
  especie, y las estadísticas finales se calculan en vivo con la fórmula de 3.ª
  generación en adelante (naturaleza, IVs y EVs incluidos).
- **Importar y exportar de Pokémon Showdown**, incluyendo equipos en español y
  formatos irregulares (líneas en blanco de más, movimientos sin guion, nombres
  traducidos a mano). Ver [Importador](#importador-de-showdown).
- **Social**: seguir entrenadores, me gusta, comentarios, compartir y mensajería
  privada en tiempo real.
- **Cuentas** con email y contraseña, o con Google y GitHub.
- **Tema claro y oscuro**: el modo claro se viste de Pokéball y el oscuro de
  Master Ball.

## Tecnologías

| Capa | Elección |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 4 (configuración CSS-first, sin `tailwind.config`) |
| Datos y auth | Supabase (Postgres + RLS + Realtime + Storage) |
| Datos de Pokémon | [PokéAPI](https://pokeapi.co) |
| Despliegue | Vercel |

No hay librería de estado ni de fetching: basta con Server Components para leer,
Server Actions para escribir y los hooks de React 19 (`useOptimistic`,
`useActionState`) para que la interfaz responda al instante.

## Puesta en marcha

Necesitas Node.js 20 o superior y un proyecto de Supabase (el plan gratuito sobra).

```bash
git clone https://github.com/jaimeggr04/pokehub.git
cd pokehub
npm install
cp .env.example .env.local     # y rellena las dos variables
npm run dev
```

La app queda en http://localhost:3000.

### Base de datos

Aplica las migraciones de `supabase/migrations/` en orden. Con la CLI de Supabase:

```bash
supabase link --project-ref TU_REF
supabase db push
```

O pegando cada `.sql` en el SQL Editor del panel. Crean el esquema, las políticas
RLS, los disparadores (alta de perfil, contadores de me gusta y comentarios), el
bucket de avatares y las funciones auxiliares.

### Configuración de autenticación

En el panel de Supabase, *Authentication*:

- **URL Configuration** → *Site URL* con la URL pública de la app, y esa misma URL
  con `/**` en *Redirect URLs*. Si se queda en `localhost`, los enlaces de
  confirmación y los retornos de OAuth apuntan a tu máquina y no funcionan en
  producción.
- **Sign In / Providers → Email** → desactiva *Confirm email* si quieres que el
  registro entre directo. Con la confirmación activada hace falta un SMTP propio:
  el servicio integrado de Supabase sólo permite unos pocos correos por hora.
- **Providers → Google / GitHub** → pega el *Client ID* y el *Secret* de cada uno.
  La URL de retorno que hay que registrar en Google Cloud y en GitHub es:
  `https://TU-PROYECTO.supabase.co/auth/v1/callback`

Los botones de Google y GitHub sólo aparecen habilitados si el proveedor está
activo: la app consulta `/auth/v1/settings` y avisa en vez de dejar un botón roto.

## Estructura

```
src/
  app/
    (auth)/          login y registro
    (app)/           feed, perfiles, equipos, búsqueda, mensajes, ajustes
    auth/callback/   canje del código OAuth por sesión
    actions/         Server Actions (perfil, cuenta, equipos, social)
  components/        UI (creador de equipos, selectores, pokéball, social…)
  lib/
    supabase/        clientes de navegador, servidor y middleware
    pokeapi.ts       cliente de PokéAPI con caché en memoria + sessionStorage
    pokemon.ts       sprites, tipos, naturalezas y cálculo de estadísticas
    showdown.ts      importación y exportación del formato de Showdown
    showdown-i18n.ts traducción de equipos en español
supabase/migrations/ esquema, funciones, RLS y ajustes posteriores
```

## Importador de Showdown

Un pegado de Showdown puede venir de muchas formas, y el importador está pensado
para tragárselas casi todas:

- **Cabecera de equipo** (`=== [gen9vgc2024regh] Mi equipo ===`): se reconoce y se
  usa para rellenar el nombre y el formato. Si se tomara como un Pokémon más se
  perdería el sexto al recortar a seis.
- **Bloques sin líneas en blanco fiables**: los Pokémon se detectan por estructura,
  no por separación, porque hay exports con una línea vacía entre *cada* línea.
- **Movimientos sin guion**: se distinguen del Pokémon siguiente mirando si la
  línea posterior es un campo (`Habilidad:`, `EVs:`…).
- **Formas raras**: `Necrozma-Dusk-Mane`, `Urshifu-Rapid-Strike`, `Flabébé`,
  `Farfetch'd-Galar`, `Type: Null`, `Zygarde-10%`… Se prueban variantes y, si el
  nombre base no existe en la PokéAPI (Aegislash, Zygarde, Giratina…), se resuelve
  la forma por defecto vía `/pokemon-species`.
- **Equipos en español**, incluidos los pasados por un traductor automático. Se
  combinan el diccionario oficial de la PokéAPI, traducción literal palabra a
  palabra insensible al orden (*Espada Sagrada* → `sacred-sword`) y comparación
  aproximada acotada a los candidatos válidos de cada Pokémon.

Lo que no se puede traducir no rompe la importación: entra el resto y un aviso
indica qué campos conviene revisar a mano.

## Licencia

Proyecto personal, sin ánimo de lucro. Pokémon y todos los nombres relacionados
son marca registrada de Nintendo, Creatures Inc. y GAME FREAK inc. Este proyecto
no está afiliado a ellos.
