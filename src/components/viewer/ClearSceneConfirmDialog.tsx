'use client'

import { useState, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ClearSceneConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ClearSceneConfirmDialog({
  isOpen,
  onConfirm,
  onCancel
}: ClearSceneConfirmDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleConfirm = () => {
    // If checkbox is checked, save the preference in localStorage
    if (dontShowAgain) {
      localStorage.setItem('dontShowClearConfirm', 'true')
    }
    onConfirm()
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent 
        className="sm:max-w-md bg-[#1D1D1D] border-[#353535]"
      >
        <DialogHeader className="mb-2">
          <DialogTitle>Clear Scene</DialogTitle>
          <DialogDescription className="text-[#CFD0D0] mt-2">
            This will remove the current model and reset all camera settings and animations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2 flex items-center space-x-2">
          <Checkbox 
            id="dontShowAgain" 
            checked={dontShowAgain} 
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            className="border-[#353535]"
          />
          <label 
            htmlFor="dontShowAgain" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#CFD0D0]"
          >
            Don't show me this again
          </label>
        </div>
        
        <DialogFooter className="flex gap-6 justify-end mt-4">
          <Button 
            onClick={onCancel}
            type="button"
            variant="ghost"
            className="bg-transparent !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent border-0 shadow-none text-[#CFD0D0] p-0 hover:opacity-70 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="bg-[#C2F751] text-[#121212] hover:bg-[#C2F751]/90"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 