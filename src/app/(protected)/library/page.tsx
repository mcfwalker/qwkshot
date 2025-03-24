import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { Model } from '@/lib/supabase'
import { ModelGridSkeleton } from '@/components/library/ModelGridSkeleton'
import { ModelGridClient } from '@/components/library/ModelGridClient'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

// Separate data fetching logic
async function getModels() {
  const supabase = await createServerClient()
  const { data: models, error } = await supabase
    .from('models')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching models:', error)
    throw new Error('Failed to fetch models')
  }

  return models as Model[]
}

// Server Component
export default async function LibraryPage() {
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
          <p className="text-muted-foreground">
            Manage and view your 3D models
          </p>
        </div>
        <Link href="/viewer">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Model
          </Button>
        </Link>
      </div>

      <Suspense fallback={<ModelGridSkeleton />}>
        <ModelsContent />
      </Suspense>
    </div>
  )
}

// Async component for models content
async function ModelsContent() {
  const models = await getModels()
  return <ModelGridClient initialModels={models} />
} 