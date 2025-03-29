'use client'

import { useEffect, useState, useRef } from 'react'
import type { HealthCheckResponse, SystemInfoResponse } from '@/lib/system/types'

interface DevInfoState {
  health: HealthCheckResponse | null;
  info: SystemInfoResponse | null;
  error: boolean;
  isLoading: boolean;
}

// Create a small custom event system for provider changes
export const DevEvents = {
  providerChanged: new Event('provider-changed')
};

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

function formatResponseTime(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms/1000).toFixed(1)}s`;
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getStatusColor(status: 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'good':
      return 'text-green-400';
    case 'warning':
      return 'text-yellow-400';
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function DevInfo() {
  const [state, setState] = useState<DevInfoState>({
    health: null,
    info: null,
    error: false,
    isLoading: true
  })
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  
  // Function to fetch health status
  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/system/health', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        console.error('DevInfo: Health check failed:', res.status, res.statusText);
        throw new Error('Health check failed');
      }
      
      const data = await res.json();
      console.log('DevInfo received health data:', data); // Debug log
      setState(prev => ({ ...prev, health: data }));
    } catch (error) {
      console.error('Error fetching health status:', error);
      setState(prev => ({ ...prev, error: true }));
    }
  }

  // Function to fetch system info if authenticated
  const fetchInfo = async () => {
    try {
      // Get the auth cookie
      const res = await fetch('/api/system/info', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json'
        }
      });
      
      if (res.status === 401) {
        // Not authenticated - this is okay, just don't show the info
        console.log('DevInfo: Not authenticated');
        return;
      }
      
      if (!res.ok) {
        console.error('DevInfo: Failed to fetch system info:', res.status, res.statusText);
        throw new Error('Failed to fetch system info');
      }
      
      const data = await res.json();
      console.log('DevInfo received system info:', data); // Debug log
      setState(prev => ({ ...prev, info: data }));
    } catch (error) {
      console.error('Error fetching system info:', error);
      // Don't set error state here as this is optional
    }
  }

  // Combined fetch function with rate limiting and retry
  const fetchData = async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    if (timeSinceLastFetch < 10000 && lastFetchTimeRef.current !== 0) {
      return;
    }
    
    lastFetchTimeRef.current = now;
    
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Fetch data with retry
      const retryFetch = async (fn: () => Promise<void>, retries = 3) => {
        try {
          await fn();
        } catch (error) {
          if (retries > 0) {
            console.log(`DevInfo: Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await retryFetch(fn, retries - 1);
          } else {
            throw error;
          }
        }
      };

      await Promise.all([
        retryFetch(fetchHealth),
        retryFetch(fetchInfo)
      ]);
      
      setState(prev => ({ ...prev, error: false }));
    } catch (error) {
      console.error('Error fetching data:', error);
      setState(prev => ({ ...prev, error: true }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchData()
    
    // Listen for provider changes
    const handleProviderChange = () => {
      console.log('Provider change detected, refreshing data')
      fetchData()
    }
    
    window.addEventListener('provider-changed', handleProviderChange)
    
    return () => {
      window.removeEventListener('provider-changed', handleProviderChange)
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])

  // Basic panel when loading or error
  if (state.isLoading || (!state.health && !state.info)) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span>System Info Unavailable</span>
          </div>
          <div className="text-gray-400">
            {state.isLoading ? 'Loading...' : 'Unable to fetch system status'}
          </div>
          {state.error && (
            <div className="flex items-center gap-2">
              <span className="text-red-400">●</span>
              <span>Error</span>
            </div>
          )}
          <button 
            onClick={fetchData}
            className="mt-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show health information
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono">
      <div className="flex flex-col gap-1">
        {/* Version Info */}
        {state.health && (
          <>
            <div className="flex items-center gap-2">
              <span className={state.health.status === 'ok' ? 'text-green-400' : 'text-red-400'}>●</span>
              <span>v{state.health.version}</span>
            </div>
            <div className="text-gray-400">{state.health.environment}</div>
            
            {/* Performance Metrics */}
            {state.health.performance && (
              <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">●</span>
                  <span>Response: {formatResponseTime(state.health.performance.responseTime)}</span>
                </div>
                {state.health.performance.memory && (
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">●</span>
                    <span>Memory: {formatBytes(state.health.performance.memory.heapUsed)}</span>
                  </div>
                )}
                {state.health.performance.requestRate && (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">●</span>
                    <span>Requests/min: {state.health.performance.requestRate.current}</span>
                  </div>
                )}
                
                {/* API Performance Section */}
                {state.health.performance.api && (
                  <div className="mt-1 border-t border-gray-700 pt-1">
                    <div className="flex items-center gap-2">
                      <span className={getStatusColor(state.health.performance.api.status)}>●</span>
                      <span>API Health</span>
                      <span className="text-xs text-gray-500">
                        ({formatResponseTime(state.health.performance.api.averageResponseTime)} avg)
                      </span>
                    </div>
                    
                    {/* Endpoint Details */}
                    <div className="ml-4 mt-1">
                      {state.health.performance.api.endpoints.map((endpoint) => (
                        <div key={endpoint.endpoint} className="flex flex-col gap-0.5 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={getStatusColor(endpoint.status)}>●</span>
                            <span className="text-gray-300">{endpoint.endpoint}</span>
                          </div>
                          <div className="ml-4 text-xs text-gray-500">
                            <div>Last: {formatResponseTime(endpoint.lastResponseTime)}</div>
                            <div>Success: {formatPercentage(endpoint.successRate)}</div>
                            <div>Requests: {endpoint.recentRequests}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {/* System Info when authenticated */}
        {state.info && (
          <>
            <div className="text-gray-400">{state.info.branch}</div>
            
            {/* Critical Services Health */}
            <div className="flex items-center gap-2">
              <span className={Object.values(state.info.status).every(Boolean) ? 'text-green-400' : 'text-red-400'}>●</span>
              <span>{Object.values(state.info.status).every(Boolean) ? 'Services OK' : 'Service Issues'}</span>
            </div>

            {/* Detailed Status */}
            <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
              <div className="flex items-center gap-2">
                <span className={state.info.status.db ? 'text-green-400' : 'text-red-400'}>●</span>
                <span>DB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={state.info.status.env ? 'text-green-400' : 'text-red-400'}>●</span>
                <span>ENV</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={state.info.status.auth ? 'text-green-400' : 'text-red-400'}>●</span>
                <span>Auth</span>
              </div>
            </div>

            {/* LLM Provider */}
            <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
              <div className="flex items-center gap-2">
                <span className={state.info.llm.activeProvider ? 'text-green-400' : 'text-yellow-400'}>●</span>
                <span>LLM: {state.info.llm.activeProvider?.type || 'None'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
} 