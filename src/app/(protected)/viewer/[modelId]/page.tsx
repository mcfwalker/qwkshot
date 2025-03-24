import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import { ModelViewerClient } from '@/components/viewer/ModelViewerClient'
import { ViewerSkeleton } from '@/components/viewer/ViewerSkeleton'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cookies } from 'next/headers'

// Enable revalidation every hour
export const revalidate = 3600

// Metadata for the page
export async function generateMetadata({ params }: { params: { modelId: string } }) {
  const modelId = await Promise.resolve(params.modelId)
  const model = await getModelData(modelId)
  
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
    const cookieStore = await cookies()
    const supabase = createServerClient()
    
    const { data: model, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .single()

    if (error) {
      console.error('Database error:', error)
      return null
    }

    // Ensure the file_url is a full URL if it's a relative path
    if (model && !model.file_url.startsWith('http')) {
      // Remove any leading 'models/' from the file_url as it's already part of the bucket path
      const fileName = model.file_url.replace(/^models\//, '')
      model.file_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/models/${fileName}`
    }

    console.log('Model data:', { id: model?.id, file_url: model?.file_url })
    return model
  } catch (error) {
    console.error('Error fetching model:', error)
    return null
  }
}

// Server Component
export default async function ViewerPage({ params }: { params: { modelId: string } }) {
  const modelId = await Promise.resolve(params.modelId)
  const model = await getModelData(modelId)

  if (!model) {
    notFound()
  }

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      <ErrorBoundary fallback={<ViewerError modelId={modelId} />}>
        <Suspense fallback={<ViewerSkeleton />}>
          <ModelViewerClient model={model} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
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