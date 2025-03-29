'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { ProviderType } from '@/lib/llm/types';
import { Database } from '@/types/supabase';
import { DevEvents } from '@/components/dev/DevInfo/index';
import { toast } from 'sonner';

interface DevInfo {
  version: string;
  branch: string;
  environment: string;
  status: {
    auth: boolean;
    db: boolean;
    env: boolean;
  };
  auth: {
    isAuthenticated: boolean;
    user: string | null;
  };
  llm: {
    activeProvider: {
      type: string;
      capabilities?: {
        name: string;
        version: string;
        maxTokens: number;
        supportsJson: boolean;
        temperature: number;
        maxDuration: number;
      };
    } | null;
    availableProviders: string[];
  };
}

export default function AdminPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Environment: {process.env.NODE_ENV}
        </div>
      </div>
      <AdminProviderManagement />
    </div>
  );
}

function AdminProviderManagement() {
  const [devInfo, setDevInfo] = useState<DevInfo | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
          router.push('/auth/sign-in');
          return;
        }
        fetchDevInfo();
      } catch (error) {
        console.error('Error checking auth:', error);
        setError('Authentication error. Please try signing in again.');
        router.push('/auth/sign-in');
      }
    };
    checkAuth();
  }, [router, supabase]);

  const fetchDevInfo = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Get the session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/sign-in');
        return;
      }

      // Fetch system info with auth
      const response = await fetch('/api/system/info', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.status === 401) {
        router.push('/auth/sign-in');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch provider information: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received system info:', data); // Debug log
      
      if (!data.auth.isAuthenticated) {
        throw new Error('Not authenticated');
      }
      
      setDevInfo(data);
      setSelectedProvider(data.llm.activeProvider?.type || null);
    } catch (error) {
      console.error('Error fetching system info:', error);
      setError('Failed to load provider information. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = async (provider: ProviderType) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Get the session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/sign-in');
        return;
      }
      
      const response = await fetch('/api/llm/switch-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to switch provider');
      }

      // Dispatch an event to notify other components about the provider change
      window.dispatchEvent(DevEvents.providerChanged);

      // Show success message
      toast.success(`Switched to ${provider} provider successfully`);

      // Refresh the page data
      await fetchDevInfo();
      
    } catch (error) {
      console.error('Error switching provider:', error);
      setError(error instanceof Error ? error.message : 'Failed to switch provider');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">LLM Provider Management</h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Provider Status Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Provider Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OpenAI Card */}
              <div className={`relative rounded-lg border ${
                devInfo?.llm.availableProviders.includes('openai')
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              } p-5`}>
                <div className="flex justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">OpenAI</h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {devInfo?.llm.availableProviders.includes('openai') ? 'Active and configured' : 'Not configured'}
                    </p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    devInfo?.llm.availableProviders.includes('openai') ? 'bg-green-400' : 'bg-gray-300'
                  }`} />
                </div>
                {devInfo?.llm.activeProvider?.type === 'openai' && (
                  <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
              </div>

              {/* Gemini Card */}
              <div className={`relative rounded-lg border ${
                devInfo?.llm.availableProviders.includes('gemini')
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              } p-5`}>
                <div className="flex justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Gemini</h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {devInfo?.llm.availableProviders.includes('gemini') ? 'Active and configured' : 'Not configured'}
                    </p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    devInfo?.llm.availableProviders.includes('gemini') ? 'bg-green-400' : 'bg-gray-300'
                  }`} />
                </div>
                {devInfo?.llm.activeProvider?.type === 'gemini' && (
                  <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Current
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Provider Selection Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Switch Provider</h3>
            <div className="flex items-center gap-4">
              <select
                value={selectedProvider || ''}
                onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                className="block w-full md:w-64 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="">Select a provider</option>
                {devInfo?.llm.availableProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">
                {selectedProvider
                  ? `Currently using ${selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}`
                  : 'No provider selected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 