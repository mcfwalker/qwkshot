import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

let routeClientInstance: ReturnType<typeof createRouteHandlerClient<Database>> | null = null;

// Helper function to create a properly configured Supabase client for route handlers
export async function getSupabaseClient() {
  if (!routeClientInstance) {
    try {
      // Get cookie store
      const cookieStore = cookies()
      routeClientInstance = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    } catch (error) {
      console.error('Error creating Supabase client:', error)
      throw error
    }
  }
  return routeClientInstance
} 