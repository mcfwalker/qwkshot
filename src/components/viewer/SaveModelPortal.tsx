'use client'

import { createPortal } from 'react-dom'
import { SaveModelDialog } from './SaveModelDialog'

interface SaveModelPortalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export function SaveModelPortal({ isOpen, onClose, onSave }: SaveModelPortalProps) {
  if (typeof window === 'undefined') return null // Guard against SSR

  return createPortal(
    <SaveModelDialog
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
    />,
    document.body
  )
} 