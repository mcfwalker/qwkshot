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
    // Fix: Create client with awaited cookies
    const cookieStore = cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore });
    
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
  base64Image: string,
  modelName?: string
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
    
    console.log('uploadThumbnailAction: Starting upload process for model ID:', modelId);
    if (modelName) {
      console.log('uploadThumbnailAction: Using provided model name:', modelName);
    }
    
    // Fix: Create client with awaited cookies
    const cookieStore = cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore });
    
    // Verify the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('uploadThumbnailAction: No authenticated session found');
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('uploadThumbnailAction: User authenticated:', session.user.id);
    
    // Get model data if needed
    let model: { user_id: string; thumbnail_url?: string; name?: string } | null = null;
    let modelNameToUse = modelName;
    
    // Verify the user has access to this model and get model data if name not provided
    const { data: modelData, error: modelError } = await supabase
      .from('models')
      .select('user_id, thumbnail_url, name')
      .eq('id', modelId)
      .single();
      
    if (modelError || !modelData) {
      console.error('uploadThumbnailAction: Error fetching model:', modelError);
      return { success: false, error: 'Model not found' };
    }
    
    if (modelData.user_id !== session.user.id) {
      console.error('uploadThumbnailAction: User not authorized:', session.user.id, 'vs', modelData.user_id);
      return { success: false, error: 'Not authorized to update this model' };
    }
    
    model = modelData;
    
    // Use provided name or fallback to DB name
    if (!modelNameToUse && model.name) {
      modelNameToUse = model.name;
      console.log('uploadThumbnailAction: Using model name from DB:', modelNameToUse);
    }
    
    console.log('uploadThumbnailAction: Model found and user authorized');
    
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
          console.log('uploadThumbnailAction: Deleting old thumbnail:', oldPath);
          
          await serviceRoleClient.storage
            .from('thumbnails')
            .remove([oldPath]);
        }
      } catch (cleanupError) {
        // Log but don't fail if cleanup has issues
        console.warn('uploadThumbnailAction: Error cleaning up old thumbnail:', cleanupError);
      }
    }
    
    // Convert base64 to binary data using server-side method
    const imageData = base64ToUint8Array(base64Image);
    
    // Get the model name for the filename
    const finalModelName = modelNameToUse || model.name || 'model';
    
    // Sanitize the model name for use in a filename (remove special chars)
    const safeModelName = finalModelName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    
    // Use timestamp to ensure uniqueness
    const timestamp = Date.now();
    
    // Upload the thumbnail to the storage bucket using service role
    // Store in a user-specific folder with model name (userId/modelName-modelId-timestamp.png)
    const userId = session.user.id;
    const filePath = `${userId}/${safeModelName}-${modelId.substring(0,8)}-${timestamp}.png`;
    
    console.log('uploadThumbnailAction: Uploading thumbnail with service role to:', filePath);
    
    const { data: uploadData, error: uploadError } = await serviceRoleClient.storage
      .from('thumbnails')
      .upload(filePath, imageData, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('uploadThumbnailAction: Upload error details:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }
    
    console.log('uploadThumbnailAction: Upload successful, getting public URL');
    
    // Get the public URL of the uploaded thumbnail
    const { data: publicUrlData } = serviceRoleClient.storage
      .from('thumbnails')
      .getPublicUrl(filePath);
    
    const thumbnailUrl = publicUrlData.publicUrl;
    console.log('uploadThumbnailAction: Public URL generated:', thumbnailUrl);
    
    // Update the model record with the thumbnail URL using the regular client
    console.log('uploadThumbnailAction: Updating model record in database');
    const { error: updateError } = await supabase
      .from('models')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', modelId);
    
    if (updateError) {
      console.error('uploadThumbnailAction: Database update error:', updateError);
      return { success: false, error: `Failed to update model: ${updateError.message}` };
    }
    
    // Add a cache-busting parameter to the URL to force refresh in the UI
    const cacheBustedUrl = `${thumbnailUrl}?t=${Date.now()}`;
    console.log('uploadThumbnailAction: Success! URL with cache busting:', cacheBustedUrl);
    
    return { success: true, url: cacheBustedUrl };
  } catch (error) {
    console.error('Error in uploadThumbnailAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 