'use client'

import { useEffect, useState } from 'react'
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

  // Function to fetch dev info
  const fetchDevInfo = () => {
    // Only fetch in development
    if (process.env.NODE_ENV === 'development') {
      fetch('/api/dev-info')
        .then(res => res.json())
        .then(data => setInfo(data))
        .catch(error => {
          console.error('Error fetching dev info:', error);
          setInfo(null);
        })
    }
  };

  useEffect(() => {
    // Initial fetch on page load or route change
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
    };
  }, [pathname]);

  // Only render in development
  if (process.env.NODE_ENV !== 'development' || !info) return null

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