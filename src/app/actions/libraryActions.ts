'use server';

import { createServerClient } from '@/lib/supabase-server';
import { Model } from '@/lib/supabase';

// Moved data fetching logic to a server action
export async function getModels(): Promise<Model[]> { // Add return type annotation
  try {
    console.log('Debug: Library Action - Starting getModels');
    const supabase = await createServerClient();
    console.log('Debug: Library Action - Supabase client created');

    // Session check might not be strictly necessary here if middleware handles auth,
    // but keep it for potential debugging/robustness.
    try {
      console.log('Debug: Library Action - Checking session');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Debug: Library Action - Session check complete:', !!session);
    } catch (sessionError) {
      console.error('Warning: Session check failed in action:', sessionError);
    }

    const { data: models, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching models in action:', error);
      throw error;
    }

    console.log('Debug: Library Action - Models fetched successfully');
    return models as Model[];
  } catch (error) {
    console.error('Error in getModels action:', error);
    // Re-throw or return an error structure for the client to handle
    throw new Error('Failed to fetch models'); 
  }
} 