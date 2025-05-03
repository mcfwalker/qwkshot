'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Target, Loader2 } from 'lucide-react';
import { broom } from '@lucide/lab';
import { Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

// STEP 1: Only props for Reset button
interface BottomToolbarProps {
  onToggleReticle?: () => void;
  isReticleVisible?: boolean;
  isReticleLoading?: boolean;
  onClearStageReset: () => void;
}

const BottomToolbarComponent: React.FC<BottomToolbarProps> = ({
  onToggleReticle,
  isReticleVisible = true,
  isReticleLoading = false,
  onClearStageReset,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2 p-2 rounded-xl bg-[#1D1D1D]">
      
      {/* Reticle Toggle Button */}
      <Button
        variant="secondary"
        className={cn(
          "flex h-[40px] px-6 justify-center items-center gap-[10px]",
          "rounded-[10px] border border-[#353535] bg-[#121212]",
          "hover:bg-[#353535]",
          "disabled:opacity-70 disabled:pointer-events-none",
          isReticleVisible 
            ? "text-[#C2F751]" 
            : "text-foreground/80"
        )}
        onClick={onToggleReticle}
        disabled={isReticleLoading}
      >
        {isReticleLoading 
          ? <Loader2 className="h-4 w-4 animate-spin" /> 
          : <Target className="h-4 w-4" />
        }
      </Button>

      {/* Separator (Restore if desired) */}
      <div className="h-6 w-px bg-[#444] mx-1"></div>

      {/* Clear Stage / Reset Button */}
       <Button
        variant="secondary"
        className={cn(
          "flex h-[40px] px-6 justify-center items-center gap-[10px]",
          "rounded-[10px] border border-[#353535] bg-[#121212]",
          "hover:bg-[#353535]",
          "disabled:opacity-70 disabled:pointer-events-none",
          "text-foreground/80"
        )}
        onClick={onClearStageReset}
      >
        <Icon iconNode={broom} className="h-4 w-4" />
       </Button>
    </div>
  );
};

export const BottomToolbar = React.memo(BottomToolbarComponent); 