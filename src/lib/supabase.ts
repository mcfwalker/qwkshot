import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Log environment variables to debug
console.log('Client - ENV check - NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Client - ENV check - NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) 
console.log('Client - ENV check - Key length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0)

// Get environment variables without quotes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '') || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '') || ''

// Check for valid credentials
if (!supabaseUrl || supabaseUrl === '') {
  console.error('Missing Supabase URL. Check your environment variables.')
}

if (!supabaseKey || supabaseKey === '') {
  console.error('Missing Supabase Anon Key. Check your environment variables.')
}

// Client-side Supabase client (using direct client instead of auth-helpers)
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      // Log detailed errors in development
      fetch: (...args) => {
        // Make a copy of args to log if needed
        const [url, options] = args;

        console.log('Supabase fetch request to:', typeof url === 'string' ? url.split('?')[0] : 'unknown endpoint');
        
        // Check if this is a storage request
        if (typeof url === 'string' && url.includes('storage')) {
          console.log('Processing storage request');
        }
        
        // Use the original fetch
        return fetch(...args).then(async (response) => {
          // Clone the response to allow multiple reads
          const clonedResponse = response.clone();
          
          // Get URL details for debugging
          const requestUrl = typeof url === 'string' ? url.split('?')[0] : 'unknown';
          
          if (!response.ok) {
            try {
              // Try to parse the response as JSON
              let responseData;
              try {
                responseData = await clonedResponse.json();
              } catch (e) {
                // If we can't parse as JSON, get text
                const textResponse = await response.clone().text();
                responseData = { rawText: textResponse };
              }
              
              console.error('Supabase API error:', {
                status: response.status,
                statusText: response.statusText,
                url: requestUrl,
                headers: Object.fromEntries([...response.headers.entries()]),
                data: responseData
              });
              
              // Check for specific error types
              if (response.status === 403) {
                console.error('Permission denied - Check RLS policies and authentication');
              } else if (response.status === 400) {
                console.error('Bad request - Check parameters and payload format');
              } else if (response.status === 404) {
                console.error('Resource not found - Check bucket/table names and paths');
              } else if (response.status === 0 || !response.status) {
                console.error('Network error - Possible CORS issue');
              }
            } catch (e) {
              // If all parsing fails, just log the basic response
              console.error('Supabase API error (unparseable):', {
                status: response.status,
                statusText: response.statusText,
                url: requestUrl
              });
            }
          } else {
            // For successful storage requests, log minimal info
            if (typeof url === 'string' && url.includes('storage')) {
              console.log(`Storage operation succeeded: ${response.status} ${response.statusText}`);
            }
          }
          
          // Return the original response
          return response;
        }).catch(err => {
          // Catch network errors or other fetch failures
          console.error('Fetch error (possible CORS or network issue):', err);
          throw err;
        });
      }
    }
  }
)

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