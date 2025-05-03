'use client'

import { createPortal } from 'react-dom'
import { SaveModelDialog } from './SaveModelDialog'

interface SaveModelPortalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
  loadingMessage?: string | null
}

export function SaveModelPortal({ isOpen, onClose, onSave, loadingMessage }: SaveModelPortalProps) {
  if (typeof window === 'undefined') return null // Guard against SSR

  return createPortal(
    <SaveModelDialog
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      loadingMessage={loadingMessage || undefined}
    />,
    document.body
  )
} 