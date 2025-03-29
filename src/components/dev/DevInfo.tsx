'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface Status {
  auth: boolean;
  db: boolean;
  env: boolean;
}

interface LLMInfo {
  activeProvider: {
    type: string;
    capabilities: {
      name: string;
      version: string;
      maxTokens: number;
      supportsJson: boolean;
      temperature: number;
      maxDuration: number;
    };
  } | null;
  availableProviders: string[];
}

interface DevInfo {
  version: string;
  branch: string;
  environment: string;
  status: Status;
  auth: {
    isAuthenticated: boolean;
    user: string | null;
  };
  llm: LLMInfo;
}

// Create a small custom event system for provider changes
export const DevEvents = {
  providerChanged: new Event('llm-provider-changed')
};

export function DevInfo() {
  const [info, setInfo] = useState<DevInfo | null>(null)
  const pathname = usePathname()
  const [error, setError] = useState<boolean>(false)
  const [retryCount, setRetryCount] = useState(0)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0)
  
  // Function to fetch dev info with rate limiting protection
  const fetchDevInfo = () => {
    // Implement rate limiting - only fetch if it's been at least 10 seconds since last fetch
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTimeRef.current
    
    if (timeSinceLastFetch < 10000 && lastFetchTimeRef.current !== 0) {
      console.log('Skipping dev info fetch - too soon since last fetch');
      return;
    }
    
    lastFetchTimeRef.current = now;
    
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    
    // Fetch in both development and production
    fetch('/api/dev-info')
      .then(res => res.json())
      .then(data => {
        setInfo(data);
        setError(false);
        setRetryCount(0);
      })
      .catch(error => {
        console.error('Error fetching dev info:', error);
        setError(true);
        
        // Implement exponential backoff for retries to avoid rate limiting
        const backoffTime = Math.min(30000, 1000 * Math.pow(2, retryCount));
        console.log(`Will retry dev info fetch in ${backoffTime/1000} seconds`);
        
        fetchTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchDevInfo();
        }, backoffTime);
      })
  };

  useEffect(() => {
    // Only fetch on initial component mount
    fetchDevInfo();
    
    // Listen for provider change events
    const handleProviderChange = () => {
      console.log('Provider change detected, refreshing dev info');
      // Fetch when provider is explicitly changed
      fetchDevInfo();
    };
    
    window.addEventListener('llm-provider-changed', handleProviderChange);
    
    // Clean up
    return () => {
      window.removeEventListener('llm-provider-changed', handleProviderChange);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []); // Remove pathname dependency - only fetch on mount

  // Only render if we have info to display and are not in an error state
  if (!info || error) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-green-400">●</span>
          <span>v{info.version}</span>
        </div>
        <div className="text-gray-400">{info.branch}</div>
        <div className="text-gray-400">{info.environment}</div>
        
        {/* Critical Services Health */}
        <div className="flex items-center gap-2">
          <span className={Object.values(info.status).every(Boolean) ? 'text-green-400' : 'text-red-400'}>●</span>
          <span>{Object.values(info.status).every(Boolean) ? 'Services OK' : 'Service Issues'}</span>
        </div>

        {/* Detailed Status */}
        <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
          {/* Critical Services */}
          <div className="flex items-center gap-2">
            <span className={info.status.db ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>DB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={info.status.env ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>ENV</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={info.status.auth ? 'text-green-400' : 'text-red-400'}>●</span>
            <span>Auth</span>
          </div>
        </div>

        {/* LLM Provider */}
        <div className="text-gray-400 mt-1 border-t border-gray-700 pt-1">
          <div className="flex items-center gap-2">
            <span className={info.llm.activeProvider ? 'text-green-400' : 'text-yellow-400'}>●</span>
            <span>LLM: {info.llm.activeProvider?.type || 'None'}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 