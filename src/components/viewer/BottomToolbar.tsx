'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Target, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// STEP 1: Only props for Reset button
interface BottomToolbarProps {
  onClearStageReset: () => void;
  isConfirmingReset: boolean;
}

const BottomToolbarComponent: React.FC<BottomToolbarProps> = ({
  onClearStageReset,
  isConfirmingReset,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2 p-2 rounded-full bg-[#121212] border border-[#444]">
      
      {/* Reticle Toggle Button (Placeholder / Disabled) */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-full text-foreground/60",
          // No active state yet
          "opacity-50 cursor-not-allowed" // Visually indicate disabled
        )}
        aria-label="Toggle Reticle (disabled)"
        disabled={true} // Start disabled
      >
        <Target className={cn("h-4 w-4")} /> 
      </Button>

      {/* Separator */}
      <div className="h-6 w-px bg-[#444] mx-1"></div>

      {/* Clear Stage / Reset Button (Uses real props) */}
       <Button
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-8 w-8 rounded-full text-foreground/60 hover:text-red-500/80 hover:bg-red-500/10",
              isConfirmingReset && "bg-red-500/20 text-red-500"
            )}
            onClick={onClearStageReset} // Use real prop
            aria-label={isConfirmingReset ? "Confirm Reset Stage" : "Clear Stage & Reset"}
          >
            <Trash2 className="h-4 w-4" />
       </Button>
    </div>
  );
};

export const BottomToolbar = React.memo(BottomToolbarComponent); 