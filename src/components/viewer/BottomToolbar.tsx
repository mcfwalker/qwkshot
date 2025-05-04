'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Target, Loader2, Camera } from 'lucide-react';
import { broom } from '@lucide/lab';
import { Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// STEP 1: Only props for Reset button
interface BottomToolbarProps {
  onToggleReticle?: () => void;
  isReticleVisible?: boolean;
  isReticleLoading?: boolean;
  onClearStageReset: () => void;
  onCaptureThumbnail?: () => void;
  isModelLoaded?: boolean;
  isCapturingThumbnail?: boolean;
}

const BottomToolbarComponent: React.FC<BottomToolbarProps> = ({
  onToggleReticle,
  isReticleVisible = true,
  isReticleLoading = false,
  onClearStageReset,
  onCaptureThumbnail,
  isModelLoaded = false,
  isCapturingThumbnail = false,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2 p-2 rounded-xl bg-[#1D1D1D]">
      
      {/* Reticle Toggle Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className={cn(
                "flex h-[40px] px-6 justify-center items-center gap-[10px]",
                "rounded-[10px] border border-[#353535] bg-[#121212]",
                "hover:bg-[#353535] hover:text-white hover:border-[#555555]",
                "disabled:opacity-70 disabled:pointer-events-none",
                isReticleVisible 
                  ? "text-[#C2F751]" 
                  : "text-foreground/80",
                "transition-colors duration-200"
              )}
              onClick={onToggleReticle}
              disabled={isReticleLoading}
            >
              {isReticleLoading 
                ? <Loader2 className="h-4 w-4 animate-spin" /> 
                : <Target className="h-4 w-4" />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isReticleVisible ? "Hide" : "Show"} center reticle</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Separator */}
      <div className="h-6 w-px bg-[#444] mx-1"></div>
      
      {/* Capture Thumbnail Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className={cn(
                "flex h-[40px] px-6 justify-center items-center gap-[10px]",
                "rounded-[10px] border border-[#353535] bg-[#121212]",
                "hover:bg-[#353535] hover:text-white hover:border-[#555555]",
                "disabled:opacity-70 disabled:pointer-events-none",
                "text-foreground/80 transition-colors duration-200"
              )}
              onClick={onCaptureThumbnail}
              disabled={!isModelLoaded || isCapturingThumbnail}
              aria-label="Capture thumbnail"
              title="Capture thumbnail"
            >
              {isCapturingThumbnail 
                ? <Loader2 className="h-4 w-4 animate-spin" /> 
                : <Camera className="h-4 w-4" />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!isModelLoaded 
              ? "Load a model to capture thumbnail" 
              : isCapturingThumbnail 
                ? "Capturing thumbnail..." 
                : "Capture thumbnail for library"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Separator */}
      <div className="h-6 w-px bg-[#444] mx-1"></div>

      {/* Clear Stage / Reset Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              className={cn(
                "flex h-[40px] px-6 justify-center items-center gap-[10px]",
                "rounded-[10px] border border-[#353535] bg-[#121212]",
                "hover:bg-[#353535] hover:text-white hover:border-[#555555]",
                "disabled:opacity-70 disabled:pointer-events-none",
                "text-foreground/80 transition-colors duration-200"
              )}
              onClick={onClearStageReset}
            >
              <Icon iconNode={broom} className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear stage and reset scene</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export const BottomToolbar = React.memo(BottomToolbarComponent); 