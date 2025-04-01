import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { SupabaseClientOptions } from '@supabase/supabase-js'

// Log environment variables to debug
console.log('Client - ENV check - NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Client - ENV check - NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
console.log('Client - ENV check - Key length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0)

// Get environment variables without quotes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '') || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '') || ''

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Check your environment variables.')
}

let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;

// Get or create the singleton instance
export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClientComponentClient<Database>();
  }
  return clientInstance;
}

// Export the singleton instance for direct use
export const supabase = getSupabaseClient();

// Direct client for specific use cases (like SSR)
export const supabaseAdmin = createClientComponentClient<Database>({
  supabaseUrl,
  supabaseKey,
  options: {
    global: {
      headers: { 'x-client-info': 'modern-3d-viewer-admin' }
    }
  }
})

// Types for our database
export type Model = {
  id: string
  created_at: string
  name: string
  description?: string
  file_url: string
  thumbnail_url?: string
  metadata: {
    format: string
    size: number
    vertices?: number
    faces?: number
  }
  tags?: string[]
  user_id?: string
}

export type Collection = {
  id: string
  created_at: string
  name: string
  description?: string
  user_id?: string
  models?: Model[]
}

export type FloorTexture = {
  id: string
  created_at: string
  name: string
  description?: string
  file_url: string
  thumbnail_url?: string
  user_id: string
} 