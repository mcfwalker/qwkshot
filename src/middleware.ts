import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function middleware(request: NextRequest) {
  try {
    // Create a response to modify
    const res = NextResponse.next()
    
    // Create a Supabase client configured to use cookies
    const supabase = createMiddlewareClient<Database>({ req: request, res })

    // Get the current session - this will refresh the session if needed
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Middleware session error:', sessionError)
      // Don't throw, let the request continue but without session
    }

    // Get the current URL path
    const path = request.nextUrl.pathname

    // Handle auth routes (/auth/*)
    if (path.startsWith('/auth/')) {
      if (session) {
        // If user is signed in and tries to access auth pages, redirect to library
        const redirectUrl = new URL('/library', request.url)
        return NextResponse.redirect(redirectUrl)
      }
      // Allow access to auth pages if not signed in
      return res
    }

    // Handle protected routes
    const protectedPaths = ['/viewer', '/library']
    const isProtectedPath = protectedPaths.some(protectedPath => 
      path.startsWith(protectedPath)
    )

    if (isProtectedPath) {
      if (!session) {
        // Save the original URL to redirect back after login
        const redirectUrl = new URL('/auth/sign-in', request.url)
        redirectUrl.searchParams.set('redirectTo', path)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // For all other routes, continue with the response
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    // On critical error, redirect to error page
    if (error instanceof Error && error.message.includes('critical')) {
      return NextResponse.redirect(new URL('/error', request.url))
    }
    // For other errors, allow the request to continue
    return NextResponse.next()
  }
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    // Match auth routes
    '/auth/:path*',
    // Match protected routes
    '/viewer/:path*',
    '/library/:path*',
    // Exclude static files and API routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 