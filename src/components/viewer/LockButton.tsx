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
  return (
    <div className={cn('flex items-center w-full', className)}>
      <div className="flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="primary"
                onClick={onToggle}
                className={cn(
                  "w-full h-14 px-3 py-0 inline-flex items-center justify-center gap-2.5",
                  "rounded-2xl border-0",
                  "text-sm font-semibold",
                  (!isModelLoaded || isGenerating) 
                    ? "bg-[#444444] text-[#666666] shadow-none pointer-events-none cursor-not-allowed"
                    : isLocked
                      ? "shadow-none dark:shadow-transparent bg-[#353535] text-white shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#404040]"
                      : "bg-[#C2F751] text-black shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)] hover:bg-[#C2F751]/90"
                )}
                disabled={!isModelLoaded || isGenerating}
              >
                {isLocked ? (
                  <Lock size={16} />
                ) : (
                  <Unlock size={16} />
                )}
                {isLocked ? 'Camera Is Locked' : 'Lock Your Camera'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isLocked 
                ? 'Scene is locked. Camera and model position cannot be changed'
                : 'Lock the scene to generate camera paths'
              }
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}; 