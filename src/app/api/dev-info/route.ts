import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createRouteSupabaseClient } from '@/lib/supabase-route'
import { getConfiguredProviders, isProviderConfigured } from '@/lib/llm/config'
import { LLMProviderRegistry } from '@/lib/llm/registry'
import { getGitInfo } from '@/lib/git'
import { cookies } from 'next/headers'
import { ensureLLMSystemInitialized } from '@/lib/llm/init'

// Mark as dynamic route
export const dynamic = 'force-dynamic';

function serializeProvider(provider: any) {
  if (!provider) return null;
  return {
    type: provider.getProviderType(),
    capabilities: provider.getCapabilities()
  };
}

export async function GET() {
  try {
    // Ensure LLM system is initialized
    await ensureLLMSystemInitialized();
    
    // Get git info
    const { version, branch, environment } = await getGitInfo();

    // Get auth status - properly handle cookie access
    const cookieStore = await cookies();
    const supabase = await createRouteSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthenticated = !!session;

    // Get LLM info
    const registry = LLMProviderRegistry.getInstance();
    const activeProvider = await registry.getActiveProvider();
    const configuredProviders = getConfiguredProviders();

    // Check Supabase connection
    let dbStatus = false;
    try {
      const { data, error } = await supabase.from('models').select('count').limit(1);
      dbStatus = !error;
    } catch (e) {
      console.error('Error checking DB status:', e);
    }

    // Check environment variables
    const envStatus = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Check database for provider state even if activeProvider is null
    let activeProviderType = 'none';
    let activeProviderCapabilities = null;
    
    if (activeProvider) {
      try {
        activeProviderType = await activeProvider.getProviderType();
        activeProviderCapabilities = await activeProvider.getCapabilities();
      } catch (error) {
        console.error('Error getting provider details:', error);
      }
    } else {
      // Double-check the database if activeProvider is null
      try {
        const { data, error } = await supabase
          .from('llm_state')
          .select('active_provider')
          .eq('id', 1)
          .single();
          
        if (!error && data?.active_provider) {
          activeProviderType = data.active_provider;
          console.log('Found provider in database but not initialized:', activeProviderType);
        }
      } catch (error) {
        console.error('Error checking database for provider:', error);
      }
    }
    
    // Log provider information in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Active provider:', activeProviderType);
      console.log('Configured providers:', configuredProviders);
    }

    return NextResponse.json({
      version,
      branch,
      environment,
      status: {
        auth: isAuthenticated,
        db: dbStatus,
        env: envStatus
      },
      auth: {
        isAuthenticated,
        user: session?.user?.email || null
      },
      llm: {
        activeProvider: activeProvider ? {
          type: activeProviderType,
          capabilities: activeProviderCapabilities
        } : activeProviderType !== 'none' ? {
          // Return information even if the provider isn't fully initialized
          type: activeProviderType,
          capabilities: null
        } : null,
        availableProviders: configuredProviders
      }
    });
  } catch (error) {
    console.error('Error getting dev info:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get dev info',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }, 
      { status: 500 }
    );
  }
} 