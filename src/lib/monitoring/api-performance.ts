import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PerformanceMonitor } from '../system/performance'

// Use a global object that's Edge-compatible
const globalMetrics: {
  [key: string]: {
    times: number[];
    successes: number;
    failures: number;
    lastResponseTime: number;
    lastUpdate: number;
  }
} = {};

export const API_THRESHOLDS = {
  good: 500, // ms
  warning: 1000, // ms
  critical: 2000 // ms
};

interface EndpointStats {
  endpoint: string;
  averageResponseTime: number;
  lastResponseTime: number;
  status: 'good' | 'warning' | 'critical';
  recentRequests: number;
  successRate: number;
}

class APIPerformanceMonitor {
  private readonly maxSamples = 100;
  private readonly recentWindow = 5 * 60 * 1000; // 5 minutes

  recordRequest(endpoint: string, responseTime: number, success: boolean) {
    console.log('APIPerformanceMonitor.recordRequest:', { endpoint, responseTime, success });
    const now = Date.now();

    // Initialize or get existing metrics
    if (!globalMetrics[endpoint]) {
      globalMetrics[endpoint] = {
        times: [],
        successes: 0,
        failures: 0,
        lastResponseTime: 0,
        lastUpdate: now
      };
    }

    const metrics = globalMetrics[endpoint];

    // Clean up old data
    metrics.times = metrics.times
      .filter(t => (now - t) <= this.recentWindow)
      .slice(-this.maxSamples);

    // Add new data
    metrics.times.push(responseTime);
    metrics.lastResponseTime = responseTime;
    metrics.lastUpdate = now;
    
    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }

    console.log('Updated metrics for endpoint:', endpoint, metrics);
  }

  getEndpointStats(endpoint: string): EndpointStats | null {
    const metrics = globalMetrics[endpoint];
    console.log('Getting stats for endpoint:', endpoint, metrics);
    
    if (!metrics || metrics.times.length === 0) {
      return null;
    }

    // Clean up old data before calculating stats
    const now = Date.now();
    metrics.times = metrics.times.filter(t => (now - t) <= this.recentWindow);

    if (metrics.times.length === 0) {
      return null;
    }

    const averageResponseTime = metrics.times.reduce((a, b) => a + b, 0) / metrics.times.length;
    const totalRequests = metrics.successes + metrics.failures;
    const successRate = totalRequests > 0 ? metrics.successes / totalRequests : 1;

    const stats = {
      endpoint,
      averageResponseTime,
      lastResponseTime: metrics.lastResponseTime,
      status: this.getStatus(averageResponseTime),
      recentRequests: metrics.times.length,
      successRate
    };
    
    console.log('Calculated stats:', stats);
    return stats;
  }

  private getStatus(responseTime: number): 'good' | 'warning' | 'critical' {
    if (responseTime <= API_THRESHOLDS.good) return 'good';
    if (responseTime <= API_THRESHOLDS.warning) return 'warning';
    return 'critical';
  }
}

export async function withPerformanceMonitoring(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const endpoint = url.pathname;

  try {
    // Execute the original handler
    const response = await handler();
    
    // Record timing metric
    const duration = Date.now() - startTime;
    
    // Add metric to both monitors
    new APIPerformanceMonitor().recordRequest(endpoint, duration, response.status < 400);

    PerformanceMonitor.getInstance().recordMetrics(endpoint, startTime);

    // Add timing headers to response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Server-Timing', `total;dur=${duration}`);
    
    // Return response with timing headers
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

  } catch (error) {
    // Record error metric
    const duration = Date.now() - startTime;
    new APIPerformanceMonitor().recordRequest(endpoint, duration, false);

    throw error;
  }
}

// Export singleton instance
export const apiPerformance = new APIPerformanceMonitor(); 