'use client'

import { useEffect, useState } from 'react'
import { Model } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ModelGridClientProps {
  initialModels: Model[]
}

export function ModelGridClient({ initialModels }: ModelGridClientProps) {
  const [models, setModels] = useState<Model[]>(initialModels)
  const router = useRouter()

  // Refresh models when component mounts or when router is refreshed
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data, error } = await supabase
          .from('models')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setModels(data || [])
      } catch (error) {
        console.error('Error refreshing models:', error)
      }
    }

    fetchModels()
  }, [])

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('model_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'models' 
        }, 
        async () => {
          // Refresh the models list when changes occur
          const { data, error } = await supabase
            .from('models')
            .select('*')
            .order('created_at', { ascending: false })

          if (!error && data) {
            setModels(data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
      router.refresh() // Trigger a router refresh to update server components
      setModels(models.filter(m => m.id !== model.id))
    } catch (error) {
      console.error('Error deleting model:', error)
      toast.error('Failed to delete model')
    }
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No models found</p>
        <Link href="/viewer">
          <Button>
            Create your first model
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="library-grid">
      {models.map((model) => (
        <Card key={model.id} className="library-card overflow-hidden bg-[#1D1D1D] border-0">
          <CardContent className="p-0">
            <Link href={`/viewer/${model.id}`} className="block relative group">
              <div className="aspect-square bg-[#121212] relative rounded-lg">
                {/* Remove centered name */}
                {/* 
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <span className="text-[#666666] text-sm font-mono truncate">
                    {model.name}
                  </span>
                </div>
                */}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none">
                <span className="text-white font-semibold">Use Model</span>
              </div>
            </Link>
          </CardContent>
          <CardFooter className="p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-foreground truncate mr-2">
              {model.name}
            </span>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/library/edit/${model.id}`}>
                <Button 
                  className="flex items-center justify-center w-10 h-10 p-2 rounded-lg border border-[#353535] bg-[#121212] hover:bg-[#353535] text-foreground/60 hover:text-foreground transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                className="flex items-center justify-center w-10 h-10 p-2 rounded-lg border border-[#353535] bg-[#121212] hover:bg-[#353535] text-foreground/60 hover:text-foreground transition-colors"
                onClick={() => handleDelete(model)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 