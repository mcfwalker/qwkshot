import { createServerClient } from '@/lib/supabase-server'
import { ModelViewer } from '@/components/viewer/ModelViewer'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function ViewerPage({
  params,
}: {
  params: { modelId: string }
}) {
  console.log('ViewerPage: Attempting to fetch model with ID:', params.modelId)

  try {
    if (!params.modelId) {
      throw new Error('No model ID provided')
    }

    // Get the server-side Supabase client
    const supabase = createServerClient()

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) throw authError
    
    if (!session) {
      // Redirect to sign in if not authenticated
      redirect('/auth/sign-in')
    }

    // Fetch the model
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('id', params.modelId)
      .single()

    if (modelError) {
      console.error('Database error:', modelError)
      throw new Error(`Failed to fetch model: ${modelError.message}`)
    }

    if (!model) {
      console.log('ViewerPage: No model found with ID:', params.modelId)
      return (
        <div className="container py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Model Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The model with ID "{params.modelId}" could not be found.
              This could be because the model was deleted or you don't have permission to view it.
            </p>
            <Link href="/library">
              <Button>Back to Library</Button>
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">{model.name}</h1>
          <Link href="/library">
            <Button variant="outline">Back to Library</Button>
          </Link>
        </div>
        <div className="aspect-[16/9] bg-muted rounded-lg overflow-hidden">
          <ModelViewer model={model} />
        </div>
      </div>
    )
  } catch (error) {
    console.error('ViewerPage: Error details:', error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error)
    
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && 
      (error.message.includes('Authentication') || 
       error.message.includes('session'))

    if (isAuthError) {
      redirect('/auth/sign-in')
    }

    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Model</h1>
          <p className="text-muted-foreground mb-4">
            An error occurred while loading the model: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <div className="text-sm text-muted-foreground mb-6">
            Model ID: {params.modelId}
          </div>
          <Link href="/library">
            <Button>Back to Library</Button>
          </Link>
        </div>
      </div>
    )
  }
} 