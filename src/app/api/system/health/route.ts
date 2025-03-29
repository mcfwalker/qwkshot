import { NextResponse } from 'next/server'
import { PerformanceMonitor } from '@/lib/system/performance'
import { apiPerformance, API_THRESHOLDS } from '@/lib/monitoring/api-performance'
import { createRouteSupabaseClient } from '@/lib/supabase-route'
import { LLMProviderRegistry } from '@/lib/llm/registry'

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

// Basic health check that doesn't require authentication
export async function GET() {
  const startTime = Date.now()
  
  try {
    // Check if essential environment variables are defined
    const envCheck = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }

    // Initialize Supabase client and get session
    const supabase = await createRouteSupabaseClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Check DB connection
    let dbStatus = false
    try {
      const { error: dbError } = await supabase.from('models').select('count').limit(1)
      dbStatus = !dbError
    } catch (e) {
      console.error('Error checking DB status:', e)
    }

    // Get LLM provider state
    let llmProvider = 'none'
    if (session && !sessionError) {
      try {
        const { data, error } = await supabase
          .from('llm_state')
          .select('active_provider')
          .eq('id', 1)
          .single()
        
        if (!error && data?.active_provider) {
          llmProvider = data.active_provider
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
    return NextResponse.json({
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
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
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