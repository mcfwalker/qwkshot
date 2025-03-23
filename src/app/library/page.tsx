'use client'

import { useState, useEffect } from 'react'
import { Model } from '@/lib/supabase'
import { ModelGrid } from '@/components/library/ModelGrid'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function LibraryPage() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkSession()
    loadModels()
    
    // Add this handler for route changes
    const handleRouteChange = () => {
      console.log('Route changed, refreshing model data')
      loadModels()
    }
    
    // Listen for changes like when returning from another page
    window.addEventListener('focus', loadModels)
    
    return () => {
      window.removeEventListener('focus', loadModels)
    }
  }, [])

  async function checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Session error:', error)
        toast.error('Authentication error')
        router.push('/auth/sign-in')
        return
      }

      if (!session) {
        console.log('No session found, redirecting to sign in')
        router.push('/auth/sign-in')
        return
      }
    } catch (error) {
      console.error('Session check error:', error)
      toast.error('Authentication error')
      router.push('/auth/sign-in')
    }
  }

  async function loadModels() {
    try {
      console.log('Fetching models directly from Supabase')
      
      // Get models directly from Supabase 
      const { data: models, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Supabase error:', error)
        throw new Error(error.message)
      }
      
      console.log('Models fetched:', models?.length || 0)
      setModels(models || [])
    } catch (error) {
      console.error('Error loading models:', error)
      toast.error('Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(model: Model) {
    if (!confirm('Are you sure you want to delete this model?')) return

    try {
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('models')
        .remove([model.file_url])
      
      if (storageError) {
        console.error('Storage error:', storageError)
        toast.error('Failed to delete model file')
        return
      }

      // Delete the record
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', model.id)

      if (error) {
        console.error('Database error:', error)
        toast.error('Failed to delete model record')
        return
      }

      toast.success('Model deleted successfully')
      // Refresh the list
      await loadModels()
    } catch (error) {
      console.error('Error deleting model:', error)
      toast.error('Failed to delete model')
    }
  }

  function handleEdit(model: Model) {
    router.push(`/library/edit/${model.id}`)
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Model Library</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Model Library</h1>
        <Button onClick={() => router.push('/library/upload')}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Model
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No models found</p>
          <Button onClick={() => router.push('/library/upload')}>
            Upload your first model
          </Button>
        </div>
      ) : (
        <ModelGrid
          models={models}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
} 