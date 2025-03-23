import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    console.log('Auth callback - Processing with code')
    
    try {
      await supabase.auth.exchangeCodeForSession(code)
      console.log('Auth callback - Session established')
    } catch (error) {
      console.error('Auth callback error:', error)
    }
  } else {
    console.log('Auth callback - No code found')
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/library', request.url))
} 