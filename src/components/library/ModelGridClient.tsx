'use client'

import { useEffect, useState, useMemo } from 'react'
import { Model } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Box } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ModelEditDialog } from './ModelEditDialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import Image from 'next/image'
import ModelLibraryCard from '@/components/viewer/ModelLibraryCard'

interface ModelGridClientProps {
  initialModels: Model[]
}

export function ModelGridClient({ initialModels }: ModelGridClientProps) {
  const [models, setModels] = useState<Model[]>(initialModels)
  const router = useRouter()
  const [modelToDelete, setModelToDelete] = useState<Model | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [editingModel, setEditingModel] = useState<Model | null>(null)

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

  function openDeleteDialog(model: Model) {
    setModelToDelete(model);
    setIsDeleteDialogOpen(true);
  }

  const handleImageError = (modelId: string) => {
    setImageErrors(prev => ({ ...prev, [modelId]: true }));
  };

  async function handleDelete() {
    if (!modelToDelete) return;
    
    try {
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('models')
        .remove([modelToDelete.file_url])
      
      if (storageError) {
        console.error('Storage error:', storageError)
        toast.error('Failed to delete model file')
        return
      }

      // Delete the record
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', modelToDelete.id)

      if (error) {
        console.error('Database error:', error)
        toast.error('Failed to delete model record')
        return
      }

      toast.success('Model deleted successfully')
      router.refresh() // Trigger a router refresh to update server components
      setModels(models.filter(m => m.id !== modelToDelete.id))
    } catch (error) {
      console.error('Error deleting model:', error)
      toast.error('Failed to delete model')
    } finally {
      // Reset state
      setModelToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  }

  // Helper function to refresh models after edit/delete
  const handleModelUpdated = async () => {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setModels(data || [])
      router.refresh() // Refresh the page to update server components
      setEditingModel(null); // Close dialog on update
    } catch (error) {
      console.error('Error refreshing models:', error)
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
    <>
      <div className="library-grid">
        {models.map((model) => {
          // Calculate cache-busting URL directly without useMemo
          let thumbnailUrl: string | null = null;
          if (model.thumbnail_url) {
            if (model.thumbnail_url.includes('?t=')) {
              thumbnailUrl = model.thumbnail_url;
            } else {
              thumbnailUrl = `${model.thumbnail_url}?t=${Date.now()}`;
            }
          }

          return (
            <ModelLibraryCard
              key={model.id}
              modelName={model.name}
              thumbnailUrl={thumbnailUrl === null ? undefined : thumbnailUrl}
              onClick={() => router.push(`/viewer/${model.id}`)}
              onEditClick={() => {
                console.log("Edit clicked for model:", model.name);
                setEditingModel(model);
              }}
            />
          );
        })}
      </div>

      {editingModel && (
        <ModelEditDialog
          model={editingModel}
          onModelUpdated={handleModelUpdated}
          open={!!editingModel}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setEditingModel(null);
            }
          }}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1D1D1D] border-[#353535]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this model? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#353535] text-white hover:bg-[#444444] border-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-[#F76451] text-white hover:bg-[#F76451]/90 border-0"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 