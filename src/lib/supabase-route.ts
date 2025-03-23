import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Helper function to create a properly configured Supabase client for route handlers
export async function createRouteSupabaseClient() {
  try {
    // Get the cookie store first - must have this outside the client creation
    const cookieStore = cookies()
    
    // Create the Supabase client with proper cookie handling
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => cookieStore
    })
    
    return supabase
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    throw error
  }
} 