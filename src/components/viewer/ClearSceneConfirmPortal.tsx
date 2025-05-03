'use client'

import { createPortal } from 'react-dom'
import { ClearSceneConfirmDialog } from './ClearSceneConfirmDialog'

interface ClearSceneConfirmPortalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ClearSceneConfirmPortal({ 
  isOpen, 
  onConfirm, 
  onCancel 
}: ClearSceneConfirmPortalProps) {
  if (typeof window === 'undefined') return null // Guard against SSR

  return createPortal(
    <ClearSceneConfirmDialog
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
    document.body
  )
} 