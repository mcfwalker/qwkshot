'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Model } from '@/lib/supabase'
import { getSupabaseClient } from '@/lib/supabase'
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
  const supabase = getSupabaseClient()

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
        .eq('user_id', session.user.id) // Explicitly add user_id check
        .select()

      if (updateError) {
        throw new Error(updateError.message)
      }

      // Revalidate and navigate in a single operation to avoid race conditions
      try {
        // Invalidate the library page cache
        await fetch('/api/revalidate?path=/library', { method: 'POST' })
      } catch (revalidateError) {
        // Continue even if revalidation fails
      }
      
      toast.success('Model updated successfully')
      
      // Navigate after the toast appears
      setTimeout(() => {
        router.push('/library')
      }, 100)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update model')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    setIsLoading(true)

    try {
      // Get and verify auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (!session?.user?.id) {
        throw new Error('Not authenticated')
      }

      if (session.user.id !== model.user_id) {
        throw new Error('Not authorized to delete this model')
      }

      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('models')
        .remove([model.file_url])
      
      if (storageError) throw storageError

      // Delete the record
      const { error, data } = await supabase
        .from('models')
        .delete()
        .eq('id', model.id)
        .eq('user_id', session.user.id) // Explicitly add user_id check
        .select()

      if (error) throw error

      // Revalidate and navigate in a single operation to avoid race conditions
      try {
        // Invalidate the library page cache
        await fetch('/api/revalidate?path=/library', { method: 'POST' })
      } catch (revalidateError) {
        // Continue even if revalidation fails
      }
      
      toast.success('Model deleted successfully')
      
      // Navigate after the toast appears
      setTimeout(() => {
        router.push('/library')
      }, 100)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete model')
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