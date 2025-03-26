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
  try {
    console.log('Debug: Library - Starting getModels')
    const supabase = await createServerClient()
    console.log('Debug: Library - Supabase client created')

    // First, try to get the session
    try {
      console.log('Debug: Library - Checking session')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Debug: Library - Session check complete:', !!session)
    } catch (sessionError) {
      console.error('Warning: Session check failed:', sessionError)
      // Continue anyway - the middleware will handle unauthorized access
    }

    const { data: models, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching models:', error)
      throw error
    }

    console.log('Debug: Library - Models fetched successfully')
    return models as Model[]
  } catch (error) {
    console.error('Error in getModels:', error)
    throw new Error('Failed to fetch models')
  }
}

// Server Component
export default async function LibraryPage() {
  console.log('Debug: Library - Page component rendering')
  return (
    <div className="container px-4 py-8">
      <div className="library-header">
        <div>
          <h1 className="library-title">Your Library</h1>
          <p className="library-subtitle">
            Manage and view your 3D models
          </p>
        </div>
        <div className="space-x-2">
          <Link href="/library/upload">
            <Button className="library-button">
              <Plus className="library-button-icon" />
              New Model
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<ModelGridSkeleton />}>
        <ModelsContent />
      </Suspense>
    </div>
  )
}

// Async component for models content
async function ModelsContent() {
  console.log('Debug: Library - ModelsContent starting')
  const models = await getModels()
  console.log('Debug: Library - ModelsContent received models')
  return <ModelGridClient initialModels={models} />
} 