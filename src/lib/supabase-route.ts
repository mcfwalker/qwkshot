import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Helper function to create a properly configured Supabase client for route handlers
export async function createRouteSupabaseClient() {
  try {
    return createRouteHandlerClient<Database>({ cookies })
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    throw error
  }
} 