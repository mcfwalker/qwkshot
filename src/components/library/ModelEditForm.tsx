'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Model } from '@/lib/supabase'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
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
  const supabase = createClientComponentClient<Database>()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Get session to ensure we're authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Update the model name
      const { error } = await supabase
        .from('models')
        .update({ name })
        .eq('id', model.id)
        .select()
        .single()

      if (error) throw error

      // Invalidate the cache for both the library page and the edit page
      await fetch('/api/revalidate?path=/library', { method: 'POST' })
      await fetch(`/api/revalidate?path=/library/edit/${model.id}`, { method: 'POST' })
      
      // Force router to refresh data
      router.refresh()
      
      // Wait for revalidation and refresh to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      toast.success('Model updated successfully')
      
      // Navigate back to library
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
      // Get session to ensure we're authenticated
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

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

      // Invalidate the library page cache
      await fetch('/api/revalidate?path=/library', { method: 'POST' })
      
      // Force router to refresh data
      router.refresh()
      
      // Wait for revalidation and refresh to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      toast.success('Model deleted successfully')
      
      // Navigate back to library
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