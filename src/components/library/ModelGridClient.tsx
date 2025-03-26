'use client'

import { useState } from 'react'
import { Model } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface ModelGridClientProps {
  initialModels: Model[]
}

export function ModelGridClient({ initialModels }: ModelGridClientProps) {
  const [models, setModels] = useState<Model[]>(initialModels)

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
        <Card key={model.id} className="library-card overflow-hidden">
          <CardContent className="p-0">
            <div className="aspect-square bg-[#1a1a1a] relative rounded-lg">
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <span className="text-[#666666] text-sm font-mono truncate">
                  {model.name}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 flex justify-between">
            <Link href={`/viewer/${model.id}`}>
              <Button className="library-button" variant="secondary" size="sm">
                View
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="library-button"
                onClick={() => handleDelete(model)}
              >
                <Trash2 className="library-button-icon" />
              </Button>
              <Link href={`/library/edit/${model.id}`}>
                <Button variant="ghost" size="sm" className="library-button">
                  <Pencil className="library-button-icon" />
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 