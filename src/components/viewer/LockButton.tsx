'use client';

import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  isGenerating?: boolean;
  isModelLoaded: boolean;
  className?: string;
}

export const LockButton: React.FC<LockButtonProps> = ({
  isLocked,
  onToggle,
  isGenerating,
  isModelLoaded,
  className
}) => {
  const isDisabled = !isModelLoaded || isGenerating;

  return (
    <div className={cn('flex items-center w-full', className)}>
      <div className="w-full flex-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild className="w-full">
              {isDisabled ? (
                <div 
                  className={cn(
                    "w-full h-14 px-3 py-0 inline-flex items-center justify-center gap-2.5",
                    "rounded-2xl border-0",
                    "text-sm font-semibold",
                    "bg-[#444444] text-[#666666] shadow-none",
                    "select-none"
                  )}
                  aria-disabled={true}
                >
                  <Unlock size={16} /> 
                  Lock Your Camera
                </div>
              ) : (
                <Button 
                  variant="primary"
                  onClick={onToggle}
                  className={cn(
                    "w-full h-14 px-3 py-0 inline-flex items-center justify-center gap-2.5",
                    "rounded-2xl border-0",
                    "text-sm font-semibold",
                    isLocked
                      ? "shadow-none dark:shadow-transparent bg-[#353535] text-white shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#404040]"
                      : "bg-[#C2F751] text-black shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#C2F751]/90",
                    "select-none"
                  )}
                >
                  {isLocked ? (
                    <Lock size={16} />
                  ) : (
                    <Unlock size={16} />
                  )}
                  {isLocked ? 'Camera Is Locked' : 'Lock Your Camera'}
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent 
              side="top"
              className="bg-[#121212] border-none text-white"
            >
              {!isModelLoaded
                ? 'Load a model first.'
                : isGenerating
                  ? 'Generation in progress...'
                  : isLocked 
                    ? 'Click to unlock camera and scene controls'
                    : 'Lock camera position to enable path generation'
              }
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}; 