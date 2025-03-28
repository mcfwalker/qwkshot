import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase-route';
import { ProviderType } from '@/lib/llm/types';
import { LLMProviderRegistry } from '@/lib/llm/registry';
import { getProviderConfig, isProviderConfigured } from '@/lib/llm/config';

// Mark as dynamic route with increased timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Increase timeout to 30 seconds

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createRouteSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('Unauthorized access attempt to switch provider');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get provider from request body
    const { provider } = await request.json() as { provider: ProviderType };
    
    if (!provider) {
      console.error('No provider specified in request');
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider)) {
      console.error(`Provider ${provider} is not configured`);
      return NextResponse.json({ 
        error: `Provider ${provider} is not properly configured. Please check your environment variables.` 
      }, { status: 400 });
    }

    try {
      // First update the persisted state in Supabase
      console.log('Attempting to update provider in Supabase to:', provider);
      const { error: updateError } = await supabase
        .from('llm_state')
        .update({ active_provider: provider })
        .eq('id', 1);

      if (updateError) {
        console.error('Error updating provider state:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update provider state'
        }, { status: 500 });
      }
      console.log('Successfully updated provider in Supabase');

      // Then initialize the provider in memory
      const registry = LLMProviderRegistry.getInstance();
      console.log('Initializing provider in registry');
      await registry.initializeProvider(provider);

      console.log(`Successfully switched to ${provider} provider`);
      return NextResponse.json({ 
        success: true, 
        message: `Switched to ${provider} provider`,
        provider 
      });
    } catch (configError) {
      console.error('Error configuring provider:', configError);
      return NextResponse.json({ 
        error: configError instanceof Error 
          ? configError.message 
          : `Failed to configure ${provider} provider. Please check your environment variables.`
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in switch-provider route:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to switch provider. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
} 