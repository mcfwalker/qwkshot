'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

interface UpdateThumbnailArgs {
  modelId: string;
  thumbnailUrl: string;
}

interface UpdateThumbnailResult {
  success: boolean;
  error?: string;
}

// Function to convert base64 to Uint8Array on the server
function base64ToUint8Array(base64String: string) {
  // Remove data URL prefix if present
  const base64 = base64String.split(',')[1] || base64String;
  // Node.js Buffer method for server-side
  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
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

/**
 * Server action to upload thumbnail image using service role
 * This bypasses RLS since it runs server-side with elevated privileges
 */
export async function uploadThumbnailAction(
  modelId: string,
  base64Image: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Verify modelId is provided
    if (!modelId) {
      return { success: false, error: 'Model ID is required' };
    }
    
    // Verify base64Image is provided and valid
    if (!base64Image || !base64Image.startsWith('data:image/')) {
      return { success: false, error: 'Valid image data is required' };
    }
    
    // Create regular Supabase client for user session checks
    const supabase = createServerActionClient({ cookies });
    
    // Verify the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Verify the user has access to this model
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('user_id, thumbnail_url')
      .eq('id', modelId)
      .single();
      
    if (modelError || !model) {
      return { success: false, error: 'Model not found' };
    }
    
    if (model.user_id !== session.user.id) {
      return { success: false, error: 'Not authorized to update this model' };
    }
    
    // Create a Supabase client with service role for storage operations
    // This bypasses RLS policies
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: { persistSession: false }
      }
    );

    // Clean up old thumbnail if it exists
    if (model.thumbnail_url) {
      try {
        // Extract path from old thumbnail URL
        const url = new URL(model.thumbnail_url);
        const pathMatch = url.pathname.match(/\/thumbnails\/([^?]+)/);
        
        if (pathMatch && pathMatch[1]) {
          const oldPath = decodeURIComponent(pathMatch[1]);
          console.log('Deleting old thumbnail:', oldPath);
          
          await serviceRoleClient.storage
            .from('thumbnails')
            .remove([oldPath]);
        }
      } catch (cleanupError) {
        // Log but don't fail if cleanup has issues
        console.warn('Error cleaning up old thumbnail:', cleanupError);
      }
    }
    
    // Convert base64 to binary data using server-side method
    const imageData = base64ToUint8Array(base64Image);
    
    // Upload the thumbnail to the storage bucket using service role
    // Store in a user-specific folder for organization (userId/modelId.png)
    const userId = session.user.id;
    const filePath = `${userId}/${modelId}.png`;
    
    console.log('Uploading thumbnail with service role to:', filePath);
    
    const { data: uploadData, error: uploadError } = await serviceRoleClient.storage
      .from('thumbnails')
      .upload(filePath, imageData, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Upload error details:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }
    
    // Get the public URL of the uploaded thumbnail
    const { data: publicUrlData } = serviceRoleClient.storage
      .from('thumbnails')
      .getPublicUrl(filePath);
    
    const thumbnailUrl = publicUrlData.publicUrl;
    
    // Update the model record with the thumbnail URL using the regular client
    const { error: updateError } = await supabase
      .from('models')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', modelId);
    
    if (updateError) {
      return { success: false, error: `Failed to update model: ${updateError.message}` };
    }
    
    return { success: true, url: thumbnailUrl };
  } catch (error) {
    console.error('Error in uploadThumbnailAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 