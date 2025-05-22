'use client'

import { supabase } from './supabase'
import { Model, Collection } from './supabase'
import { withRetry } from './retry-utils'
import { toast } from 'sonner'

export async function uploadModel(file: File, metadata: Partial<Model>) {
  try {
    console.log('Starting model upload:', { fileName: file.name, metadata })
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw new Error(`Auth error: ${userError.message}`)
    if (!user) throw new Error('No authenticated user')
    
    // Upload the model file
    const modelPath = `models/${metadata.name}-${Date.now()}`
    console.log('Uploading to path:', modelPath)
    
    const { data: modelData, error: modelError } = await supabase.storage
      .from('models')
      .upload(modelPath, file)
    
    if (modelError) {
      console.error('Storage upload error:', modelError)
      throw new Error(`Storage upload failed: ${modelError.message}`)
    }

    console.log('File uploaded successfully:', modelData)

    // Create the model record
    const modelRecord = {
      name: metadata.name,
      description: metadata.description,
      file_url: modelData.path,
      metadata: {
        ...metadata.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      },
      tags: metadata.tags || [],
      user_id: user.id
    }
    
    console.log('Creating database record:', modelRecord)

    const { data, error } = await supabase
      .from('models')
      .insert(modelRecord)
      .select()
      .single()

    if (error) {
      console.error('Database insert error:', error)
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('models')
        .remove([modelData.path])
        .then(() => console.log('Cleaned up uploaded file after failed insert'))
        .catch(cleanupError => console.error('Failed to clean up file:', cleanupError))
      
      throw new Error(`Database insert failed: ${error.message}`)
    }

    console.log('Model record created successfully:', data)
    return data
  } catch (error) {
    console.error('Error in uploadModel:', error)
    throw error
  }
}

export async function getModels(): Promise<Model[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }, {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      toast.error(`Loading models failed (attempt ${attempt}/3)`, {
        description: error.message
      });
    }
  });
}

export async function getModel(id: string) {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching model:', error)
    throw error
  }
}

export async function updateModel(id: string, updates: Partial<Model>) {
  try {
    const { data, error } = await supabase
      .from('models')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating model:', error)
    throw error
  }
}

export async function deleteModel(id: string) {
  try {
    // First get the model to get the file path
    const model = await getModel(id)
    
    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('models')
      .remove([model.file_url])
    
    if (storageError) throw storageError

    // Delete the record
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting model:', error)
    throw error
  }
}

export async function createCollection(data: Partial<Collection>) {
  try {
    const { data: collection, error } = await supabase
      .from('collections')
      .insert(data)
      .select()
      .single()

    if (error) throw error
    return collection
  } catch (error) {
    console.error('Error creating collection:', error)
    throw error
  }
}

export async function getCollections() {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching collections:', error)
    throw error
  }
}

export async function updateCollection(id: string, updates: Partial<Collection>) {
  try {
    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating collection:', error)
    throw error
  }
}

export async function loadModel(modelId: string): Promise<string> {
  return withRetry(async () => {
    // Log session state before attempting to fetch model details
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('loadModel diagnostic: Supabase session error:', sessionError.message);
    }
    console.log(
      'loadModel diagnostic: Attempting to load. modelId:',
      modelId,
      'Has session:',
      !!session,
      'User ID:',
      session?.user?.id
    );

    // Get the model details first
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('file_url')
      .eq('id', modelId)
      .single();

    if (modelError || !model) {
      throw new Error('Failed to find model');
    }

    // Get a signed URL for the model file
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('models')
      .createSignedUrl(model.file_url, 3600); // 1 hour expiration

    if (urlError || !urlData?.signedUrl) {
      throw new Error('Failed to get model URL');
    }

    return urlData.signedUrl;
  }, {
    maxAttempts: 3,
    onRetry: (error, attempt) => {
      toast.error(`Loading model failed (attempt ${attempt}/3)`, {
        description: error.message
      });
    },
    retryableErrors: [
      'Failed to find model',
      'Failed to get model URL',
      'Network request failed',
      /5\d\d/
    ]
  });
} 