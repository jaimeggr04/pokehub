import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// La recuperación de contraseña es pública pero, a diferencia de /login y
// /register, no echa a quien ya tiene sesión: /reset-password se usa justo con
// la sesión que abre el enlace, y desde Ajustes se manda a /forgot-password.
const PUBLIC_ROUTES = ['/', '/login', '/register', '/auth', '/forgot-password', '/reset-password']
const GUEST_ONLY_ROUTES = ['/login', '/register']

// Manifest, iconos e imagen para compartir que genera Next (src/app/manifest.ts,
// icon.tsx…). El navegador pide el manifest sin cookies y los rastreadores de
// redes sociales no tienen sesión: redirigirlos al login los rompería. Admite el
// id de generateImageMetadata (/icon/192) y el sufijo de 6 caracteres que Next
// añade a las rutas de metadatos dentro de grupos (/opengraph-image-1a2b3c).
const METADATA_ROUTE =
  /^\/(?:manifest\.webmanifest|(?:icon|apple-icon|opengraph-image|twitter-image)(?:-[0-9a-z]{6})?(?:\/[\w-]+)?)$/

export async function updateSession(request: NextRequest) {
  // Son recursos estáticos: ni necesitan sesión ni hace falta refrescarla.
  if (METADATA_ROUTE.test(request.nextUrl.pathname)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: no ejecutar código entre createServerClient y getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && GUEST_ONLY_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
