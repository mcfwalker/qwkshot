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
    let mounted = true

    async function initialize() {
      try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          if (mounted) {
            toast.error('Please sign in to access the library')
            router.push('/auth/sign-in')
          }
          return
        }

        if (!session) {
          if (mounted) {
            console.log('No session found, redirecting to sign in')
            router.push('/auth/sign-in')
          }
          return
        }

        // Load models if authenticated
        if (mounted) {
          await loadModels()
        }
      } catch (error) {
        console.error('Initialization error:', error)
        if (mounted) {
          toast.error('Failed to initialize library')
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [router])

  async function loadModels() {
    try {
      console.log('Fetching models from Supabase')
      const { data: models, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
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