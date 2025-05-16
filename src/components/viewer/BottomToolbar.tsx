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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center justify-center gap-6 p-4 rounded-xl bg-[#1E1E1E]">
      
      {/* Reticle Toggle Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="primary"
              size="icon"
              className={cn(
                "h-10 w-10",
                "rounded-[10px]",
                isReticleVisible 
                  ? "text-[#C2F751]" 
                  : ""
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
      {/* <div className="h-6 w-px bg-[#444] mx-1"></div> */}
      
      {/* Capture Thumbnail Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="primary"
              size="icon"
              className={cn(
                "h-10 w-10",
                "rounded-[10px]"
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
      {/* <div className="h-6 w-px bg-[#444] mx-1"></div> */}

      {/* Clear Stage / Reset Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="primary"
              size="icon"
              className={cn(
                "h-10 w-10",
                "rounded-[10px]"
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