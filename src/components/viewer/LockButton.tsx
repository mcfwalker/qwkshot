'use client';

import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  className?: string;
}

export const LockButton = ({ isLocked, onToggle, className }: LockButtonProps) => {
  return (
    <div className={cn('flex items-center w-full', className)}>
      <div className="flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="secondary"
                onClick={onToggle}
                className="w-full h-9 bg-background hover:bg-accent flex items-center justify-center gap-2 text-sm font-normal border border-[#444444]"
              >
                {isLocked ? (
                  <Lock className="h-4 w-4 text-lime-400" />
                ) : (
                  <Unlock className="h-4 w-4 text-orange-400" />
                )}
                {isLocked ? 'Composition Locked!' : 'Lock composition'}
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