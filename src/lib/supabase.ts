import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
import { SupabaseClientOptions } from '@supabase/supabase-js'

// Debug logs only in development environment
if (process.env.NODE_ENV === 'development') {
  // These logs will only show during development, not in production
  const isDev = process.env.NODE_ENV === 'development';
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const keyLength = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0;
  
  if (!hasUrl || !hasKey) {
    console.warn('Development warning: Missing Supabase environment variables');
  }
}

// Get environment variables without quotes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '') || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '') || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Check your environment variables.')
}

// Use specific types for clarity
let componentClientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;
let serviceRoleClientInstance: SupabaseClient | null = null;

/**
 * Gets the singleton Supabase client instance (using ANON key via Auth Helper).
 * Suitable for client-side usage or server-side components.
 */
export function getSupabaseClient(): ReturnType<typeof createClientComponentClient<Database>> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Anon Key is missing from environment variables.');
  }
  if (!componentClientInstance) {
    // Assuming component client is the intended default based on original code
    componentClientInstance = createClientComponentClient<Database>();
  }
  return componentClientInstance;
}

/**
 * Gets the singleton Supabase client instance (using SERVICE ROLE key).
 * WARNING: This client bypasses RLS. Use only in trusted server-side environments (like API routes).
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable to be set.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase URL or Service Role Key is missing from environment variables.');
  }
  if (!serviceRoleClientInstance) {
    // Only log warning in development environment
    if (process.env.NODE_ENV === 'development') {
      console.warn('!!! Creating Supabase client with SERVICE ROLE KEY !!!'); 
    }
    // Use the imported core createClient
    serviceRoleClientInstance = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-client-info': 'modern-3d-viewer-service-role' 
        }
      }
    });
  }
  return serviceRoleClientInstance;
}

// Export the component client as default?
// Re-enable direct export if needed by components
export const supabase = createClientComponentClient<Database>({
  options: {
    global: {
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-client-info': 'modern-3d-viewer' 
      }
    }
  }
});

// Direct client for specific use cases (like SSR)
export const supabaseAdmin = createClientComponentClient<Database>({
  supabaseUrl,
  supabaseKey,
  options: {
    global: {
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-client-info': 'modern-3d-viewer-admin' 
      }
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
    geometry?: {
      vertexCount: number
      faceCount: number
      boundingBox: {
        min: { x: number; y: number; z: number }
        max: { x: number; y: number; z: number }
      }
      center: { x: number; y: number; z: number }
      dimensions: { x: number; y: number; z: number }
    }
    spatial?: {
      bounds: {
        min: { x: number; y: number; z: number }
        max: { x: number; y: number; z: number }
        center: { x: number; y: number; z: number }
        dimensions: { x: number; y: number; z: number }
      }
      complexity: 'simple' | 'moderate' | 'high'
      symmetry: {
        hasSymmetry: boolean
        symmetryPlanes: Array<{
          normal: { x: number; y: number; z: number }
          constant: number
        }>
      }
    }
    environment?: Record<string, any>
    orientation?: {
      front: { x: number; y: number; z: number }
      back: { x: number; y: number; z: number }
      left: { x: number; y: number; z: number }
      right: { x: number; y: number; z: number }
      top: { x: number; y: number; z: number }
      bottom: { x: number; y: number; z: number }
      center: { x: number; y: number; z: number }
      scale: number
      confidence: number
      position?: { x: number; y: number; z: number }
      rotation?: { x: number; y: number; z: number }
    }
    preferences?: {
      defaultCameraDistance: number
      defaultCameraHeight: number
      preferredViewAngles: number[]
      uiPreferences: {
        showGrid: boolean
        showAxes: boolean
        showMeasurements: boolean
      }
    }
    performance_metrics?: {
      sceneAnalysis: Record<string, any>
      spatialAnalysis: Record<string, any>
      featureAnalysis: Record<string, any>
    }
    createdAt?: string
    updatedAt?: string
    version?: number
  }
  tags: string[]
  user_id: string
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