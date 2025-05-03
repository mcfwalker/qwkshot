import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { cookies } from 'next/headers'

// Get environment variables without quotes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '') || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '') || ''

// Only log in development environment
if (process.env.NODE_ENV === 'development') {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Server - Missing Supabase environment variables!')
  }
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export async function createServerClient() {
  const cookieStore = cookies()
  
  return createServerComponentClient<Database>({
    cookies: () => cookieStore
  })
} 