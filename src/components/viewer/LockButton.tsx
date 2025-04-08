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
                variant="secondary"
                onClick={onToggle}
                className={cn(
                  "w-full h-10 px-3 py-0 inline-flex items-center justify-center gap-2.5",
                  "rounded-xl border-0 bg-[#353535] shadow-[0_2px_0px_0px_rgba(0,0,0,0.25)]",
                  "hover:bg-[#404040]",
                  "disabled:opacity-70 disabled:pointer-events-none",
                  "text-sm text-foreground/80"
                )}
                disabled={!isModelLoaded || isGenerating}
              >
                {isLocked ? (
                  <Lock size={16} className="text-lime-400" />
                ) : (
                  <Unlock size={16} className="text-orange-400" />
                )}
                {isLocked ? 'Unlock Scene' : 'Lock Composition'}
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