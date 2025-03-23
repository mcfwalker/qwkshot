'use client'

import { supabase } from './supabase'
import { Model, Collection } from './supabase'

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
      metadata: metadata.metadata || {},
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

export async function getModels() {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching models:', error)
    throw error
  }
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