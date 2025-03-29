import { headers } from 'next/headers'

interface PerformanceMetrics {
  timestamp: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  responseTime?: number;
  requestRate?: {
    current: number;
    average: number;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics[]>;
  private requestCounts: Map<string, number>;
  private lastCleanup: number;
  private readonly CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutes
  private readonly MAX_METRICS_PER_ENDPOINT = 100;

  private constructor() {
    this.metrics = new Map();
    this.requestCounts = new Map();
    this.lastCleanup = Date.now();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      for (const [endpoint, metricsList] of this.metrics.entries()) {
        // Keep only the most recent MAX_METRICS_PER_ENDPOINT entries
        if (metricsList.length > this.MAX_METRICS_PER_ENDPOINT) {
          this.metrics.set(endpoint, metricsList.slice(-this.MAX_METRICS_PER_ENDPOINT));
        }
      }
      this.lastCleanup = now;
    }
  }

  public recordMetrics(endpoint: string, startTime: number): PerformanceMetrics {
    const headersList = headers();
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      responseTime: Date.now() - startTime,
    };

    // Add memory usage if available
    if (process.memoryUsage) {
      const memory = process.memoryUsage();
      metrics.memory = {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      };
    }

    // Update request rate
    const currentCount = (this.requestCounts.get(endpoint) || 0) + 1;
    this.requestCounts.set(endpoint, currentCount);

    // Calculate request rate (requests per minute)
    const endpointMetrics = this.metrics.get(endpoint) || [];
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = endpointMetrics.filter(m => m.timestamp > oneMinuteAgo).length;

    metrics.requestRate = {
      current: recentRequests,
      average: endpointMetrics.length > 0 
        ? endpointMetrics.reduce((sum, m) => sum + (m.requestRate?.current || 0), 0) / endpointMetrics.length
        : 0
    };

    // Store metrics
    endpointMetrics.push(metrics);
    this.metrics.set(endpoint, endpointMetrics);

    // Cleanup old metrics if needed
    this.cleanup();

    return metrics;
  }

  public getMetrics(endpoint: string): PerformanceMetrics[] {
    return this.metrics.get(endpoint) || [];
  }

  public getLatestMetrics(endpoint: string): PerformanceMetrics | null {
    const metrics = this.metrics.get(endpoint);
    return metrics ? metrics[metrics.length - 1] : null;
  }

  public getAverageResponseTime(endpoint: string): number {
    const metrics = this.metrics.get(endpoint);
    if (!metrics || metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, curr) => acc + (curr.responseTime || 0), 0);
    return sum / metrics.length;
  }

  public getRequestRate(endpoint: string): number {
    const metrics = this.metrics.get(endpoint);
    if (!metrics || metrics.length === 0) return 0;

    const oneMinuteAgo = Date.now() - 60000;
    return metrics.filter(m => m.timestamp > oneMinuteAgo).length;
  }
} 