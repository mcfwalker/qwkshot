import { NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/supabase-route'
import { getConfiguredProviders } from '@/lib/llm/config'
import { LLMProviderRegistry } from '@/lib/llm/registry'
import { getGitInfo } from '@/lib/git'
import { ensureLLMSystemInitialized } from '@/lib/llm/init'
import type { SystemInfoResponse, SystemErrorResponse, LLMProviderInfo } from '@/lib/system/types'

// Mark as dynamic route with proper typing
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<SystemInfoResponse | SystemErrorResponse>> {
  try {
    // Get git info first - this is public info
    const { version, branch, environment } = await getGitInfo()

    // Check environment variables - also safe to expose
    const envStatus = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Initialize Supabase client and get session
    const supabase = await createRouteSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Check DB connection regardless of auth status
    let dbStatus = false
    try {
      const { error: dbError } = await supabase.from('models').select('count').limit(1)
      dbStatus = !dbError
    } catch (e) {
      console.error('Error checking DB status:', e)
    }

    // If not authenticated or session error, return limited info
    if (!session || sessionError) {
      console.log('System info: No valid session found');
      return NextResponse.json({
        version: version || 'unknown',
        branch,
        environment,
        status: {
          auth: false,
          db: dbStatus,
          env: envStatus
        },
        auth: {
          isAuthenticated: false,
          user: null
        },
        llm: {
          activeProvider: null,
          availableProviders: getConfiguredProviders()
        }
      } satisfies SystemInfoResponse)
    }

    console.log('System info: Valid session found for user:', session.user.email);

    // Initialize LLM system for authenticated users
    await ensureLLMSystemInitialized()
    
    // Get LLM info
    const registry = LLMProviderRegistry.getInstance()
    const activeProvider = await registry.getActiveProvider()
    const configuredProviders = getConfiguredProviders()

    // Get provider details with improved error handling
    let activeProviderInfo: LLMProviderInfo | null = null
    
    if (activeProvider) {
      try {
        const type = await activeProvider.getProviderType()
        const capabilities = await activeProvider.getCapabilities()
        
        activeProviderInfo = {
          type,
          capabilities: capabilities ? {
            name: capabilities.name,
            version: capabilities.version,
            maxTokens: capabilities.maxTokens,
            supportsJson: capabilities.supportsJson,
            temperature: capabilities.temperature,
            maxDuration: capabilities.maxDuration
          } : undefined
        }
        console.log('System info: Active provider info retrieved:', type);
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
          activeProviderInfo = {
            type: data.active_provider
          }
          console.log('System info: Provider found in database:', data.active_provider);
        }
      } catch (error) {
        console.error('Error checking database for provider:', error)
      }
    }

    const response = NextResponse.json({
      version,
      branch,
      environment,
      status: {
        auth: true,
        db: dbStatus,
        env: envStatus
      },
      auth: {
        isAuthenticated: true,
        user: session.user.email || null
      },
      llm: {
        activeProvider: activeProviderInfo,
        availableProviders: configuredProviders
      }
    } satisfies SystemInfoResponse)

    // Ensure proper cache headers
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    
    return response
  } catch (error) {
    console.error('Error getting system info:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get system info',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      } satisfies SystemErrorResponse,
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )
  }
} 