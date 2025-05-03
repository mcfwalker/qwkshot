'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ThumbnailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnailImage: string | null;
  onSetAsThumbnail: () => void;
  onDownload: () => void;
  isProcessing: boolean;
  isSaved?: boolean;
  isCapturing?: boolean;
}

export function ThumbnailPreviewModal({
  isOpen,
  onClose,
  thumbnailImage,
  onSetAsThumbnail,
  onDownload,
  isProcessing,
  isSaved = false,
  isCapturing = false
}: ThumbnailPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isCapturing && !open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md bg-[#1D1D1D] border-[#353535]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Preview</DialogTitle>
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
        
        <DialogFooter className="flex gap-12 sm:gap-12 mt-4">
          <button
            className="flex-1 h-12 rounded-lg bg-[#CFD0D0] border-0 text-[#121212] font-medium hover:bg-[#BBBCBC] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            onClick={onDownload}
            disabled={!thumbnailImage || isProcessing || isCapturing}
            type="button"
          >
            <span className="text-[#121212] font-medium">Download</span>
          </button>
          <button
            className="flex-1 h-12 rounded-lg bg-[#CFD0D0] border-0 text-[#121212] font-medium hover:bg-[#BBBCBC] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            onClick={onSetAsThumbnail}
            disabled={!thumbnailImage || isProcessing || isSaved || isCapturing}
            type="button"
          >
            <span className="text-[#121212] font-medium">
              {isProcessing ? "Processing..." : isSaved ? "Thumbnail Saved" : "Set as Thumbnail"}
            </span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 