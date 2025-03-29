import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// Middleware runs before routing/rendering
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const res = NextResponse.next()
  
  try {
    const supabase = createMiddlewareClient<Database>({ req: request, res })
    const { data: { session } } = await supabase.auth.getSession()

    // Handle auth routes
    if (path === '/auth/sign-in' || path === '/auth/sign-up') {
      if (session) {
        return NextResponse.redirect(new URL('/library', request.url))
      }
      return res
    }

    // Handle protected routes
    if (path.startsWith('/admin') || path.startsWith('/library') || path.startsWith('/viewer')) {
      if (!session) {
        const redirectUrl = new URL('/auth/sign-in', request.url)
        redirectUrl.searchParams.set('redirectTo', path)
        return NextResponse.redirect(redirectUrl)
      }
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    '/admin/:path*',
    '/library/:path*',
    '/viewer/:path*',
    '/auth/:path*'
  ]
} 