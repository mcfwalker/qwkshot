'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'

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
    if (dontShowAgain) {
      localStorage.setItem('dontShowClearConfirm', 'true')
    }
    onConfirm()
  }

  return (
    <AlertDialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent 
        className="sm:max-w-md bg-[#1E1E1E] border-[#353535]"
      >
        <AlertDialogHeader className="mb-2">
          <AlertDialogTitle className="text-[#e2e2e2]">Clear Scene</AlertDialogTitle>
          <AlertDialogDescription className="text-[#e2e2e2] mt-2">
            This will remove the current model and reset all camera settings and animations.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-2 flex items-center space-x-2">
          <Checkbox 
            id="dontShowAgainClearScene"
            checked={dontShowAgain} 
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            className="border-[#353535] data-[state=checked]:bg-[#C2F751] data-[state=checked]:text-black"
          />
          <Label 
            htmlFor="dontShowAgainClearScene" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#e2e2e2]"
          >
            Don't show me this again
          </Label>
        </div>
        
        <AlertDialogFooter className="flex gap-2 sm:gap-6 justify-end mt-4">
          <AlertDialogCancel 
            onClick={onCancel}
            className="bg-transparent !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent border-0 shadow-none text-[#e2e2e2] p-0 hover:opacity-70 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 