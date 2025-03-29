'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Model } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface ModelEditFormProps {
  model: Model
}

export function ModelEditForm({ model }: ModelEditFormProps) {
  const router = useRouter()
  const [name, setName] = useState(model.name)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('models')
        .update({ name })
        .eq('id', model.id)

      if (error) throw error

      // First refresh the router to trigger revalidation
      router.refresh()
      
      // Wait for a tick to allow revalidation to start
      await new Promise(resolve => setTimeout(resolve, 100))
      
      toast.success('Model updated successfully')
      
      // Then navigate back to library
      router.push('/library')
    } catch (error) {
      console.error('Error updating model:', error)
      toast.error('Failed to update model')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    setIsLoading(true)

    try {
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('models')
        .remove([model.file_url])
      
      if (storageError) throw storageError

      // Delete the record
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', model.id)

      if (error) throw error

      // First refresh the router to trigger revalidation
      router.refresh()
      
      // Wait for a tick to allow revalidation to start
      await new Promise(resolve => setTimeout(resolve, 100))
      
      toast.success('Model deleted successfully')
      
      // Then navigate back to library
      router.push('/library')
    } catch (error) {
      console.error('Error deleting model:', error)
      toast.error('Failed to delete model')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Model name"
            disabled={isLoading}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>

      <div className="pt-4 border-t">
        <h2 className="text-destructive font-semibold mb-4">Danger Zone</h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isLoading}>
              Delete Model
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                model and remove the data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {isLoading ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
} 