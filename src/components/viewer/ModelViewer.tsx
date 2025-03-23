'use client'

import { Model } from '@/lib/supabase'

interface ModelViewerProps {
  model: Model
}

export function ModelViewer({ model }: ModelViewerProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Model Viewer Coming Soon</h2>
        <p className="text-sm text-muted-foreground">File URL: {model.file_url}</p>
      </div>
    </div>
  )
}
