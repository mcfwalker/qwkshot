'use client'

import { useEffect, useState, useRef } from 'react'
import type { HealthCheckResponse, SystemInfoResponse } from '@/lib/system/types'
import type { Database } from '@/types/supabase'
import { getSupabaseClient } from '@/lib/supabase'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// Get the base URL for API requests
const getApiBaseUrl = () => {
  // In development or if we're on the server, use relative paths
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
    return ''
  }
  
  // In production on the client, use the current origin
  return window.location.origin
}

export function DevInfo() {
  const [state, setState] = useState<DevInfoState>({
    health: null,
    info: null,
    error: false,
    isLoading: true
  })
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  const supabase = getSupabaseClient()
  
  // Function to fetch health status
  const fetchHealth = async () => {
    try {
      // Get session without throwing
      let session = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data.session
      } catch (e) {
        console.error('Error getting session:', e)
      }
      
      // Get the base URL at request time to ensure we're on the client
      const baseUrl = getApiBaseUrl()
      
      const res = await fetch(`${baseUrl}/api/system/health`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
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
      // Get session without throwing
      let session = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data.session
      } catch (e) {
        console.error('Error getting session:', e)
      }
      
      // Get the base URL at request time to ensure we're on the client
      const baseUrl = getApiBaseUrl()
      
      const res = await fetch(`${baseUrl}/api/system/info`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Accept': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
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
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)
      if (['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'].includes(event)) {
        console.log('Refreshing health panel due to auth change')
        fetchData()
      }
    })
    
    window.addEventListener('provider-changed', handleProviderChange)
    
    return () => {
      window.removeEventListener('provider-changed', handleProviderChange)
      subscription.unsubscribe()
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])

  // Basic panel when loading or error (also include toggle)
  if (state.isLoading || (!state.health && !state.info)) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono max-w-xs">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">●</span>
            <span>System Info Unavailable</span>
          </div>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-white/10 rounded">
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-gray-700">
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
        )}
      </div>
    )
  }

  // Show health information
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono max-w-xs">
      <div className="flex justify-between items-center">
        {state.health && (
          <div className="flex items-center gap-2">
            <span className={state.health.status === 'ok' ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>vdevelopment</span>
          </div>
        )}
        {!state.health && <div className="flex items-center gap-2"><span className="text-gray-400">●</span><span>System Status</span></div>}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 hover:bg-white/10 rounded">
          {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!isCollapsed && state.health && (
        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-gray-700">
          <div className="text-gray-400">{state.health.environment}</div>
          
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
            </div>
          )}

          {state.health.services && (
            <>
              <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
                <div className="flex items-center gap-2">
                  <span className={
                    Object.values(state.health.services).every(val => 
                      val === true || (typeof val === 'string' && val !== 'none')
                    ) 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }>●</span>
                  <span>
                    {Object.values(state.health.services).every(val => 
                      val === true || (typeof val === 'string' && val !== 'none')
                    )
                      ? 'Services OK' 
                      : 'Service Issues'
                    }
                  </span>
                </div>
              </div>

              <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
                <div className="flex items-center gap-2">
                  <span className={state.health.services.db ? 'text-green-400' : 'text-red-400'}>●</span>
                  <span>DB</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={state.health.services.env ? 'text-green-400' : 'text-red-400'}>●</span>
                  <span>ENV</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={state.health.services.auth ? 'text-green-400' : 'text-red-400'}>●</span>
                  <span>Auth</span>
                </div>
              </div>

              <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
                <div className="flex items-center gap-2">
                  <span className={state.health.services.llm !== 'none' ? 'text-green-400' : 'text-yellow-400'}>●</span>
                  <span>LLM: {state.health.services.llm}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
} 