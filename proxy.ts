import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16 renamed `middleware.ts` to `proxy.ts`: this file refreshes the
// Supabase session on every request and gates non-public routes.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets:
     * - _next/static (build output)
     * - _next/image (image optimization)
     * - favicon.ico and static files in public/
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
