import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

// Get environment variables without quotes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '') || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '') || ''

// More detailed logging for debugging
console.log('Server - Environment:', process.env.NODE_ENV)
console.log('Server - Supabase URL:', supabaseUrl)
console.log('Server - API Key exists:', !!supabaseKey)
console.log('Server - API Key length:', supabaseKey?.length || 0)
console.log('Server - API Key first 10 chars:', supabaseKey?.substring(0, 10))
console.log('Server - API Key last 10 chars:', supabaseKey?.length ? supabaseKey.substring(supabaseKey.length - 10) : '')

if (!supabaseUrl || !supabaseKey) {
  console.error('Server - Missing Supabase environment variables!')
  throw new Error('Missing Supabase environment variables')
}

// Create a server component client that uses cookies for auth
export async function createServerClient() {
  // Next.js cookies() returns a Promise as of Next.js 14
  const cookieStore = await cookies()
  
  // Create the client using the awaited cookie store
  return createServerComponentClient<Database>({
    cookies: () => {
      // Return an object that matches the expected Promise<ReadonlyRequestCookies> type
      // but actually uses our already-awaited cookie store
      return {
        get: cookieStore.get.bind(cookieStore),
        getAll: cookieStore.getAll.bind(cookieStore)
      } as any
    }
  })
} 