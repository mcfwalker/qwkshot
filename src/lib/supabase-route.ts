import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Helper function to create a properly configured Supabase client for route handlers
export async function createRouteSupabaseClient() {
  try {
    // Get the cookie store - cookies() now returns a Promise in Next.js 15+
    const cookieStore = await cookies()
    
    // Create the Supabase client with proper cookie handling that doesn't use .get()
    const supabase = createRouteHandlerClient<Database>({
      cookies: () => {
        // Return properly typed cookie handler
        return {
          get: cookieStore.get.bind(cookieStore),
          getAll: cookieStore.getAll.bind(cookieStore)
        } as any
      }
    })

    // Test the connection to ensure it's working
    await supabase.auth.getSession()
    
    return supabase
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    throw error
  }
} 