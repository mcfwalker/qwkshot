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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

interface ModelEditDialogProps {
  model: Model
  onModelUpdated: () => void
  open?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

export function ModelEditDialog(props: ModelEditDialogProps) {
  const { model, onModelUpdated, open: externalOpen, onOpenChange: externalOnOpenChange } = props
  const [name, setName] = useState(model.name)
  const [isLoading, setIsLoading] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)
  const supabase = getSupabaseClient()

  const isEffectivelyOpen = externalOpen !== undefined ? externalOpen : internalOpen

  const handleOpenChange = (isOpen: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(isOpen)
    } else {
      setInternalOpen(isOpen)
    }
  }

  useEffect(() => {
    if (model) {
      setName(model.name)
    }
  }, [model])

  useEffect(() => {
    if (!isEffectivelyOpen) {
      setName(model.name)
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
      // Get and verify auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (!session?.user?.id) {
        throw new Error('Not authenticated')
      }

      if (session.user.id !== model.user_id) {
        throw new Error('Not authorized to update this model')
      }

      // Update the model name
      const { data, error: updateError } = await supabase
        .from('models')
        .update({ name: name.trim() })
        .eq('id', model.id)
        .eq('user_id', session.user.id)
        .select()

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Try to revalidate the page
      try {
        await fetch('/api/revalidate?path=/library', { method: 'POST' })
      } catch (revalidateError) {
        // Continue even if revalidation fails
      }
      
      toast.success('Model updated successfully')
      handleOpenChange(false)
      onModelUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update model')
    } finally {
      setIsLoading(false)
    }
  }

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
      <DialogContent className="sm:max-w-md bg-[#1D1D1D] border-[#353535]">
        <DialogHeader>
          <DialogTitle>Edit Model Name</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Model name"
            disabled={isLoading}
            className="bg-[#121212] border-[#353535]"
          />
          
          <DialogFooter className="pt-4 flex justify-end">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 