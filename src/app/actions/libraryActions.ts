'use server';

import { createServerClient } from '@/lib/supabase-server';
import { Model } from '@/lib/supabase';

// Moved data fetching logic to a server action
export async function getModels(): Promise<Model[]> {
  try {
    const supabase = await createServerClient();

    const { data: models, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return models as Model[];
  } catch (error) {
    // Re-throw for the client to handle
    throw new Error('Failed to fetch models'); 
  }
} 