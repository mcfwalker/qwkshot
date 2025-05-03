'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface SaveModelDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
  loadingMessage?: string
}

export function SaveModelDialog({ isOpen, onClose, onSave, loadingMessage }: SaveModelDialogProps) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savingStage, setSavingStage] = useState('Add Model')

  // Update saving stage based on loading message
  useEffect(() => {
    if (isSaving && loadingMessage) {
      if (loadingMessage.includes('Analyzing')) {
        setSavingStage('Analyzing...');
      } else if (loadingMessage.includes('metadata')) {
        setSavingStage('Preparing...');
      } else if (loadingMessage.includes('Uploading')) {
        setSavingStage('Uploading...');
      } else if (loadingMessage.includes('Normalizing')) {
        setSavingStage('Processing...');
      } else if (loadingMessage.includes('Loading')) {
        setSavingStage('Finalizing...');
      } else {
        setSavingStage('Saving...');
      }
    } else if (!isSaving) {
      setSavingStage('Add Model');
    }
  }, [isSaving, loadingMessage]);

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    setSavingStage('Saving...');
    try {
      await onSave(name.trim())
    } catch (error) {
      console.error('Failed to save model:', error)
      setIsSaving(false)
      setSavingStage('Add Model');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleSave()
    }
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={() => {}}
    >
      <DialogContent 
        className={cn(
          "sm:max-w-md bg-[#1D1D1D] border-[#353535]",
          "[&>button]:hidden" // Hide the close button using CSS
        )}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add Model</DialogTitle>
        </DialogHeader>
        
        {isSaving && loadingMessage ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#C2F751]" />
            <p className="text-base text-[#CFD0D0] text-center font-medium">{loadingMessage}</p>
            
            {/* Add progress details for upload/processing stages */}
            {loadingMessage.includes('Uploading') && (
              <p className="text-sm text-[#666666] text-center">Please wait while your file uploads...</p>
            )}
            
            {loadingMessage.includes('Normalizing') && (
              <p className="text-sm text-[#666666] text-center">This may take a moment for larger files</p>
            )}
          </div>
        ) : (
          <>
            <div className="py-4">
              <Input
                type="text"
                placeholder="Give your model a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-[#121212] border-[#353535]"
                disabled={isSaving}
                autoFocus
              />
            </div>
            
            <DialogFooter className="flex gap-6 justify-end">
              <Button 
                onClick={onClose}
                type="button"
                variant="ghost"
                disabled={isSaving}
                className="bg-transparent !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent border-0 shadow-none text-[#CFD0D0] p-0 hover:opacity-70 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className={cn(
                  "min-w-[120px] flex items-center gap-2",
                  isSaving 
                    ? "bg-[#1D1D1D] border border-[#C2F751] text-[#C2F751]" 
                    : "bg-[#C2F751] text-[#121212] hover:bg-[#C2F751]/90"
                )}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingStage}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
} 