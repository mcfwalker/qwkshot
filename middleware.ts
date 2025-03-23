import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  try {
    // Only create Supabase client for non-auth routes
    if (!req.nextUrl.pathname.startsWith('/auth/')) {
      const supabase = createMiddlewareClient<Database>({ req, res })
      await supabase.auth.getSession()
    }
  } catch (e) {
    console.error('Middleware error:', e)
  }
  
  return res
}

// Define which routes the middleware applies to - exclude auth pages
export const config = {
  matcher: [
    // Match all routes except for static files, api routes, and auth-related paths
    "/((?!_next/static|_next/image|favicon.ico|api/.*|.*.svg).*)"
  ]
} 