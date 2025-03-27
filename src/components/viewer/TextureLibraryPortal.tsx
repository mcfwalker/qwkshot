'use client'

import { createPortal } from 'react-dom'
import { TextureLibraryModal } from './TextureLibraryModal'
import { FloorTexture } from '@/lib/supabase'

interface TextureLibraryPortalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (texture: FloorTexture) => void
}

export function TextureLibraryPortal({ isOpen, onClose, onSelect }: TextureLibraryPortalProps) {
  if (typeof window === 'undefined') return null // Guard against SSR

  return createPortal(
    <TextureLibraryModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
    />,
    document.body
  )
} 