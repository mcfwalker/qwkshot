'use client'

import { useState, useEffect } from 'react'
import { Model } from '@/lib/supabase'
import { getSupabaseClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

interface ModelEditDialogProps {
  model: Model
  onModelUpdated: () => void
  onDeleteClick: () => void;
  open?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export function ModelEditDialog(props: ModelEditDialogProps) {
  const { model, onModelUpdated, onDeleteClick, open: externalOpen, onOpenChange: externalOnOpenChange } = props
  const [name, setName] = useState(model.name)
  const [isLoading, setIsLoading] = useState(false) // For save operation
  const [isDeleting, setIsDeleting] = useState(false) // For delete operation
  const [internalOpen, setInternalOpen] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const supabase = getSupabaseClient()

  const isEffectivelyOpen = externalOpen !== undefined ? externalOpen : internalOpen

  const handleOpenChange = (isOpen: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(isOpen)
    } else {
      setInternalOpen(isOpen)
    }
    if (!isOpen) {
      setIsConfirmingDelete(false); 
      setName(model.name); // Reset name on close
    }
  }

  useEffect(() => {
    if (model) {
      setName(model.name)
    }
    setIsConfirmingDelete(false);
  }, [model])

  useEffect(() => {
    if (!isEffectivelyOpen) {
      setName(model.name)
      setIsConfirmingDelete(false)
    }
  }, [isEffectivelyOpen, model.name])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Model name cannot be empty')
      return
    }
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Not authenticated')
      if (session.user.id !== model.user_id) throw new Error('Not authorized to update this model')
      const { error: updateError } = await supabase
        .from('models')
        .update({ name: name.trim() })
        .eq('id', model.id)
        .eq('user_id', session.user.id)
      if (updateError) throw new Error(updateError.message)
      try { await fetch('/api/revalidate?path=/library', { method: 'POST' }) } catch { /* Continue */ }
      toast.success('Model updated successfully')
      handleOpenChange(false) // Close dialog on successful save
      onModelUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update model')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRequest = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDeleteAction = async () => {
    setIsDeleting(true);
    try {
      await onDeleteClick(); // This prop should now handle the actual deletion logic including toasts
      // Parent should close the dialog upon successful deletion by controlling the `open` prop if needed
      // or we can call handleOpenChange(false) here if deletion is always successful from onDeleteClick.
      // For now, assume parent handles dialog closure after onModelUpdated or similar is called post-delete.
    } catch (error) {
      // Error toast is likely handled by onDeleteClick in parent or here if not.
      toast.error(error instanceof Error ? error.message : 'Failed to delete model');
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false); // Reset confirmation state after action
    }
  };

  return (
    <Dialog open={isEffectivelyOpen} onOpenChange={handleOpenChange}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button 
            className="flex items-center justify-center w-10 h-10 p-2 rounded-lg border border-[#353535] bg-[#121212] hover:bg-[#353535] text-foreground/60 hover:text-foreground transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-[#e2e2e2]">Edit Model</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            Update the name of your model or delete it from the library.
          </DialogDescription>
        </DialogHeader>
        
        {/* Form for editing name - always visible unless isDeleting (final delete action) */}
        <form onSubmit={handleSubmit} className={`space-y-4 py-2 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <Input
              id="modelNameEditDialog"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter model name"
              disabled={isLoading || isDeleting || isConfirmingDelete} // Also disable if confirming delete to prevent edits during that stage
              className="bg-[#121212] border-[#353535] text-[#e2e2e2] w-full"
            />
          </div>
          <DialogFooter className="pt-2 flex justify-end">
            <Button 
              type="submit" 
              disabled={isLoading || !name.trim() || isDeleting || isConfirmingDelete}
              className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>

        <div className="border-t border-[#444444] my-4"></div>

        {/* Delete Section */} 
        <div className="space-y-3">
          {isConfirmingDelete ? (
            <div className="flex justify-between items-center">
              <p className="text-sm text-[#e2e2e2] mr-4">
                {`Are you sure you want to delete "${model.name}" from your library?`}
              </p>
              <Button 
                onClick={handleConfirmDeleteAction} 
                className="bg-red-600 hover:bg-red-700 text-white rounded-md shrink-0"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-sm text-[#e2e2e2] mr-8">
                Permanently remove this model and all of its associated data.
              </p>
              <Button 
                variant="outline"
                onClick={handleDeleteRequest} 
                className="border-[#444444] text-[#e2e2e2] hover:bg-[#353535] shrink-0"
                disabled={isLoading || isDeleting}
              >
                Delete Model
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 