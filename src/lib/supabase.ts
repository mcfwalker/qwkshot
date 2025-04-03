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
    const options: SupabaseClientOptions<'public'> = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'x-client-info': 'modern-3d-viewer',
          'Accept': 'application/json'
        }
      }
    };

    clientInstance = createClientComponentClient<Database>({
      supabaseUrl,
      supabaseKey,
      options
    });
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