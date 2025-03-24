'use client'

import { ModelViewer } from '@/components/viewer/ModelViewer'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Suspense } from 'react'
import type { Model } from '@/lib/supabase'

export default function ModelViewerWrapper({ model }: { model: Model }) {
  return (
    <ErrorBoundary name="ModelViewer">
      <Suspense fallback={
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading model...</p>
        </div>
      }>
        <ModelViewer model={model} />
      </Suspense>
    </ErrorBoundary>
  )
} 