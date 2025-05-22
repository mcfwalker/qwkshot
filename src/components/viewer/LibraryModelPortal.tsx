'use client'

import { createPortal } from 'react-dom'
import { LibraryModelModal } from './LibraryModelModal'
import { Model } from '@/lib/supabase'

interface LibraryModelPortalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (modelId: string) => void
}

export function LibraryModelPortal({ isOpen, onClose, onSelect }: LibraryModelPortalProps) {
  if (typeof window === 'undefined') return null // Guard against SSR

  return createPortal(
    <LibraryModelModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
    />,
    document.body
  )
} 