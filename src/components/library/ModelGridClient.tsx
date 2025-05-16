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

  // This function is for the OLD delete flow (separate AlertDialog), can be removed later
  function openDeleteDialog(model: Model) {
    setModelToDelete(model);
    setIsDeleteDialogOpen(true);
  }

  const handleImageError = (modelId: string) => {
    setImageErrors(prev => ({ ...prev, [modelId]: true }));
  };

  // This is the OLD handleDelete function, tied to the separate AlertDialog
  // We will create a new one for the ModelEditDialog
  // async function handleDelete() { ... existing handleDelete logic ... }

  const handleModelUpdated = async () => {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setModels(data || [])
      router.refresh()
      setEditingModel(null); // Close dialog on update
    } catch (error) {
      console.error('Error refreshing models:', error)
    }
  }

  // New delete handler for ModelEditDialog
  const handleConfirmedDeleteFromEditDialog = async () => {
    if (!editingModel) return;

    try {
      // Delete the file from storage
      // Make sure editingModel.file_url is the correct path. It might just be a filename.
      // Assuming it's a full path or a path that supabase.storage.remove can handle.
      if (editingModel.file_url) { // Only attempt to delete if file_url exists
        const { error: storageError } = await supabase.storage
          .from('models') // Ensure this is your correct bucket name
          .remove([editingModel.file_url]) // file_url might need to be just the file name/path within bucket
        
        if (storageError && storageError.message !== 'The resource was not found') { // Ignore if file not found, otherwise error
          console.error('Storage error:', storageError)
          toast.error(`Failed to delete model file: ${storageError.message}`)
          // Do not return here, allow DB record deletion attempt if desired, or handle as critical error.
          // For now, we'll let it proceed to delete the DB record.
        }
      }

      // Delete the record from the database
      const { error: dbError } = await supabase
        .from('models')
        .delete()
        .eq('id', editingModel.id)

      if (dbError) {
        console.error('Database error:', dbError)
        toast.error(`Failed to delete model record: ${dbError.message}`)
        return; // If DB delete fails, stop here
      }

      toast.success('Model deleted successfully');
      setModels(prevModels => prevModels.filter(m => m.id !== editingModel.id));
      setEditingModel(null); // Close the ModelEditDialog
      router.refresh(); // Refresh server components and other data
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete model');
    } finally {
      // setLoading state for the delete button in ModelEditDialog is handled internally there
    }
  };

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
          onDeleteClick={handleConfirmedDeleteFromEditDialog}
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
              onClick={async () => {
                if (!modelToDelete) return;
                try {
                  if (modelToDelete.file_url) {
                    const { error: storageError } = await supabase.storage.from('models').remove([modelToDelete.file_url]);
                    if (storageError && storageError.message !== 'The resource was not found') {
                      console.error('Storage error:', storageError); 
                      toast.error('Failed to delete model file'); 
                      return;
                    }
                  }
                  const { error } = await supabase.from('models').delete().eq('id', modelToDelete.id);
                  if (error) { 
                    console.error('Database error:', error); 
                    toast.error('Failed to delete model record'); 
                    return; 
                  }
                  toast.success('Model deleted successfully');
                  setModels(prev => prev.filter(m => m.id !== modelToDelete.id));
                  setIsDeleteDialogOpen(false);
                  setModelToDelete(null);
                  router.refresh();
                } catch (err) {
                  toast.error('Failed to delete model');
                }
              }}
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