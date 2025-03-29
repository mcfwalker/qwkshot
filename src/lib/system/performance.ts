import { NextResponse } from 'next/server'

interface PerformanceMetrics {
  responseTime: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  requestRate?: {
    current: number;
    average: number;
  };
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private requestCounts: Map<string, number> = new Map();
  private lastCleanup: number = Date.now();
  private readonly cleanupInterval = 60000; // 1 minute

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public recordMetrics(endpoint: string, startTime: number): PerformanceMetrics {
    const responseTime = Date.now() - startTime;
    
    // Update request count
    const currentCount = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, currentCount + 1);
    
    // Clean up old counts periodically
    this.cleanupOldCounts();

    // Get memory metrics if available
    let memory;
    try {
      // Check if we're in a Node.js environment with memory usage API
      if (typeof process !== 'undefined' && 
          process.memoryUsage && 
          typeof process.memoryUsage === 'function') {
        const memUsage = process.memoryUsage();
        memory = {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        };
      }
    } catch (e) {
      // Memory usage not available (e.g., in Edge Runtime)
      console.debug('Memory usage metrics not available:', e instanceof Error ? e.message : String(e));
    }

    return {
      responseTime,
      memory,
      requestRate: {
        current: this.getRequestRate(endpoint),
        average: this.getAverageRequestRate(endpoint)
      }
    };
  }

  private cleanupOldCounts() {
    const now = Date.now();
    if (now - this.lastCleanup >= this.cleanupInterval) {
      this.requestCounts.clear();
      this.lastCleanup = now;
    }
  }

  private getRequestRate(endpoint: string): number {
    return this.requestCounts.get(endpoint) || 0;
  }

  private getAverageRequestRate(endpoint: string): number {
    const count = this.requestCounts.get(endpoint) || 0;
    const timeWindow = (Date.now() - this.lastCleanup) / 1000; // Convert to seconds
    return timeWindow > 0 ? count / (timeWindow / 60) : 0; // Convert to requests per minute
  }
}

export { PerformanceMonitor, type PerformanceMetrics }; 