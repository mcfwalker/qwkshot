import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export async function GET() {
  try {
    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // Log debugging information
    console.log('API - Environment:', process.env.NODE_ENV)
    console.log('API - Supabase URL:', supabaseUrl)
    console.log('API - API Key length:', supabaseKey.length)

    // Create a direct client for data operations (not auth-dependent)
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);
    
    // Get cookies with async approach (Next.js 15 requires await)
    let cookieToken = null;
    let refreshToken = null;
    
    try {
      const cookieStore = await cookies();
      cookieToken = cookieStore.get('sb-mmoqqgsamsewsbocqxbi-auth-token')?.value;
      refreshToken = cookieStore.get('sb-mmoqqgsamsewsbocqxbi-auth-token.0')?.value;
      console.log('API - Cookie access successful:', !!cookieToken);
    } catch (cookieError) {
      console.error('API - Cookie access error:', cookieError);
    }
    
    // Check if user is authenticated - if not, just fetch public models
    if (!cookieToken) {
      console.log('API - No session token in cookies, fetching public models')
      
      // Fetch only public models
      const { data: models, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('API - Database error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch models', details: error.message },
          { status: 500 }
        )
      }

      console.log(`API - Successfully fetched ${models?.length || 0} public models`)
      return NextResponse.json({ models: models || [] })
    }

    // If we have a token, try to use it
    try {
      // Set the auth token on the client
      await supabase.auth.setSession({
        access_token: cookieToken,
        refresh_token: refreshToken || '',
      });
      
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('API - No user found with the provided token')
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      console.log('API - Authenticated user ID:', user.id)

      // Fetch models for the authenticated user
      const { data: models, error: modelsError } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })

      if (modelsError) {
        console.error('API - Database error:', modelsError)
        return NextResponse.json(
          { error: 'Failed to fetch models', details: modelsError.message },
          { status: 500 }
        )
      }

      console.log(`API - Successfully fetched ${models?.length || 0} models`)
      return NextResponse.json({ models: models || [] })
    } catch (authError) {
      console.error('API - Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication error', details: JSON.stringify(authError) },
        { status: 401 }
      )
    }
  } catch (error) {
    // Log the full error for debugging
    console.error('API - Unhandled error:', error)
    
    // Return a structured error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 }
    )
  }
} 