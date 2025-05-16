'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

interface ThumbnailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnailImage: string | null;
  onSetAsThumbnail: () => void;
  onDownload: () => void;
  isProcessing: boolean;
  isSaved?: boolean;
  isCapturing?: boolean;
  modelName?: string;
}

export function ThumbnailPreviewModal({
  isOpen,
  onClose,
  thumbnailImage,
  onSetAsThumbnail,
  onDownload,
  isProcessing,
  isSaved = false,
  isCapturing = false,
  modelName = 'model'
}: ThumbnailPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isCapturing && !open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md bg-[#1E1E1E] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#e2e2e2]">Preview</DialogTitle>
          <DialogDescription className="text-[#e2e2e2] mt-2">
            Preview the captured thumbnail before saving or downloading.
          </DialogDescription>
        </DialogHeader>
        
        {isCapturing ? (
          <div className="flex flex-col items-center justify-center h-[300px] gap-4">
            <Loader2 className="h-10 w-10 text-[#CFD0D0] animate-spin" />
            <p className="text-sm text-muted-foreground text-center">Capturing thumbnail...</p>
          </div>
        ) : thumbnailImage ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative aspect-square w-full bg-[#121212] rounded-lg overflow-hidden border border-[#353535]">
              <img 
                src={thumbnailImage} 
                alt="Thumbnail Preview" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No thumbnail preview available
          </div>
        )}
        
        <DialogFooter className="flex gap-3 sm:gap-3 mt-4">
          <Button
            className="flex-1 h-12 bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90 flex items-center justify-center"
            onClick={onDownload}
            disabled={!thumbnailImage || isProcessing || isCapturing}
            type="button"
          >
            <span className="text-[#121212] font-medium">Download</span>
          </Button>
          <Button
            className="flex-1 h-12 bg-[#CFD0D0] text-[#121212] hover:bg-[#CFD0D0]/90 flex items-center justify-center gap-2"
            onClick={onSetAsThumbnail}
            disabled={!thumbnailImage || isProcessing || isSaved || isCapturing}
            type="button"
          >
            {isProcessing ? (
              <>
                <span className="text-[#121212] font-medium">Processing...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="h-5 w-5 text-[#121212]" />
                <span className="text-[#121212] font-medium">Thumbnail Saved!</span>
              </>
            ) : (
              <span className="text-[#121212] font-medium">Set as Thumbnail</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 