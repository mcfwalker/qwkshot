'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SaveModelDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export function SaveModelDialog({ isOpen, onClose, onSave }: SaveModelDialogProps) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await onSave(name.trim())
      onClose()
    } catch (error) {
      console.error('Failed to save model:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div 
      className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-black/80 backdrop-blur-sm border border-[#444444] rounded-md px-3 py-2"
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      <Input
        type="text"
        placeholder="Name your model..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="bg-transparent border-none text-white placeholder:text-gray-400 w-[200px] focus-visible:ring-0 focus-visible:ring-offset-0"
        disabled={isSaving}
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={!name.trim() || isSaving}
        className="px-3 py-1 bg-[#bef264] hover:bg-[#bef264]/90 text-black rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save
      </button>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white"
        disabled={isSaving}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
} 