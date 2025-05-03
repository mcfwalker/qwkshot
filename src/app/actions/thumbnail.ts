'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface UpdateThumbnailArgs {
  modelId: string;
  thumbnailUrl: string;
}

interface UpdateThumbnailResult {
  success: boolean;
  error?: string;
}

/**
 * Server action to update the thumbnail URL for a model
 * This is called after the thumbnail image has been uploaded to storage
 */
export async function updateThumbnailUrlAction(
  args: UpdateThumbnailArgs
): Promise<UpdateThumbnailResult> {
  const { modelId, thumbnailUrl } = args;
  
  if (!modelId || !thumbnailUrl) {
    return { 
      success: false, 
      error: 'Missing modelId or thumbnailUrl' 
    };
  }

  try {
    const supabase = createServerActionClient({ cookies });
    
    // Verify the user is authenticated and has access to this model
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { 
        success: false, 
        error: 'Not authenticated' 
      };
    }
    
    // Check if the model exists and belongs to the current user
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('user_id')
      .eq('id', modelId)
      .single();
      
    if (modelError || !model) {
      return { 
        success: false, 
        error: 'Model not found' 
      };
    }
    
    if (model.user_id !== session.user.id) {
      return { 
        success: false, 
        error: 'Not authorized to update this model' 
      };
    }
    
    // Update the thumbnail URL in the database
    const { error: updateError } = await supabase
      .from('models')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', modelId);
      
    if (updateError) {
      return { 
        success: false, 
        error: `Database update failed: ${updateError.message}` 
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in updateThumbnailUrlAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update thumbnail URL' 
    };
  }
} 