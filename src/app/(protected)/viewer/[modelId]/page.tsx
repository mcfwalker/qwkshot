import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { ModelViewerClient } from '@/components/viewer/ModelViewerClient'
import { ViewerSkeleton } from '@/components/viewer/ViewerSkeleton'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BackToLibrary } from '@/components/viewer/BackToLibrary'

// Enable revalidation every hour
export const revalidate = 3600

// Metadata for the page
export async function generateMetadata({ params }: { params: { modelId: string } }) {
  const resolvedParams = await params
  const model = await getModelData(resolvedParams.modelId)
  
  return {
    title: model ? `${model.name} - Modern 3D Viewer` : 'Model Not Found',
    description: model?.description || 'View and interact with 3D models',
  }
}

// Separate data fetching logic
async function getModelData(modelId: string) {
  if (!modelId) {
    return null
  }

  try {
    const supabase = await createServerClient()
    
    // Get the model details
    const { data: model, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return null
    }

    if (!model) {
      return null
    }

    return model
  } catch (error) {
    console.error('Error fetching model:', error)
    return null
  }
}

// Server Component
export default async function ViewerPage({ params }: { params: { modelId: string } }) {
  try {
    const resolvedParams = await params
    const model = await getModelData(resolvedParams.modelId)

    if (!model) {
      notFound()
    }

    return (
      <div className="h-[calc(100vh-4rem)] relative">
        <div className="absolute top-4 left-4 z-10">
          <BackToLibrary />
        </div>
        <ErrorBoundary fallback={<ViewerError modelId={resolvedParams.modelId} />}>
          <Suspense fallback={<ViewerSkeleton />}>
            <ModelViewerClient model={model} />
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  } catch (error) {
    console.error('Error in ViewerPage:', error)
    const resolvedParams = await params
    return <ViewerError modelId={resolvedParams.modelId} />
  }
}

// Error fallback component
function ViewerError({ modelId }: { modelId: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Failed to load model</h2>
        <p className="text-muted-foreground">
          There was an error loading the model. Please try again later.
        </p>
        <p className="text-sm text-muted-foreground">Model ID: {modelId}</p>
        <Button asChild>
          <Link href="/library">Return to Library</Link>
        </Button>
      </div>
    </div>
  )
} 