import { NextResponse } from 'next/server'
import { PerformanceMonitor } from '@/lib/system/performance'
import { apiPerformance, API_THRESHOLDS } from '@/lib/monitoring/api-performance'

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

    // Basic health response
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ready: Object.values(envCheck).every(Boolean),
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
      performance: {
        responseTime: metrics.responseTime,
        memory: metrics.memory,
        requestRate: metrics.requestRate,
        api: apiHealth
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        ready: false,
        performance: {
          responseTime: Date.now() - startTime
        }
      },
      { status: 500 }
    )
  }
} 