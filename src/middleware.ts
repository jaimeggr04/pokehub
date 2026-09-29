import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // api/usage: datos públicos de Smogon, sin sesión y cacheables por la CDN.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/usage|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
