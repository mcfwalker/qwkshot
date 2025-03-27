'use client'

import { supabase } from './supabase'
import { FloorTexture } from './supabase'
import { withRetry } from './retry-utils'
import { toast } from 'sonner'

const MAX_TEXTURE_SIZE = 512 * 1024 // 512KB
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DIMENSIONS = 512 // 512x512 pixels

// Helper to check image dimensions
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export async function validateTexture(file: File) {
  // Check file size
  if (file.size > MAX_TEXTURE_SIZE) {
    throw new Error(`Texture must be under ${MAX_TEXTURE_SIZE / 1024}KB`)
  }

  // Check file format
  if (!ALLOWED_FORMATS.includes(file.type)) {
    throw new Error(`Texture must be one of: ${ALLOWED_FORMATS.map(f => f.split('/')[1]).join(', ')}`)
  }

  // Check dimensions
  const dimensions = await getImageDimensions(file)
  if (dimensions.width > MAX_DIMENSIONS || dimensions.height > MAX_DIMENSIONS) {
    throw new Error(`Texture dimensions must be ${MAX_DIMENSIONS}x${MAX_DIMENSIONS} or smaller`)
  }
}

export async function uploadTexture(file: File, metadata: { name: string; description?: string }): Promise<FloorTexture> {
  try {
    // Validate the texture
    await validateTexture(file)
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw new Error(`Auth error: ${userError.message}`)
    if (!user) throw new Error('No authenticated user')
    
    const timestamp = Date.now()
    // Use consistent path structure
    const texturePath = `${metadata.name}-${timestamp}`
    const thumbnailPath = `thumbnails/${metadata.name}-${timestamp}`
    
    // Upload the texture file
    const { data: textureData, error: textureError } = await supabase.storage
      .from('floor-textures')
      .upload(texturePath, file)
    
    if (textureError) throw new Error(`Storage upload failed: ${textureError.message}`)

    // For now, use the same file as thumbnail
    const { error: thumbnailError } = await supabase.storage
      .from('floor-textures')
      .copy(texturePath, thumbnailPath)

    if (thumbnailError) {
      console.warn('Thumbnail creation failed, using main image:', thumbnailError);
      // If thumbnail fails, use the main image URL
    }

    // Create the texture record
    const textureRecord = {
      name: metadata.name,
      description: metadata.description,
      file_url: texturePath,
      thumbnail_url: thumbnailError ? texturePath : thumbnailPath, // Use main image if thumbnail fails
      user_id: user.id
    }

    const { data, error } = await supabase
      .from('floor_textures')
      .insert(textureRecord)
      .select()
      .single()

    if (error) {
      // Clean up uploaded files if database insert fails
      const filesToRemove = [texturePath];
      if (!thumbnailError) filesToRemove.push(thumbnailPath);
      await supabase.storage.from('floor-textures').remove(filesToRemove);
      throw new Error(`Database insert failed: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Error uploading texture:', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
}

export async function getTextures(): Promise<FloorTexture[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('floor_textures')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching textures:', error);
      throw new Error(error.message || 'Failed to load textures');
    }

    // Create signed URLs for all textures
    const texturesWithUrls = await Promise.all((data || []).map(async (texture) => {
      try {
        // Get signed URL for main texture
        const { data: fileData } = await supabase.storage
          .from('floor-textures')
          .createSignedUrl(texture.file_url, 3600);

        // Get signed URL for thumbnail if it exists and is different from main texture
        let thumbnailUrl = fileData?.signedUrl;
        if (texture.thumbnail_url && texture.thumbnail_url !== texture.file_url) {
          const { data: thumbData } = await supabase.storage
            .from('floor-textures')
            .createSignedUrl(texture.thumbnail_url, 3600);
          if (thumbData?.signedUrl) {
            thumbnailUrl = thumbData.signedUrl;
          }
        }

        return {
          ...texture,
          file_url: fileData?.signedUrl || '',
          thumbnail_url: thumbnailUrl || ''
        };
      } catch (error) {
        console.error(`Error processing texture ${texture.id}:`, error);
        return null;
      }
    }));

    // Filter out any textures that failed to process
    return texturesWithUrls.filter((t): t is FloorTexture => t !== null);
  }, {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      toast.error(`Loading textures failed (attempt ${attempt}/3)`, {
        description: error.message
      })
    }
  })
}

export async function loadTexture(textureId: string): Promise<string> {
  return withRetry(async () => {
    // Get the texture details
    const { data: texture, error: textureError } = await supabase
      .from('floor_textures')
      .select('file_url')
      .eq('id', textureId)
      .single()

    if (textureError || !texture) {
      console.error('Error finding texture:', textureError);
      throw new Error(textureError?.message || 'Failed to find texture');
    }

    // Get a signed URL for the texture file
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('floor-textures')
      .createSignedUrl(texture.file_url, 3600) // 1 hour expiration

    if (urlError || !urlData?.signedUrl) {
      console.error('Error getting signed URL:', urlError);
      throw new Error(urlError?.message || 'Failed to get texture URL');
    }

    return urlData.signedUrl
  }, {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      toast.error(`Loading texture failed (attempt ${attempt}/3)`, {
        description: error.message
      })
    }
  })
}

export async function deleteTexture(id: string) {
  try {
    // Get the texture to get the file paths
    const { data: texture, error: getError } = await supabase
      .from('floor_textures')  // Changed from 'textures' to 'floor_textures'
      .select('file_url, thumbnail_url')
      .eq('id', id)
      .single()

    if (getError) throw getError

    // Delete the files from storage
    const filesToRemove = [texture.file_url];
    if (texture.thumbnail_url && texture.thumbnail_url !== texture.file_url) {
      filesToRemove.push(texture.thumbnail_url);
    }

    await supabase.storage
      .from('floor-textures')  // Changed from 'textures' to 'floor-textures'
      .remove(filesToRemove)

    // Delete the record
    const { error } = await supabase
      .from('floor_textures')  // Changed from 'textures' to 'floor_textures'
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting texture:', error)
    throw error instanceof Error ? error : new Error(String(error))
  }
} 