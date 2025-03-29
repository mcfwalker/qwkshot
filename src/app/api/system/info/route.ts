import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteSupabaseClient } from '@/lib/supabase-route'
import { getConfiguredProviders } from '@/lib/llm/config'
import { LLMProviderRegistry } from '@/lib/llm/registry'
import { getGitInfo } from '@/lib/git'
import { ensureLLMSystemInitialized } from '@/lib/llm/init'
import type { SystemInfoResponse, SystemErrorResponse } from '@/lib/system/types'

// Mark as dynamic route with proper typing
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<SystemInfoResponse | SystemErrorResponse>> {
  try {
    // First check authentication
    const cookieStore = await cookies()
    const supabase = await createRouteSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    // If not authenticated, return 401
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize LLM system
    await ensureLLMSystemInitialized()
    
    // Get git info
    const { version, branch, environment } = await getGitInfo()

    // Get LLM info
    const registry = LLMProviderRegistry.getInstance()
    const activeProvider = await registry.getActiveProvider()
    const configuredProviders = getConfiguredProviders()

    // Check Supabase connection
    let dbStatus = false
    try {
      const { data, error } = await supabase.from('models').select('count').limit(1)
      dbStatus = !error
    } catch (e) {
      console.error('Error checking DB status:', e)
    }

    // Check environment variables
    const envStatus = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Get provider details
    let activeProviderType = 'none'
    let activeProviderCapabilities = null
    
    if (activeProvider) {
      try {
        activeProviderType = await activeProvider.getProviderType()
        activeProviderCapabilities = await activeProvider.getCapabilities()
      } catch (error) {
        console.error('Error getting provider details:', error)
      }
    } else {
      // Check database for provider state
      try {
        const { data, error } = await supabase
          .from('llm_state')
          .select('active_provider')
          .eq('id', 1)
          .single()
          
        if (!error && data?.active_provider) {
          activeProviderType = data.active_provider
        }
      } catch (error) {
        console.error('Error checking database for provider:', error)
      }
    }

    return NextResponse.json({
      version,
      branch,
      environment,
      status: {
        auth: true, // We know auth is true if we got here
        db: dbStatus,
        env: envStatus
      },
      auth: {
        isAuthenticated: true,
        user: session.user.email || null
      },
      llm: {
        activeProvider: activeProvider ? {
          type: activeProviderType,
          capabilities: activeProviderCapabilities
        } : activeProviderType !== 'none' ? {
          type: activeProviderType,
          capabilities: null
        } : null,
        availableProviders: configuredProviders
      }
    })
  } catch (error) {
    console.error('Error getting system info:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get system info',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
} 