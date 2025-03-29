import { NextResponse } from 'next/server'
import { PerformanceMonitor } from '@/lib/system/performance'
import { apiPerformance, API_THRESHOLDS } from '@/lib/monitoring/api-performance'
import { createRouteSupabaseClient } from '@/lib/supabase-route'
import { LLMProviderRegistry } from '@/lib/llm/registry'
import { cookies } from 'next/headers'

interface EndpointStats {
  endpoint: string;
  averageResponseTime: number;
  lastResponseTime: number;
  status: 'good' | 'warning' | 'critical';
  recentRequests: number;
  successRate: number;
}

// Mark as dynamic to ensure fresh data
export const dynamic = 'force-dynamic'

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Initialize Supabase client
    const supabase = await createRouteSupabaseClient()
    
    // Get session without throwing errors
    let session = null
    let sessionError = null
    try {
      const sessionResult = await supabase.auth.getSession()
      session = sessionResult.data.session
      sessionError = sessionResult.error
    } catch (e) {
      console.error('Error getting session:', e)
      sessionError = e
    }

    // Check if essential environment variables are defined
    const envCheck = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }

    // Check DB connection regardless of auth
    let dbStatus = false
    try {
      const { error: dbError } = await supabase.from('models').select('count').limit(1)
      dbStatus = !dbError
    } catch (e) {
      console.error('Error checking DB status:', e)
    }

    // Get LLM provider state if authenticated
    let llmProvider = 'none'
    if (session && !sessionError) {
      try {
        // First check the registry
        const registry = LLMProviderRegistry.getInstance()
        const activeProvider = await registry.getActiveProvider()
        
        if (activeProvider) {
          llmProvider = await activeProvider.getProviderType()
          console.log('Health check: Active provider from registry:', llmProvider)
        } else {
          // Fallback to database check
          const { data, error } = await supabase
            .from('llm_state')
            .select('active_provider')
            .eq('id', 1)
            .single()
          
          if (!error && data?.active_provider) {
            llmProvider = data.active_provider
            console.log('Health check: Active provider from database:', llmProvider)
          }
        }
      } catch (error) {
        console.error('Error checking LLM state:', error)
      }
    }

    // Record performance metrics
    const performanceMonitor = PerformanceMonitor.getInstance()
    const metrics = performanceMonitor.recordMetrics('/api/system/health', startTime)

    // Get API performance stats for critical endpoints
    const criticalEndpoints = [
      '/api/camera-path',
      '/api/system/info',
      '/api/system/health'
    ];

    const apiMetrics = criticalEndpoints
      .map(endpoint => apiPerformance.getEndpointStats(endpoint))
      .filter((stats): stats is EndpointStats => stats !== null);

    // Calculate overall API health
    const apiHealth = apiMetrics.length > 0 ? {
      status: apiMetrics.every(m => m.status === 'good') ? 'good' : 
              apiMetrics.some(m => m.status === 'critical') ? 'critical' : 'warning',
      averageResponseTime: apiMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / apiMetrics.length,
      successRate: apiMetrics.reduce((sum, m) => sum + m.successRate, 0) / apiMetrics.length,
      thresholds: API_THRESHOLDS,
      endpoints: apiMetrics
    } : null;

    // Enhanced health response with auth and LLM state
    const response = NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ready: Object.values(envCheck).every(Boolean),
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
      services: {
        auth: !sessionError && !!session,
        db: dbStatus,
        env: Object.values(envCheck).every(Boolean),
        llm: llmProvider
      },
      performance: {
        responseTime: metrics.responseTime,
        memory: metrics.memory,
        requestRate: metrics.requestRate,
        api: apiHealth
      }
    })

    // Set proper cache control and CORS headers
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response

  } catch (error) {
    console.error('Health check failed:', error)
    const response = NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        ready: false,
        services: {
          auth: false,
          db: false,
          env: false,
          llm: 'none'
        },
        performance: {
          responseTime: Date.now() - startTime
        }
      },
      { status: 500 }
    )

    // Set proper cache control and CORS headers
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    return response
  }
} 