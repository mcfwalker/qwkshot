import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase-route'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/viewer'

  if (code) {
    try {
      const supabase = await getSupabaseClient()
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL('/auth/sign-in', request.url))
    }
  } else {
    console.error('No code in callback')
    return NextResponse.redirect(new URL('/auth/sign-in', request.url))
  }

  // Get the intended redirect URL from the query params
  return NextResponse.redirect(new URL(redirectTo, request.url))
} 